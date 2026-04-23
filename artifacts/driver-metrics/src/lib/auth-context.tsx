import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getApiBase } from "@/lib/api";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import {
  storageInit,
  storageGet,
  storageSet,
  storageRemove,
  storageGetSync,
  storageSetSync,
  storageRemoveSync,
} from "@/lib/storage";

export type AuthUser = Record<string, unknown>;

// Keys we persist in Preferences / localStorage
const KEY_TOKEN  = "auth_token";
const KEY_LOGGED = "user_logged";
const KEY_USER   = "auth_user";
const BOOT_KEYS  = [KEY_TOKEN, KEY_LOGGED, KEY_USER];

// ── Helpers ────────────────────────────────────────────────────────────────────
function loadCachedUser(): AuthUser | null {
  try {
    const s = storageGetSync(KEY_USER);
    return s ? (JSON.parse(s) as AuthUser) : null;
  } catch {
    return null;
  }
}

async function saveUser(u: AuthUser): Promise<void> {
  await storageSet(KEY_USER, JSON.stringify(u));
}

async function clearAllAuth(): Promise<void> {
  await Promise.all([
    storageRemove(KEY_TOKEN),
    storageRemove(KEY_LOGGED),
    storageRemove(KEY_USER),
  ]);
}

function clearAllAuthSync(): void {
  storageRemoveSync(KEY_TOKEN);
  storageRemoveSync(KEY_LOGGED);
  storageRemoveSync(KEY_USER);
}

