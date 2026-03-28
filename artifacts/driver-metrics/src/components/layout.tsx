import { Link, useLocation } from "wouter";
import { Home, Car, Wallet, Target, BarChart2, LogOut, Sparkles, Clock, AlertTriangle, Flame, X, Settings } from "lucide-react";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useT, LANG_OPTIONS, type Lang } from "@/lib/i18n";
import { useIsDesktop } from "@/lib/useBreakpoint";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type TrialUser = {
  trialActive?: boolean;
  trialExpired?: boolean;
  trialDaysLeft?: number;
  trialEndDate?: string | null;
  plan?: string;
  name?: string;
};

// ─── NAV ITEMS ────────────────────────────────────────────────────────────────
const NAV_DEFS = [
  { path: "/",        Icon: Home,     key: "nav.home" },
  { path: "/rides",   Icon: Car,      key: "nav.rides" },
  { path: "/costs",   Icon: Wallet,   key: "nav.costs" },
  { path: "/goals",   Icon: Target,   key: "nav.goals" },
  { path: "/reports", Icon: BarChart2, key: "nav.reports", isPro: true },
];

// ─── TRIAL BANNER ─────────────────────────────────────────────────────────────
function TrialBanner({ days, onUpgrade, onDismiss }: { days: number; onUpgrade: () => void; onDismiss: () => void }) {
  const { t } = useT();
  const isLastDay = days <= 1;
  const isUrgent  = days <= 3;

  const cfg = isLastDay ? {
    bg: "rgba(127,29,29,0.7)", border: "rgba(239,68,68,0.3)",
    icon: <Flame size={13} color="#f87171" />,
    badge: { bg: "rgba(239,68,68,0.15)", color: "#f87171", border: "rgba(239,68,68,0.25)" },
    text: t("layout.trialLastDay"), cta: t("layout.upgradeNow"), ctaColor: "#ef4444", dismiss: false,
  } : isUrgent ? {
    bg: "rgba(120,53,15,0.7)", border: "rgba(251,146,60,0.25)",
    icon: <AlertTriangle size={13} color="#fb923c" />,
    badge: { bg: "rgba(251,146,60,0.12)", color: "#fb923c", border: "rgba(251,146,60,0.22)" },
    text: t("layout.trialUrgent", { days }), cta: t("layout.keepPro"), ctaColor: "#f97316", dismiss: false,
  } : {
    bg: "rgba(66,32,6,0.6)", border: "rgba(234,179,8,0.15)",
    icon: <Clock size={13} color="#eab308" />,
    badge: { bg: "rgba(234,179,8,0.08)", color: "#ca8a04", border: "rgba(234,179,8,0.18)" },
    text: t("layout.trialNormal", { days }), cta: t("layout.upgrade"), ctaColor: "#eab308", dismiss: true,
  };

  return (
    <div style={{
      background: cfg.bg, borderBottom: `1px solid ${cfg.border}`,
      backdropFilter: "blur(12px)",
      padding: "8px 16px",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      {cfg.icon}
      <div style={{
        display: "inline-flex", alignItems: "center",
        background: cfg.badge.bg, border: `1px solid ${cfg.badge.border}`,
        borderRadius: 999, padding: "3px 10px",
        fontSize: 10, fontWeight: 700, color: cfg.badge.color, letterSpacing: "0.05em",
        flexShrink: 0,
      }}>
        {cfg.text}
      </div>
      <div style={{ flex: 1 }} />
      <button
        onClick={onUpgrade}
        style={{
          background: `${cfg.ctaColor}18`, border: `1px solid ${cfg.ctaColor}40`,
          borderRadius: 999, padding: "5px 12px",
          fontSize: 11, fontWeight: 700, color: cfg.ctaColor,
          cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
        }}
      >
        {cfg.cta}
      </button>
      {cfg.dismiss && (
        <button onClick={onDismiss} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 4 }}>
          <X size={12} />
        </button>
      )}
    </div>
  );
}

