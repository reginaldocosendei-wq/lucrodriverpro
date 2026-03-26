import { Link, useLocation } from "wouter";
import { Home, Car, Wallet, Target, BarChart2, LogOut, Sparkles, Clock, AlertTriangle, Flame, X } from "lucide-react";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

type TrialUser = {
  trialActive?: boolean;
  trialExpired?: boolean;
  trialDaysLeft?: number;
  trialEndDate?: string | null;
  plan?: string;
  name?: string;
};

interface TrialBannerProps {
  days: number;
  onUpgrade: () => void;
  onDismiss: () => void;
}

function TrialBannerContent({ days, onUpgrade, onDismiss }: TrialBannerProps) {
  const isLastDay = days <= 1;
  const isUrgent = days <= 3;

  const config = isLastDay
    ? {
        bg: "bg-gradient-to-r from-red-950/80 to-red-900/60",
        border: "border-red-500/40",
        icon: <Flame size={15} className="text-red-400 shrink-0" />,
        badge: "bg-red-500/20 text-red-300 border-red-500/30",
        badgeText: "🚨 Último dia!",
        message: "Última chance! Mantenha seus recursos PRO ativos.",
        cta: "Fazer upgrade agora",
        ctaClass: "bg-red-500 hover:bg-red-400 text-white",
        showDismiss: false,
      }
    : isUrgent
    ? {
        bg: "bg-gradient-to-r from-orange-950/80 to-amber-900/60",
        border: "border-orange-500/40",
        icon: <AlertTriangle size={15} className="text-orange-400 shrink-0" />,
        badge: "bg-orange-500/20 text-orange-300 border-orange-500/30",
        badgeText: `⚠️ ${days} dias restantes`,
        message: "Teste terminando. Não perca seu lucro real.",
        cta: "Manter PRO",
        ctaClass: "bg-orange-500 hover:bg-orange-400 text-white",
        showDismiss: false,
      }
    : {
        bg: "bg-gradient-to-r from-yellow-950/60 to-amber-950/40",
        border: "border-yellow-500/20",
        icon: <Clock size={15} className="text-yellow-400 shrink-0" />,
        badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
        badgeText: `Teste PRO — ${days} dias restantes`,
        message: null,
        cta: "Fazer upgrade",
        ctaClass: "bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30",
        showDismiss: true,
      };

  return (
    <div className={`${config.bg} border-b ${config.border}`}>
      <div className="px-4 py-2.5 flex items-center gap-3 max-w-4xl mx-auto">
        {config.icon}
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={`text-[10px] font-extrabold border rounded-full px-2.5 py-0.5 tracking-wide whitespace-nowrap ${config.badge}`}>
            {config.badgeText}
          </span>
          {config.message && (
            <span className="text-xs text-white/50 leading-tight hidden sm:block">{config.message}</span>
          )}
        </div>
        <button
          onClick={onUpgrade}
          className={`text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 transition-colors ${config.ctaClass}`}
        >
          {config.cta}
        </button>
        {config.showDismiss && (
          <button
            onClick={onDismiss}
            className="text-white/30 hover:text-white/60 transition-colors shrink-0 p-1"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { data: user } = useGetMe();
  const logout = useLogout();
  const queryClient = useQueryClient();

  const u = user as TrialUser | undefined;
  const trialActive = u?.trialActive === true;
  const trialExpired = u?.trialExpired === true;
  const trialDaysLeft = u?.trialDaysLeft ?? 7;

  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    setBannerDismissed(false);
  }, [trialDaysLeft]);

  useEffect(() => {
    if (
      trialExpired &&
      !location.startsWith("/upgrade") &&
      !location.startsWith("/checkout")
    ) {
      navigate("/upgrade?expired=1");
    }
  }, [trialExpired, location]);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData(["/api/auth/me"], null);
        queryClient.clear();
      },
    });
  };

  const navItems = [
    { path: "/", icon: Home, label: "Início" },
    { path: "/rides", icon: Car, label: "Corridas" },
    { path: "/costs", icon: Wallet, label: "Custos" },
    { path: "/goals", icon: Target, label: "Metas" },
    { path: "/reports", icon: BarChart2, label: "Relatórios", isPro: true },
  ];

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Bom dia" : currentHour < 18 ? "Boa tarde" : "Boa noite";
  const currentPage = navItems.find((i) => i.path === location);
  const pageTitle = currentPage?.label || "Lucro Driver";
  const getGreetingName = () => u?.name?.split(" ")[0] || "";
  const activeIndex = navItems.findIndex((i) => i.path === location);

  const showBanner = trialActive && !bannerDismissed;

  return (
    <div className="min-h-[100dvh] bg-background pb-24 md:pb-0 md:pl-24">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-primary/20 shadow-[0_4px_30px_rgba(0,255,136,0.05)]">
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl leading-none text-white tracking-tight">
              {pageTitle}
            </h1>
            {user && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-sm font-medium text-muted-foreground">
                  {greeting},{" "}
                  <span className="text-foreground">{getGreetingName()}</span>
                </span>
                {u?.plan === "pro" && (
                  <span className="text-[10px] font-extrabold bg-gradient-to-r from-yellow-400 to-yellow-600 text-black px-2 py-0.5 rounded-sm shadow-[0_0_10px_rgba(255,215,0,0.3)] tracking-wider">
                    {trialActive ? "⏳ TESTE" : "✦ PRO"}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {u?.plan !== "pro" && !trialExpired && (
              <Link href="/upgrade">
                <button className="flex items-center gap-1.5 bg-gradient-to-r from-yellow-400/20 to-yellow-600/10 hover:from-yellow-400/30 border border-yellow-500/30 text-yellow-400 text-[11px] font-extrabold px-3 py-1.5 rounded-full tracking-wider transition-all">
                  <Sparkles size={12} />
                  PRO
                </button>
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-full text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* Trial countdown banner — single motion.div as direct child of AnimatePresence */}
        <AnimatePresence initial={false}>
          {showBanner && (
            <motion.div
              key="trial-banner"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
            >
              <TrialBannerContent
                days={trialDaysLeft}
                onUpgrade={() => navigate("/upgrade")}
                onDismiss={() => setBannerDismissed(true)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content — extra bottom padding for safe area + nav bar */}
      <main
        className="max-w-4xl mx-auto p-4 md:p-8"
        style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {children}
      </main>

      {/* Bottom Navigation (Mobile) / Side Navigation (Desktop) */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 glass-panel border-t border-white/10 md:border-t-0 md:border-r md:top-0 md:w-24 md:flex-col md:justify-center shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex md:flex-col items-center justify-between md:justify-center md:gap-10 h-20 md:h-full px-4 relative max-w-md mx-auto md:max-w-none">
          {navItems.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                href={item.path}
                className="relative flex-1 md:w-full h-full md:h-16 flex items-center justify-center z-10 group"
              >
                <div
                  className={cn(
                    "flex flex-col items-center gap-1.5 transition-all duration-300",
                    isActive
                      ? "text-primary -translate-y-1"
                      : "text-muted-foreground group-hover:text-white group-hover:-translate-y-0.5"
                  )}
                >
                  <div className="relative">
                    <Icon
                      size={24}
                      strokeWidth={isActive ? 2.5 : 2}
                      className={isActive ? "drop-shadow-[0_0_8px_rgba(0,255,136,0.5)]" : ""}
                    />
                    {item.isPro && u?.plan !== "pro" && (
                      <div className="absolute -top-1.5 -right-2 h-3.5 w-3.5 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full border-2 border-background shadow-[0_0_5px_rgba(255,215,0,0.5)]" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold tracking-wide transition-all duration-300",
                      isActive ? "opacity-100" : "opacity-0 md:opacity-70 group-hover:opacity-100"
                    )}
                  >
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}

          {/* Sliding active pill */}
          {activeIndex !== -1 && (
            <div className="absolute md:hidden top-2 bottom-2 left-4 right-4 z-0 pointer-events-none">
              <div className="relative w-full h-full">
                <div
                  className="absolute h-full bg-white/5 rounded-2xl transition-all duration-300 ease-out border border-white/5"
                  style={{
                    width: `${100 / navItems.length}%`,
                    transform: `translateX(${activeIndex * 100}%)`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
