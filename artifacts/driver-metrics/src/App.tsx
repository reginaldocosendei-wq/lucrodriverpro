import React, { useState, useEffect } from "react";
import { I18nProvider } from "@/lib/i18n";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { SplashScreen } from "@/components/SplashScreen";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { storageSetSync, storageGetSync } from "@/lib/storage";

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
import PixAuto from "@/pages/pix-auto";
import AdminPix from "@/pages/admin-pix";
import AdminUsers from "@/pages/admin-users";
import Settings from "@/pages/settings";
import Assistant from "@/pages/assistant";
import AuthScreen from "@/pages/auth";
import AuthSuccess from "@/pages/auth-success";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";

// ─── JWT TOKEN BOOTSTRAP ──────────────────────────────────────────────────────
// Capture ?token=<jwt> from OAuth redirect before anything renders.
// storageSetSync writes to in-memory cache + localStorage immediately, and
// fires a background write to native Preferences (if on Android).
{
  const _params = new URLSearchParams(window.location.search);
  const _urlToken = _params.get("token");
  if (_urlToken) {
    storageSetSync("auth_token",  _urlToken);
    storageSetSync("user_logged", "true");
    console.log("[auth] token captured from URL → stored in storage");
    _params.delete("token");
    const _newSearch = _params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (_newSearch ? "?" + _newSearch : "") + window.location.hash,
    );
  }
}

// Wire JWT getter — uses in-memory cache so it's always synchronous.
// storageInit() in AuthProvider populates the cache at boot.
setAuthTokenGetter(() => storageGetSync("auth_token"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 3 * 60 * 1000,
    },
  },
});

// ─── ERROR BOUNDARY ───────────────────────────────────────────────────────────
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
const appShellStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  height: "100dvh",
};

// ─── SHARED LOADING SCREEN ────────────────────────────────────────────────────
function AuthLoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#080808",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.1)",
          marginBottom: 8,
        }}
      >
        <img
          src={`${import.meta.env.BASE_URL}icon.svg`}
          alt="Lucro Driver"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          draggable={false}
        />
      </div>
      <div
        style={{
          width: 36,
          height: 36,
          border: "3px solid rgba(0,255,136,0.15)",
          borderTopColor: "#00ff88",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── HOME ROUTE ───────────────────────────────────────────────────────────────
// Shows dashboard if authenticated; landing/auth page if not.
// Waits for auth to finish loading before deciding.
function HomeRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  if (isLoading) {
    console.log("[HomeRoute] auth still loading — showing loading screen");
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    console.log("[HomeRoute] authenticated — showing dashboard");
    return (
      <div style={appShellStyle}>
        <Layout>
          <Home />
        </Layout>
      </div>
    );
  }

  console.log("[HomeRoute] unauthenticated — showing landing page");
  return (
    <div style={{ width: "100%", height: "100dvh", overflowY: "auto", overflowX: "hidden" }}>
      <AuthScreen
        onSuccess={(token, user) => {
          // authLogin() was already called synchronously inside AuthForm (setToken fired).
          // isAuthenticated is now true — just navigate.
          console.log("[HomeRoute] onSuccess — navigating to /");
          navigate("/");
        }}
      />
    </div>
  );
}

// ─── LOGIN ROUTE ──────────────────────────────────────────────────────────────
// Public route — redirects to dashboard if already authenticated.
function LoginRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      console.log("[LoginRoute] already authenticated — redirecting to /");
      navigate("/");
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) return <AuthLoadingScreen />;
  if (isAuthenticated) return <AuthLoadingScreen />;

  return (
    <div style={{ width: "100%", height: "100dvh", overflowY: "auto", overflowX: "hidden" }}>
      <AuthScreen
        startWithForm
        onSuccess={(token, user) => {
          // authLogin() was already called synchronously inside AuthForm (setToken fired).
          // isAuthenticated is now true — just navigate.
          console.log("[LoginRoute] onSuccess — navigating to /");
          navigate("/");
        }}
      />
    </div>
  );
}

// ─── IMPORT ROUTE ─────────────────────────────────────────────────────────────
// Semi-public route — the Import page manages its own locked/unlocked state.
function ImportRoute() {
  return (
    <div style={appShellStyle}>
      <Layout>
        <Import />
      </Layout>
    </div>
  );
}

// ─── PRIVATE GUARD ────────────────────────────────────────────────────────────
// Protects routes that require authentication.
// Shows loading screen while auth is being checked.
// Redirects to /login if unauthenticated.
function PrivateGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      console.log("[PrivateGuard] not authenticated — redirecting to /login");
      navigate("/login");
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    console.log("[PrivateGuard] auth loading — holding route");
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    console.log("[PrivateGuard] unauthenticated — showing loading while redirect happens");
    return <AuthLoadingScreen />;
  }

  console.log("[PrivateGuard] authenticated — rendering protected content");
  return (
    <div style={appShellStyle}>
      <Layout>{children}</Layout>
    </div>
  );
}

// ─── ROUTER ───────────────────────────────────────────────────────────────────
function Router() {
  return (
    <Switch>
      {/* OAuth callback — captures token from URL */}
      <Route path="/auth-success" component={AuthSuccess} />

      {/* Public: login / register */}
      <Route path="/login" component={LoginRoute} />

      {/* Semi-public: import (auth handled inside the page) */}
      <Route path="/import" component={ImportRoute} />

      {/* Home: landing if unauthed, dashboard if authed */}
      <Route path="/" component={HomeRoute} />

      {/* Private routes */}
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
      <Route path="/pix-auto">
        <PrivateGuard><PixAuto /></PrivateGuard>
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
      <Route path="/assistant">
        <PrivateGuard><Assistant /></PrivateGuard>
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
      console.log("[native] app resumed — refreshing user query");
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
    const timer = setTimeout(() => setShowSplash(false), 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <I18nProvider>
      <SplashScreen show={showSplash} />
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TooltipProvider>
              <NativeEventListeners />
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </I18nProvider>
  );
}

export default AppShell;