// ─── LANGUAGE PICKER ──────────────────────────────────────────────────────────
function LangPicker() {
  const { lang, setLang, t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = LANG_OPTIONS.find((l) => l.id === lang)!;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={t("layout.language")}
        style={{
          width: 36, height: 36, borderRadius: 12,
          background: open ? "rgba(0,255,136,0.08)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${open ? "rgba(0,255,136,0.2)" : "rgba(255,255,255,0.07)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", fontSize: 15, transition: "all 0.15s ease",
        }}
      >
        {current.flag}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0,
              background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 14, padding: "6px", zIndex: 200,
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              minWidth: 150,
            }}
          >
            {LANG_OPTIONS.map((opt) => {
              const isActive = opt.id === lang;
              return (
                <button
                  key={opt.id}
                  onClick={() => { setLang(opt.id as Lang); setOpen(false); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 12px", borderRadius: 10, border: "none",
                    background: isActive ? "rgba(0,255,136,0.08)" : "transparent",
                    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 16 }}>{opt.flag}</span>
                  <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? "#00ff88" : "rgba(255,255,255,0.65)" }}>
                    {opt.label}
                  </span>
                  {isActive && (
                    <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#00ff88", flexShrink: 0 }} />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── DESKTOP NAV LINKS ────────────────────────────────────────────────────────
function DesktopNav({ location, plan, t }: { location: string; plan?: string; t: (k: string) => string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {NAV_DEFS.map((nav) => {
        const isActive = location === nav.path;
        const { Icon } = nav;
        return (
          <Link key={nav.path} href={nav.path} style={{ textDecoration: "none" }}>
            <motion.div
              whileHover={{ background: isActive ? undefined : "rgba(255,255,255,0.04)" }}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "8px 14px", borderRadius: 12, cursor: "pointer",
                background: isActive ? "rgba(0,255,136,0.08)" : "transparent",
                border: `1px solid ${isActive ? "rgba(0,255,136,0.15)" : "transparent"}`,
                transition: "background 0.15s ease, border-color 0.15s ease",
                position: "relative",
              }}
            >
              <Icon
                size={15}
                color={isActive ? "#00ff88" : "rgba(255,255,255,0.45)"}
                strokeWidth={isActive ? 2.5 : 2}
                style={{ filter: isActive ? "drop-shadow(0 0 4px rgba(0,255,136,0.5))" : "none", flexShrink: 0 }}
              />
              <span style={{
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                color: isActive ? "#00ff88" : "rgba(255,255,255,0.5)",
                whiteSpace: "nowrap",
              }}>
                {t(nav.key)}
              </span>
              {nav.isPro && plan !== "pro" && (
                <span style={{
                  fontSize: 8, fontWeight: 800, letterSpacing: "0.08em",
                  color: "#eab308",
                  background: "rgba(234,179,8,0.1)",
                  border: "1px solid rgba(234,179,8,0.2)",
                  padding: "1px 5px", borderRadius: 4,
                }}>
                  PRO
                </span>
              )}
            </motion.div>
          </Link>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT
// ═══════════════════════════════════════════════════════════════════════════════
export function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { data: user }       = useGetMe();
  const logout               = useLogout();
  const queryClient          = useQueryClient();
  const { t }                = useT();
  const isDesktop            = useIsDesktop();
  const u = user as TrialUser | undefined;

  const trialActive   = u?.trialActive === true;
  const trialExpired  = u?.trialExpired === true;
  const trialDaysLeft = u?.trialDaysLeft ?? 7;
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const showBanner = trialActive && !bannerDismissed;

  useEffect(() => { setBannerDismissed(false); }, [trialDaysLeft]);
  useEffect(() => {
    if (trialExpired && !location.startsWith("/upgrade") && !location.startsWith("/checkout")) {
      navigate("/upgrade?expired=1");
    }
  }, [trialExpired, location]);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => { queryClient.setQueryData(["/api/auth/me"], null); queryClient.clear(); },
    });
  };

  return (
    <div style={{ width: "100%", height: "100%", background: "#080808", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header style={{
        flexShrink: 0,
        zIndex: 40,
        background: "rgba(8,8,8,0.97)",
        backdropFilter: "blur(24px) saturate(1.8)",
        WebkitBackdropFilter: "blur(24px) saturate(1.8)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.03), 0 4px 32px rgba(0,0,0,0.5)",
      }}>
        <div style={{
          padding: isDesktop ? "12px 40px" : "14px 20px",
          display: "flex", alignItems: "center",
          maxWidth: isDesktop ? 1280 : undefined,
          margin: "0 auto", width: "100%",
          boxSizing: "border-box",
        }}>

          {/* ── Wordmark ──────────────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: "linear-gradient(135deg, #00ff88, #00cc6a)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,255,136,0.3)",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 16 }}>💰</span>
            </div>
            <div>
              <span style={{ fontSize: 16, fontWeight: 900, color: "#f9fafb", letterSpacing: "-0.02em" }}>
                Lucro{" "}
                <span style={{ color: "#00ff88" }}>Driver</span>
              </span>
              {u?.plan === "pro" && (
                <div style={{
                  display: "inline-block", marginLeft: 8,
                  background: "linear-gradient(135deg, #eab308, #ca8a04)",
                  color: "#000", fontSize: 8, fontWeight: 800,
                  padding: "2px 6px", borderRadius: 4, letterSpacing: "0.08em",
                  verticalAlign: "middle",
                }}>
                  {trialActive ? t("layout.trialBadge") : "PRO"}
                </div>
              )}
            </div>
          </div>

          {/* ── Desktop nav (center) ─────────────────────────────────────── */}
          {isDesktop ? (
            <div style={{ flex: 1, display: "flex", justifyContent: "center", paddingLeft: 24, paddingRight: 24 }}>
              <DesktopNav location={location} plan={u?.plan} t={t} />
            </div>
          ) : (
            <div style={{ flex: 1 }} />
          )}

          {/* ── Actions ───────────────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {u?.plan !== "pro" && !trialExpired && (
              <Link href="/upgrade">
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    background: "rgba(234,179,8,0.1)",
                    border: "1px solid rgba(234,179,8,0.28)",
                    borderRadius: 20, padding: "6px 12px",
                    cursor: "pointer",
                  }}
                >
                  <Sparkles size={11} color="#eab308" />
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#eab308", letterSpacing: "0.06em" }}>PRO</span>
                </motion.div>
              </Link>
            )}

            <LangPicker />

            <Link href="/settings">
              <motion.div
                whileTap={{ scale: 0.92 }}
                style={{
                  width: 36, height: 36, borderRadius: 12,
                  background: location === "/settings" ? "rgba(0,255,136,0.08)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${location === "/settings" ? "rgba(0,255,136,0.2)" : "rgba(255,255,255,0.07)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                title="Configurações"
              >
                <Settings size={16} color={location === "/settings" ? "#00ff88" : "rgba(255,255,255,0.45)"} />
              </motion.div>
            </Link>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleLogout}
              style={{
                width: 36, height: 36, borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
              title={t("layout.logout")}
            >
              <LogOut size={16} color="rgba(255,255,255,0.45)" />
            </motion.button>
          </div>
        </div>

        {/* Trial banner */}
        <AnimatePresence initial={false}>
          {showBanner && (
            <motion.div
              key="trial-banner"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
            >
              <TrialBanner
                days={trialDaysLeft}
                onUpgrade={() => navigate("/upgrade")}
                onDismiss={() => setBannerDismissed(true)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Page content ────────────────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        width: "100%",
        boxSizing: "border-box",
      }}>
        <div style={{
          maxWidth: 1280,
          width: "100%",
          margin: "0 auto",
          padding: isDesktop ? "28px 40px 40px" : "20px 16px 24px",
          boxSizing: "border-box",
        }}>
          {children}
        </div>
      </main>

      {/* ── Bottom tab bar — mobile only ────────────────────────────────────── */}
      {!isDesktop && (
        <nav style={{
          flexShrink: 0,
          zIndex: 50,
          background: "rgba(8,8,8,0.97)",
          backdropFilter: "blur(28px) saturate(1.8)",
          WebkitBackdropFilter: "blur(28px) saturate(1.8)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 -1px 0 rgba(255,255,255,0.03), 0 -8px 32px rgba(0,0,0,0.6)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
          <div style={{
            height: 64,
            display: "flex", alignItems: "stretch",
            padding: "0 8px",
            position: "relative",
          }}>
            {NAV_DEFS.map((nav) => {
              const isActive = location === nav.path;
              const { Icon } = nav;

              return (
                <Link key={nav.path} href={nav.path} style={{ flex: 1, textDecoration: "none" }}>
                  <motion.div
                    whileTap={{ scale: 0.88 }}
                    style={{
                      height: "100%",
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      gap: 4, position: "relative",
                      cursor: "pointer",
                    }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="tab-active-bg"
                        style={{
                          position: "absolute",
                          top: 10, left: "50%",
                          x: "-50%",
                          width: 48, height: 32,
                          borderRadius: 12,
                          background: "rgba(0,255,136,0.1)",
                          border: "1px solid rgba(0,255,136,0.15)",
                        }}
                        transition={{ type: "spring", damping: 22, stiffness: 300 }}
                      />
                    )}

                    <div style={{ position: "relative", zIndex: 1 }}>
                      <motion.div
                        animate={{ color: isActive ? "#00ff88" : "rgba(255,255,255,0.35)" }}
                        transition={{ duration: 0.2 }}
                      >
                        <Icon
                          size={20}
                          strokeWidth={isActive ? 2.5 : 2}
                          color={isActive ? "#00ff88" : "rgba(255,255,255,0.35)"}
                          style={{
                            filter: isActive ? "drop-shadow(0 0 6px rgba(0,255,136,0.5))" : "none",
                            transition: "filter 0.2s ease, color 0.2s ease",
                          }}
                        />
                      </motion.div>

                      {nav.isPro && u?.plan !== "pro" && (
                        <div style={{
                          position: "absolute", top: -3, right: -5,
                          width: 6, height: 6, borderRadius: "50%",
                          background: "#eab308",
                          boxShadow: "0 0 6px rgba(234,179,8,0.6)",
                          border: "1.5px solid #080808",
                        }} />
                      )}
                    </div>

                    <motion.span
                      animate={{ opacity: isActive ? 1 : 0.35, color: isActive ? "#00ff88" : "#fff" }}
                      transition={{ duration: 0.2 }}
                      style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", lineHeight: 1, position: "relative", zIndex: 1 }}
                    >
                      {t(nav.key)}
                    </motion.span>

                    {isActive && (
                      <motion.div
                        layoutId="tab-dot"
                        style={{
                          width: 4, height: 4, borderRadius: "50%",
                          background: "#00ff88",
                          boxShadow: "0 0 8px rgba(0,255,136,0.7)",
                          position: "absolute",
                          bottom: 6,
                        }}
                        transition={{ type: "spring", damping: 22, stiffness: 300 }}
                      />
                    )}
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

    </div>
  );
}