// ── Context type ───────────────────────────────────────────────────────────────
interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logoutLocal: () => void;
  setTokenAndFetchUser: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logoutLocal: () => {},
  setTokenAndFetchUser: async () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const booted      = useRef(false);

  // Start with unknown state — storageInit populates these during boot
  const [token,     setToken]     = useState<string | null>(null);
  const [user,      setUser]      = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── applyUser: update React state + QueryClient + storage ──────────────────
  const applyUser = useCallback(
    async (u: AuthUser) => {
      setUser(u);
      queryClient.setQueryData(getGetMeQueryKey(), u);
      await saveUser(u);
      console.log("[AUTH] user applied — plan:", (u as any).plan);
    },
    [queryClient],
  );

  // ── login: called after successful email/password/google auth ──────────────
  const login = useCallback(
    async (newToken: string, newUser: AuthUser): Promise<void> => {
      console.log("[AUTH] login() — token length:", newToken.length);
      // Update React state immediately so the UI responds without waiting for storage
      setToken(newToken);
      setUser(newUser);
      queryClient.setQueryData(getGetMeQueryKey(), newUser);
      // Await storage writes — ensures the token is on disk before the caller
      // navigates away. On Android this is critical: if the app is killed before
      // Preferences.set() completes the token is lost and the user is logged out
      // on next launch. (~5–20 ms on device, imperceptible to the user.)
      await Promise.all([
        storageSet(KEY_TOKEN,  newToken),
        storageSet(KEY_LOGGED, "true"),
        saveUser(newUser),
      ]);
      console.log("[AUTH] login() — state updated + storage written, isAuthenticated: true");
    },
    [queryClient],
  );

  // ── logoutLocal: clear all auth state ──────────────────────────────────────
  const logoutLocal = useCallback(() => {
    console.log("[AUTH] logoutLocal() — clearing all auth state");
    clearAllAuthSync();
    setToken(null);
    setUser(null);
    queryClient.setQueryData(getGetMeQueryKey(), null);
    queryClient.clear();
  }, [queryClient]);

  // ── setTokenAndFetchUser: for OAuth callback (only token arrives in URL) ───
  const setTokenAndFetchUser = useCallback(
    async (newToken: string): Promise<void> => {
      console.log("[AUTH] setTokenAndFetchUser()");
      await Promise.all([
        storageSet(KEY_TOKEN,  newToken),
        storageSet(KEY_LOGGED, "true"),
      ]);
      setToken(newToken);

      const base    = getApiBase();
      const headers = new Headers({ Authorization: `Bearer ${newToken}` });
      try {
        const r = await fetch(`${base}/api/auth/me`, {
          credentials: "include",
          headers,
          cache: "no-store",
        });
        if (!r.ok) throw new Error(`status ${r.status}`);
        const u = (await r.json()) as AuthUser;
        await applyUser(u);
        console.log("[AUTH] setTokenAndFetchUser — success");
      } catch (err) {
        console.warn("[AUTH] setTokenAndFetchUser — fetch failed:", err);
        const cached = loadCachedUser();
        if (cached) await applyUser(cached);
      }
    },
    [applyUser],
  );

  // ── Boot: load token from storage, then verify with server ─────────────────
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    // Safety escape hatch — no matter what goes wrong, loading must resolve
    // within 12 seconds so the user never sees a permanent black screen.
    const safetyTimer = setTimeout(() => {
      console.error("[AUTH_BOOT] ⚠️  safety escape — isLoading stuck, forcing false after 12s");
      setIsLoading(false);
    }, 12_000);

    (async () => {
      try {
        // 1. Load all auth keys from native Preferences (or localStorage on web)
        //    Wrapped in try/catch — if the Preferences plugin isn't ready on some
        //    Android versions, we still continue rather than hanging forever.
        try {
          await storageInit(BOOT_KEYS);
        } catch (storageErr) {
          console.error("[AUTH_BOOT] storageInit failed — continuing with empty cache:", storageErr);
        }

        const storedToken = storageGetSync(KEY_TOKEN);
        console.log("[AUTH_BOOT] storage loaded — token exists:", !!storedToken);

        if (!storedToken) {
          console.log("[AUTH_BOOT] no token — unauthenticated");
          setIsLoading(false);
          return;
        }

        // 2. Pre-seed UI from cached user (instant, no flicker)
        const cached = loadCachedUser();
        if (cached) {
          setUser(cached);
          queryClient.setQueryData(getGetMeQueryKey(), cached);
          console.log("[AUTH_BOOT] pre-seeded from cache — plan:", (cached as any).plan);
        }

        // 3. Verify token with server — 8-second timeout so the app never
        //    hangs if the network is unavailable, flaky, or the server is slow.
        const base       = getApiBase();
        const headers    = new Headers({ Authorization: `Bearer ${storedToken}` });
        const controller = new AbortController();
        const fetchTimer = setTimeout(() => {
          controller.abort();
          console.warn("[AUTH_BOOT] fetch timed out after 8s — keeping stored credentials");
        }, 8_000);

        try {
          const r = await fetch(`${base}/api/auth/me`, {
            credentials: "include",
            headers,
            cache: "no-store",
            signal: controller.signal,
          });
          clearTimeout(fetchTimer);

          if (r.status === 401) {
            // Server explicitly rejected the token → force logout
            console.log("[AUTH_BOOT] 401 — token invalid, clearing auth");
            await clearAllAuth();
            setToken(null);
            setUser(null);
            queryClient.setQueryData(getGetMeQueryKey(), null);
            setIsLoading(false);
            return;
          }

          if (!r.ok) throw new Error(`server-error:${r.status}`);

          const ct = r.headers.get("content-type") ?? "";
          if (!ct.includes("application/json")) {
            throw new Error(`unexpected content-type: ${ct}`);
          }

          const u = (await r.json()) as AuthUser;
          console.log("[AUTH_BOOT] server verified — plan:", (u as any).plan);
          setToken(storedToken);
          await applyUser(u);

        } catch (fetchErr) {
          clearTimeout(fetchTimer);
          const msg = (fetchErr as Error).message;
          // AbortError = our 8s timeout fired; other errors = network/offline
          // In ALL cases: keep the stored token and use cached user data.
          // Never force-logout due to a network failure — that would be terrible UX.
          console.warn("[AUTH_BOOT] server check skipped — keeping stored credentials:", msg);
          setToken(storedToken);
          if (cached) setUser(cached);
          // If no cached user, token alone is enough — profile loads on first API call
        }

      } catch (outerErr) {
        // Catch-all: something completely unexpected happened during boot.
        // Still render the app — better to show the landing page than a black screen.
        console.error("[AUTH_BOOT] unexpected error during boot:", outerErr);
      }

      setIsLoading(false);
      clearTimeout(safetyTimer);
      console.log("[AUTH_BOOT] complete");
    })();
  }, [applyUser, queryClient]);

  // ── Sync QueryClient cache back to storage on server-side refreshes ─────────
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
        setUser(u);
        saveUser(u).catch(() => {});
        console.log("[AUTH_CACHE] server refresh stored — plan:", (u as any).plan);
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
