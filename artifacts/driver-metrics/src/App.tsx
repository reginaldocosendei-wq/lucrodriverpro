import React, { useState, useEffect } from "react";
import { I18nProvider } from "@/lib/i18n";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter, getGetMeQueryKey } from "@workspace/api-client-react";
import { loadAuthUser, storeAuthUser, clearAuthUser } from "@/lib/api";
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
import PixAuto from "@/pages/pix-auto";
import AdminPix from "@/pages/admin-pix";
import AdminUsers from "@/pages/admin-users";
import Settings from "@/pages/settings";
import Assistant from "@/pages/assistant";
import AuthScreen from "@/pages/auth";
import AuthSuccess from "@/pages/auth-success";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";

// ─── JWT TOKEN BOOTSTRAP ───────────────────────────────────────────────────────
// Runs synchronously at module-load time, before any component renders or any
// React Query fires. This guarantees the Bearer token is in localStorage by the
// time GET /api/auth/me is called on first render.
//
// Two sources (in priority order):
//   1. ?token=<jwt> URL param — set by Google OAuth redirect
//      (/rides?token=JWT_TOKEN). Captured, stored, and stripped from URL.
//   2. localStorage "auth_token" — already present from a previous login.
{
  const _params = new URLSearchParams(window.location.search);
  const _urlToken = _params.get("token");
  if (_urlToken) {
    localStorage.setItem("auth_token", _urlToken);
    console.log("[auth] token captured from URL → stored in localStorage");
    _params.delete("token");
    const _newSearch = _params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (_newSearch ? "?" + _newSearch : "") + window.location.hash,
    );
  }
}

// Wire JWT getter into customFetch — every API call will now include
// Authorization: Bearer <token> automatically, regardless of cookie state.
setAuthTokenGetter(() => localStorage.getItem("auth_token"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 3 * 60 * 1000,
    },
  },
});

// ─── Pre-seed user cache from localStorage ─────────────────────────────────────
// If the user is logged in and we have a previously stored user object (written
// after each successful login / register / Google-auth), seed the React Query
// cache so every useGetMe() call returns the correct plan immediately — even if
// GET /api/auth/me is slow, cached by a browser, or temporarily unreachable.
// The cache will be refreshed from the server after staleTime (3 min) and also
// whenever the queryClient is invalidated (e.g. checkout-success page).
{
  const storedUser = loadAuthUser();
  if (storedUser) {
    queryClient.setQueryData(getGetMeQueryKey(), storedUser);
    console.log("[AUTH_BOOTSTRAP] pre-seeded user cache from localStorage — plan:", (storedUser as any).plan);
  }
}

// Keep localStorage in sync whenever /api/auth/me is freshly fetched from server.
queryClient.getQueryCache().subscribe((event) => {
  if (
    event.type === "updated" &&
    event.action?.type === "success" &&
    Array.isArray(event.query.queryKey) &&
    event.query.queryKey[0] === "/api/auth/me" &&
    event.query.state.data
  ) {
    storeAuthUser(event.query.state.data as Record<string, unknown>);
    console.log("[AUTH_CACHE] stored refreshed user to localStorage — plan:", (event.query.state.data as any).plan);
  }
});

// ─── AUTH BOOTSTRAP LOGS ──────────────────────────────────────────────────────
console.log("[AUTH_BOOTSTRAP_START]");
console.log("[AUTH_BOOTSTRAP_TOKEN] token exists:", !!localStorage.getItem("auth_token"));


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
// "/" shows the dashboard if authenticated, landing page if not.
function HomeRoute() {
  const token = localStorage.getItem("auth_token");
  const isLogged = localStorage.getItem("user_logged");

  if (token && isLogged) {
    return (
      <div style={appShellStyle}>
        <Layout><Home /></Layout>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100dvh", overflowY: "auto", overflowX: "hidden" }}>
      <AuthScreen />
    </div>
  );
}

// ─── LOGIN ROUTE ──────────────────────────────────────────────────────────────
// Public route — redirects to dashboard if already authenticated.
function LoginRoute() {
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    const isLogged = localStorage.getItem("user_logged");
    if (token && isLogged) {
      window.location.href = "/";
    }
  }, []);

  const token = localStorage.getItem("auth_token");
  const isLogged = localStorage.getItem("user_logged");
  if (token && isLogged) return <LoadingSpinner />;

  return (
    <div style={{ width: "100%", height: "100dvh", overflowY: "auto", overflowX: "hidden" }}>
      <AuthScreen startWithForm />
    </div>
  );
}

// ─── IMPORT ROUTE ─────────────────────────────────────────────────────────────
// Semi-public route — accessible without auth.
// The Import page handles its own locked/unlocked state internally.
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
// Simple localStorage-only check. No API call, no loading state.
function PrivateGuard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("auth_token");
  const isLogged = localStorage.getItem("user_logged");

  if (!token || !isLogged) {
    window.location.href = "/login";
    return <LoadingSpinner />;
  }

  return (
    <div style={appShellStyle}>
      <Layout>{children}</Layout>
    </div>
  );
}

// ─── DOWNLOAD REDIRECT ────────────────────────────────────────────────────────
const DownloadRedirect = () => {
  window.location.href = "/api/download";
  return null;
};

// ─── ROUTER ───────────────────────────────────────────────────────────────────
function Router() {
  return (
    <>
    <Switch>
      {/* ── OAuth callback — captures token from URL, stores it, redirects ── */}
      <Route path="/auth-success" component={AuthSuccess} />

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

      <Route path="/download" component={DownloadRedirect} />

      <Route component={NotFound} />
    </Switch>
    </>
  );
}

// ─── USER BOOTSTRAP ───────────────────────────────────────────────────────────
// Runs once on mount. If the user is authenticated but their data is NOT yet
// in localStorage (e.g. first load after deployment, before any new login),
// this fetches /api/auth/me via authFetch (proven to reach the server) and
// seeds both the queryClient cache and localStorage — so every useGetMe() call
// in the app returns the correct plan without depending on customFetch.
function UserBootstrap() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;                      // Not logged in
    const already = loadAuthUser();
    if (already) return;                     // Already seeded — skip

    const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)
      ? (import.meta.env.VITE_API_BASE_URL as string).replace(/\/+$/, "")
      : import.meta.env.BASE_URL.replace(/\/+$/, "");

    const headers = new Headers({ Authorization: `Bearer ${token}` });
    fetch(`${base}/api/auth/me`, { credentials: "include", headers, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((user: Record<string, unknown> | null) => {
        if (!user) return;
        storeAuthUser(user);
        queryClient.setQueryData(getGetMeQueryKey(), user);
        console.log("[USER_BOOTSTRAP] fetched and stored user — plan:", (user as any).plan);
      })
      .catch(() => {/* silent fallback — stale localStorage or pre-seeded cache will cover */});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
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
    const timer = setTimeout(() => setShowSplash(false), 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <I18nProvider>
      <SplashScreen show={showSplash} />
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <UserBootstrap />
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
