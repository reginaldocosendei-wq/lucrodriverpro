import React, { useState, useEffect } from "react";
import { I18nProvider } from "@/lib/i18n";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
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
import AdminUsers from "@/pages/admin-users";
import Settings from "@/pages/settings";
import AuthScreen from "@/pages/auth";
import ImportTest from "@/pages/import-test";
import LoginTest from "@/pages/login-test";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 3 * 60 * 1000,
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
    console.error("[ErrorBoundary] Crash:", error.message, {
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

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const fadeTransition = { duration: 0.2, ease: "easeInOut" };
const fadeProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
  transition: fadeTransition,
};

const appShellStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 480,
  display: "flex",
  flexDirection: "column",
  height: "100dvh",
};

// ─── SHARED SPINNER ───────────────────────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center">
      <div className="w-12 h-12 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

// ─── HOME ROUTE ───────────────────────────────────────────────────────────────
// "/" shows the landing page if unauthenticated, the dashboard if authenticated.
function HomeRoute() {
  const { data: user, isLoading } = useGetMe();

  console.debug("[HomeRoute]", { isLoading, isAuthed: !!user });

  if (isLoading && !user) return <LoadingSpinner />;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {user ? (
        <motion.div key="authed" {...fadeProps} style={appShellStyle}>
          <Layout><Home /></Layout>
        </motion.div>
      ) : (
        <motion.div
          key="landing"
          {...fadeProps}
          style={{ width: "100%", maxWidth: 480, height: "100dvh", overflowY: "auto", overflowX: "hidden" }}
        >
          <AuthScreen />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── LOGIN ROUTE ──────────────────────────────────────────────────────────────
// Public route — accessible without auth.
// Redirects to "/" if the user is already authenticated.
// After successful login/register it navigates to "/".
// DEV: auth redirect temporarily disabled for desktop nav testing
function LoginRoute() {
  const { data: user, isLoading } = useGetMe();
  const [, navigate] = useLocation();

  console.debug("[LoginRoute]", { isLoading, isAuthed: !!user });

  // DEV_BYPASS: redirect disabled
  // useEffect(() => {
  //   if (!isLoading && user) {
  //     navigate("/");
  //   }
  // }, [user, isLoading, navigate]);

  // DEV_BYPASS: spinner for already-authed users disabled
  // if ((isLoading && !user) || user) return <LoadingSpinner />;
  if (isLoading && !user) return <LoadingSpinner />;

  return (
    <div style={{ width: "100%", maxWidth: 480, margin: "0 auto", height: "100dvh", overflowY: "auto", overflowX: "hidden" }}>
      <AuthScreen startWithForm onSuccess={() => {
        console.debug("[LoginRoute] login success → navigating to /");
        navigate("/");
      }} />
    </div>
  );
}

// ─── IMPORT ROUTE ─────────────────────────────────────────────────────────────
// Semi-public route — accessible without auth.
// The Import page handles its own locked/unlocked state internally.
function ImportRoute() {
  const { data: user } = useGetMe();

  console.debug("[ImportRoute]", { isAuthed: !!user });

  return (
    <div style={appShellStyle}>
      <Layout>
        <Import />
      </Layout>
    </div>
  );
}

// ─── PRIVATE GUARD ────────────────────────────────────────────────────────────
// Wraps private routes. Redirects to "/login" if not authenticated.
function PrivateGuard({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useGetMe();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      console.debug("[PrivateGuard] not authenticated → redirecting to /login", { from: location });
      navigate("/login");
    }
  }, [user, isLoading, navigate, location]);

  if (isLoading && !user) return <LoadingSpinner />;
  if (!user) return null;

  return (
    <div style={appShellStyle}>
      <Layout>{children}</Layout>
    </div>
  );
}

// ─── ROUTER ───────────────────────────────────────────────────────────────────
function Router() {
  const [location] = useLocation();
  console.debug("[Router] current location:", location);

  return (
    <Switch>
      {/* ── DIAGNOSTIC test pages — completely public, no auth, no guards ── */}
      <Route path="/import-test" component={ImportTest} />
      <Route path="/login-test" component={LoginTest} />

      {/* ── Public: login / register ── */}
      <Route path="/login" component={LoginRoute} />

      {/* ── Semi-public: import (auth handled inside the page) ── */}
      <Route path="/import" component={ImportRoute} />

      {/* ── Home: landing if unauthed, dashboard if authed ── */}
      <Route path="/" component={HomeRoute} />

      {/* ── Private routes: redirect to /login if not authenticated ── */}
      <Route path="/rides">
        <PrivateGuard><Rides /></PrivateGuard>
      </Route>
      <Route path="/costs">
        <PrivateGuard><Costs /></PrivateGuard>
      </Route>
      <Route path="/goals">
        <PrivateGuard><Goals /></PrivateGuard>
      </Route>
      <Route path="/reports">
        <PrivateGuard><Reports /></PrivateGuard>
      </Route>
      <Route path="/upgrade">
        <PrivateGuard><Upgrade /></PrivateGuard>
      </Route>
      <Route path="/checkout/success">
        <PrivateGuard><CheckoutSuccess /></PrivateGuard>
      </Route>
      <Route path="/checkout/cancel">
        <PrivateGuard><CheckoutCancel /></PrivateGuard>
      </Route>
      <Route path="/pix-payment">
        <PrivateGuard><PixPayment /></PrivateGuard>
      </Route>
      <Route path="/admin/pix">
        <PrivateGuard><AdminPix /></PrivateGuard>
      </Route>
      <Route path="/admin/users">
        <PrivateGuard><AdminUsers /></PrivateGuard>
      </Route>
      <Route path="/settings">
        <PrivateGuard><Settings /></PrivateGuard>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

// ─── NATIVE EVENT LISTENERS ───────────────────────────────────────────────────
function NativeEventListeners() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle: { remove: () => void } | null = null;

    CapApp.addListener("resume", () => {
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

// ─── APP SHELL ────────────────────────────────────────────────────────────────
function AppShell() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // DEV_BYPASS: splash disabled for desktop nav testing — restore before shipping
    const timer = setTimeout(() => setShowSplash(false), 0);
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
