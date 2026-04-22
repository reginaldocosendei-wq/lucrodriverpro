import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { storeAuthUser, loadAuthUser, clearAuthUser, getApiBase } from "@/lib/api";
import { getGetMeQueryKey } from "@workspace/api-client-react";

export type AuthUser = Record<string, unknown>;

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => void;
  logoutLocal: () => void;
  setTokenAndFetchUser: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: () => {},
  logoutLocal: () => {},
  setTokenAndFetchUser: async () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const booted = useRef(false);

  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("auth_token"),
  );
  const [user, setUser] = useState<AuthUser | null>(() => loadAuthUser());
  const [isLoading, setIsLoading] = useState(true);

  const applyUser = useCallback(
    (u: AuthUser) => {
      storeAuthUser(u);
      setUser(u);
      queryClient.setQueryData(getGetMeQueryKey(), u);
      console.log("[AUTH] user applied to context + cache — plan:", (u as any).plan);
    },
    [queryClient],
  );

  // ── login ──────────────────────────────────────────────────────────────────
  const login = useCallback(
    (newToken: string, newUser: AuthUser) => {
      console.log("[AUTH] login() — token length:", newToken.length);
      localStorage.setItem("auth_token", newToken);
      localStorage.setItem("user_logged", "true");
      setToken(newToken);
      applyUser(newUser);
    },
    [applyUser],
  );

  // ── logoutLocal (call after server logout) ─────────────────────────────────
  const logoutLocal = useCallback(() => {
    console.log("[AUTH] logoutLocal() — clearing all auth state");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_logged");
    clearAuthUser();
    setToken(null);
    setUser(null);
    queryClient.setQueryData(getGetMeQueryKey(), null);
    queryClient.clear();
  }, [queryClient]);

  // ── setTokenAndFetchUser (used by OAuth callback) ──────────────────────────
  const setTokenAndFetchUser = useCallback(
    async (newToken: string): Promise<void> => {
      console.log("[AUTH] setTokenAndFetchUser() — fetching user profile");
      localStorage.setItem("auth_token", newToken);
      localStorage.setItem("user_logged", "true");
      setToken(newToken);

      const base = getApiBase();
      const headers = new Headers({ Authorization: `Bearer ${newToken}` });
      try {
        const r = await fetch(`${base}/api/auth/me`, {
          credentials: "include",
          headers,
          cache: "no-store",
        });
        if (!r.ok) throw new Error(`status ${r.status}`);
        const u = (await r.json()) as AuthUser;
        applyUser(u);
        console.log("[AUTH] setTokenAndFetchUser — success");
      } catch (err) {
        console.warn("[AUTH] setTokenAndFetchUser — fetch failed, using stored user:", err);
        const cached = loadAuthUser();
        if (cached) applyUser(cached);
      }
    },
    [applyUser],
  );

  // ── Boot: verify token on first mount ─────────────────────────────────────
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    const storedToken = localStorage.getItem("auth_token");
    console.log("[AUTH_BOOT] starting — token exists:", !!storedToken);

    if (!storedToken) {
      console.log("[AUTH_BOOT] no token — user is unauthenticated");
      setIsLoading(false);
      return;
    }

    // Pre-seed cache from localStorage immediately so the UI has something
    // to render before the network call completes.
    const cached = loadAuthUser();
    if (cached) {
      queryClient.setQueryData(getGetMeQueryKey(), cached);
      console.log("[AUTH_BOOT] pre-seeded cache from localStorage");
    }

    const base = getApiBase();
    const headers = new Headers({ Authorization: `Bearer ${storedToken}` });

    fetch(`${base}/api/auth/me`, { credentials: "include", headers, cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`/api/auth/me returned ${r.status}`);
        return r.json() as Promise<AuthUser>;
      })
      .then((u) => {
        console.log("[AUTH_BOOT] server verified — plan:", (u as any).plan);
        setToken(storedToken);
        applyUser(u);
      })
      .catch((err) => {
        console.warn("[AUTH_BOOT] server verification failed:", err.message);
        if (cached) {
          // Network error or server down — trust localStorage for offline use
          console.log("[AUTH_BOOT] using cached user (offline/error)");
          setToken(storedToken);
          setUser(cached);
        } else {
          // Token invalid and no cached user — clear everything
          console.log("[AUTH_BOOT] no cached user — forcing logout");
          localStorage.removeItem("auth_token");
          localStorage.removeItem("user_logged");
          clearAuthUser();
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        console.log("[AUTH_BOOT] complete");
        setIsLoading(false);
      });
  }, [applyUser, queryClient]);

  // ── Keep localStorage in sync when React Query refreshes /api/auth/me ──────
  useEffect(() => {
    const unsub = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === "updated" &&
        event.action?.type === "success" &&
        Array.isArray(event.query.queryKey) &&
        event.query.queryKey[0] === "/api/auth/me" &&
        event.query.state.data
      ) {
        const u = event.query.state.data as AuthUser;
        storeAuthUser(u);
        setUser(u);
        console.log("[AUTH_CACHE] refreshed user from server — plan:", (u as any).plan);
      }
    });
    return unsub;
  }, [queryClient]);

  const value: AuthContextValue = {
    token,
    user,
    isAuthenticated: !!token,
    isLoading,
    login,
    logoutLocal,
    setTokenAndFetchUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
