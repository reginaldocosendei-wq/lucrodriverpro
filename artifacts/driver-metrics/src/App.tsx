import React, { useState, useEffect } from "react";
import { I18nProvider } from "@/lib/i18n";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMe, setAuthTokenGetter } from "@workspace/api-client-react";
import { DEV_DISABLE_AUTH_FETCH, DEV_SKIP_ROUTE_GUARDS } from "@/lib/dev-flags";
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
import PixAuto from "@/pages/pix-auto";
import AdminPix from "@/pages/admin-pix";
import AdminUsers from "@/pages/admin-users";
import Settings from "@/pages/settings";
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

// ─── AUTH BOOTSTRAP LOGS ──────────────────────────────────────────────────────
console.log("[AUTH_BOOTSTRAP_START]");
console.log("[AUTH_BOOTSTRAP_TOKEN] token exists:", !!localStorage.getItem("auth_token"));

// ─── AUTH BYPASS HOOK ──────────────────────────────────────────────────────────
// Always calls useGetMe() (never conditional), but discards the result when
// DEV_DISABLE_AUTH_FETCH is true, returning an instant settled-no-user response.
// Flip the flag in src/lib/dev-flags.ts to re-enable real auth.
type BootAuthResult = ReturnType<typeof useGetMe>;
function useBootAuth(): BootAuthResult {
  // When bypassed, pass enabled:false so the query never fires a network request.
  // We always call the hook (rules of hooks), but the query stays dormant.
  const real = useGetMe(
    DEV_DISABLE_AUTH_FETCH ? { query: { enabled: false } } : undefined
  );

  // Log every state transition for /api/auth/me
  useEffect(() => {
    if (DEV_DISABLE_AUTH_FETCH) return;
    if (real.isPending || real.isLoading) {
      console.log("[AUTH_BOOTSTRAP_ME_START] fetching /api/auth/me...");
    }
    if (real.isSuccess) {
      console.log("[AUTH_BOOTSTRAP_ME_SUCCESS] user exists:", !!real.data);
    }
    if (real.isError) {
      console.log("[AUTH_BOOTSTRAP_ME_ERROR]", (real.error as any)?.message ?? String(real.error));
    }
  }, [real.isPending, real.isLoading, real.isSuccess, real.isError, real.data, real.error]);

  if (DEV_DISABLE_AUTH_FETCH) {
    return {
      ...real,
      data: undefined,
      status: "success" as const,
      isLoading: false,
      isPending: false,
      isFetching: false,
      isSuccess: true,
      isError: false,
    } as unknown as BootAuthResult;
  }
  return real;
}


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
// Waits for auth to settle before deciding — prevents flashing landing page
// when a returning user loads the app with a valid session.
function HomeRoute() {
  const { data: user, isLoading, isPending } = useBootAuth();

  // HARD BLOCK: if auth_token exists in localStorage, the landing page must
  // never render. Redirect to /rides immediately and wait for bootstrap.
  // This prevents the flash of the public page after Google login.
  if (!DEV_DISABLE_AUTH_FETCH && !DEV_SKIP_ROUTE_GUARDS) {
    const hasToken = !!localStorage.getItem("auth_token");
    if (hasToken && !user) {
      console.log("[PUBLIC_PAGE_REASON] token exists — redirecting to /rides instead of showing landing");
      window.location.replace("/rides");
      return null;
    }
  }

  if (DEV_DISABLE_AUTH_FETCH) {
    return (
      <div style={appShellStyle}>
        <Layout><Home /></Layout>
      </div>
    );
  }

  // Debug bypass: always show dashboard — auth query still fires so the
  // debug panel reports live isAuthenticated state (true after login).
  // This isolates session persistence from route-guard timing.
  if (DEV_SKIP_ROUTE_GUARDS) {
    return (
      <div style={appShellStyle}>
        <Layout><Home /></Layout>
      </div>
    );
  }

  // Show spinner while auth is settling.
  // isPending = status==="pending" (TanStack Query v5) — covers both the
  // initial fetch AND the brief idle-pending gap after resetQueries/refetchQueries
  // where isLoading is false but data is still undefined. Without isPending,
  // HomeRoute would briefly render the landing page causing a visual loop.
  if (isPending || isLoading) return <LoadingSpinner />;

  if (!user) {
    console.log("[PUBLIC_PAGE_RENDERED] reason: bootstrap settled, no user, no token");
  }

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
          style={{ width: "100%", height: "100dvh", overflowY: "auto", overflowX: "hidden" }}
        >
          <AuthScreen />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── LOGIN ROUTE ──────────────────────────────────────────────────────────────
// Public route — accessible without auth.
// If auth_token exists in localStorage, redirect to /rides immediately.
// Never renders <AuthScreen /> when a token is present.
function LoginRoute() {
  const { data: user, isLoading } = useBootAuth();
  const [, navigate] = useLocation();

  // HARD BLOCK: token in localStorage means the user is (or was) logged in.
  // Do not render the login page — redirect to /rides to let PrivateGuard
  // validate the token via /api/auth/me.
  if (!DEV_DISABLE_AUTH_FETCH && !DEV_SKIP_ROUTE_GUARDS) {
    const hasToken = !!localStorage.getItem("auth_token");
    if (hasToken && !user) {
      console.log("[PUBLIC_PAGE_REASON] /login: token exists — redirecting to /rides");
      window.location.replace("/rides");
      return null;
    }
  }

  useEffect(() => {
    if (DEV_SKIP_ROUTE_GUARDS) return;
    if (!isLoading && user) {
      navigate("/rides");
    }
  }, [user, isLoading, navigate]);

  console.log("[PUBLIC_PAGE_RENDERED] /login rendered — no token, no user");

  return (
    <div style={{ width: "100%", height: "100dvh", overflowY: "auto", overflowX: "hidden" }}>
      <AuthScreen startWithForm onSuccess={() => navigate("/rides")} />
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
// Wraps private routes. Redirects to "/login" ONLY when:
//   - bootstrap has fully settled (not loading/pending)
//   - AND user is null (no authenticated user)
//   - AND NO auth_token in localStorage
// If a token EXISTS but /api/auth/me is still loading, we WAIT — never kick
// a user with a valid token out to the login page on a slow connection.
function PrivateGuard({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isPending, isError, error } = useBootAuth();
  const [, navigate] = useLocation();
  const [timedOut, setTimedOut] = useState(false);

  // Timeout safety valve: only fires if there is NO token in localStorage.
  // With a token present we keep showing the spinner indefinitely until the
  // network responds — the user is logged in and must not be bounced.
  useEffect(() => {
    if (DEV_DISABLE_AUTH_FETCH || DEV_SKIP_ROUTE_GUARDS) return;
    const hasToken = !!localStorage.getItem("auth_token");
    if (hasToken) return; // never time out a token-holder
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (DEV_DISABLE_AUTH_FETCH || DEV_SKIP_ROUTE_GUARDS) return;
    const hasToken = !!localStorage.getItem("auth_token");
    const settled = (!isPending && !isLoading) || timedOut;

    console.log("[PRIVATE_GUARD_RENDER] token exists:", hasToken, "| user exists:", !!user, "| isLoading:", isLoading, "| isPending:", isPending, "| settled:", settled);

    if (settled && !user) {
      if (hasToken && isError) {
        // Token exists but /api/auth/me returned an error.
        // Log the error but DO NOT redirect — could be a transient network error.
        // Only a hard 401 (which clears the token below) should cause redirect.
        const status = (error as any)?.status ?? (error as any)?.response?.status;
        console.log("[PRIVATE_GUARD_RENDER] /api/auth/me error status:", status);
        if (status === 401) {
          // Server explicitly rejected the token — it's invalid. Clear it and redirect.
          console.log("[PRIVATE_GUARD_REDIRECT] 401 from /api/auth/me — token invalid, clearing and redirecting to /login");
          localStorage.removeItem("auth_token");
          navigate("/login");
        }
        // For other errors (network, 500) keep the spinner — do not kick user out.
        return;
      }
      if (!hasToken) {
        // No token and no user — definitely not logged in.
        console.log("[PRIVATE_GUARD_REDIRECT] no token, no user — redirecting to /login");
        navigate("/login");
      }
    }
  }, [user, isLoading, isPending, timedOut, isError, error, navigate]);

  // Full auth bypass — skip all auth checks.
  if (DEV_DISABLE_AUTH_FETCH) {
    return (
      <div style={appShellStyle}>
        <Layout>{children}</Layout>
      </div>
    );
  }

  // Route-guard bypass — auth query still fires; no redirect is issued.
  if (DEV_SKIP_ROUTE_GUARDS) {
    return (
      <div style={appShellStyle}>
        <Layout>{children}</Layout>
      </div>
    );
  }

  // Show spinner while auth is settling.
  const hasToken = !!localStorage.getItem("auth_token");
  if ((isPending || isLoading) && !user) return <LoadingSpinner />;
  // Token exists but /api/auth/me errored with non-401 — keep spinner, retry in background.
  if (!user && hasToken && isError) return <LoadingSpinner />;
  if (!user) return null;

  console.log("[AUTH_BOOTSTRAP_DONE] user authenticated:", !!user);
  return (
    <div style={appShellStyle}>
      <Layout>{children}</Layout>
    </div>
  );
}

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

      <Route component={NotFound} />
    </Switch>
    </>
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
