import React from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMe } from "@workspace/api-client-react";
import { AnimatePresence, motion } from "framer-motion";

import Home from "@/pages/Home";
import Rides from "@/pages/rides";
import Costs from "@/pages/costs";
import Goals from "@/pages/goals";
import Reports from "@/pages/reports";
import Upgrade from "@/pages/upgrade";
import Import from "@/pages/Import";
import CheckoutSuccess from "@/pages/checkout-success";
import CheckoutCancel from "@/pages/checkout-cancel";
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
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("App error:", error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-white font-bold text-lg">Algo deu errado</p>
          <p className="text-white/50 text-sm">Recarregue a página para continuar.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-6 py-3 bg-primary text-black font-bold rounded-xl text-sm"
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const fadeTransition = { duration: 0.18, ease: "easeInOut" };
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin glow-primary" />
      </div>
    );
  }

  const isAuthed = !isError && !!user;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {isAuthed ? (
        <motion.div key="authed" {...fadeProps} style={{ minHeight: "100vh" }}>
          <Layout>{children}</Layout>
        </motion.div>
      ) : (
        <motion.div key="unauthed" {...fadeProps}>
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
        <Route component={NotFound} />
      </Switch>
    </AuthGuard>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
