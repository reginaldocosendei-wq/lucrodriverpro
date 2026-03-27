import React, { useState, useEffect } from "react";
import { I18nProvider } from "@/lib/i18n";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMe } from "@workspace/api-client-react";
import { AnimatePresence, motion } from "framer-motion";
import { SplashScreen } from "@/components/SplashScreen";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";

import Home from "@/pages/Home";
import Rides from "@/pages/rides";
import Costs from "@/pages/costs";
import Goals from "@/pages/goals";
import Reports from "@/pages/reports";
import Upgrade from "@/pages/upgrade";
import Import from "@/pages/Import";
import CheckoutSuccess from "@/pages/checkout-success";
import CheckoutCancel from "@/pages/checkout-cancel";
import PixPayment from "@/pages/pix-payment";
import AdminPix from "@/pages/admin-pix";
import AuthScreen from "@/pages/auth";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorMsg: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("App render error:", error.message, error.stack);
    console.log("[ErrorBoundary] Crash:", {
      message: error.message,
      route: typeof window !== "undefined" ? window.location.pathname : "unknown",
      componentStack: info.componentStack?.slice(0, 800),
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMsg: "" });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] bg-[#0a0a0a] flex flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-2">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-white font-bold text-xl">Algo não saiu como esperado</p>
          <p className="text-white/50 text-sm max-w-xs leading-relaxed">
            Tente novamente em instantes.
          </p>
          <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
            <button
              onClick={() => {
                this.handleReset();
                window.location.href = import.meta.env.BASE_URL || "/";
              }}
              className="px-6 py-3 bg-primary text-black font-bold rounded-xl text-sm active:scale-95 transition-transform"
            >
              Voltar ao início
            </button>
            <button
              onClick={this.handleReset}
              className="px-6 py-3 border border-white/10 text-white/60 font-medium rounded-xl text-sm active:scale-95 transition-transform"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const fadeTransition = { duration: 0.2, ease: "easeInOut" };
const fadeProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
  transition: fadeTransition,
};

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError } = useGetMe();

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const isAuthed = !isError && !!user;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {isAuthed ? (
        <motion.div key="authed" {...fadeProps} style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", height: "100dvh" }}>
          <Layout>{children}</Layout>
        </motion.div>
      ) : (
        <motion.div key="unauthed" {...fadeProps} style={{ width: "100%", maxWidth: 480, height: "100dvh", overflowY: "auto", overflowX: "hidden" }}>
          <AuthScreen />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Router() {
  return (
    <AuthGuard>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/rides" component={Rides} />
        <Route path="/costs" component={Costs} />
        <Route path="/goals" component={Goals} />
        <Route path="/reports" component={Reports} />
        <Route path="/upgrade" component={Upgrade} />
        <Route path="/import" component={Import} />
        <Route path="/checkout/success" component={CheckoutSuccess} />
        <Route path="/checkout/cancel" component={CheckoutCancel} />
        <Route path="/pix-payment" component={PixPayment} />
        <Route path="/admin/pix" component={AdminPix} />
        <Route component={NotFound} />
      </Switch>
    </AuthGuard>
  );
}

/**
 * Mounted inside QueryClientProvider.
 * Listens for native app lifecycle events and refreshes data accordingly.
 * No-ops in browser (non-native) environments.
 */
function NativeEventListeners() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle: { remove: () => void } | null = null;

    CapApp.addListener("resume", () => {
      // User returned to the app (e.g., after Stripe payment in system browser).
      // Refresh the user plan so any subscription update is reflected immediately.
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    }).then((h) => {
      handle = h;
    });

    return () => {
      handle?.remove();
    };
  }, [queryClient]);

  return null;
}

function AppShell() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <I18nProvider>
      <SplashScreen show={showSplash} />
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <NativeEventListeners />
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </I18nProvider>
  );
}

export default AppShell;
