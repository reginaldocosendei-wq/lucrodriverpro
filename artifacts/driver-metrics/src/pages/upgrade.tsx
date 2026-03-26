import { useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Lock, Zap, TrendingUp, BarChart2, Target, ChevronRight, ArrowLeft, Shield, Clock, AlertTriangle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const PLANS = [
  {
    id: "monthly",
    label: "Mensal",
    price: "R$\u00a019,90",
    period: "/mês",
    badge: null,
    highlight: false,
  },
  {
    id: "yearly",
    label: "Anual",
    price: "R$\u00a0149,90",
    period: "/ano",
    badge: "Economize 37%",
    highlight: true,
  },
];

const FEATURES = [
  { icon: <TrendingUp size={18} />, text: "Seu lucro real em tempo real" },
  { icon: <BarChart2 size={18} />, text: "Relatórios e análise de desempenho" },
  { icon: <Target size={18} />, text: "Metas avançadas com projeções" },
  { icon: <Zap size={18} />, text: "Insights inteligentes personalizados" },
  { icon: <BarChart2 size={18} />, text: "Simulador de ganhos PRO" },
  { icon: <Shield size={18} />, text: "Histórico completo e exportação" },
];

export default function Upgrade() {
  const { data: user } = useGetMe();
  const [, navigate] = useLocation();
  const [selected, setSelected] = useState<"monthly" | "yearly">("yearly");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const u = user as any;
  const trialExpired = u?.trialExpired === true;
  const isExpiredSearch = typeof window !== "undefined" && window.location.search.includes("expired=1");
  const showExpiredState = trialExpired || isExpiredSearch;

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const productsRes = await fetch(`${BASE}/api/stripe/products-with-prices`, {
        credentials: "include",
      });
      const productsData = await productsRes.json();

      if (!productsData.data || productsData.data.length === 0) {
        setError("Planos não disponíveis no momento. Tente novamente em breve.");
        setIsLoading(false);
        return;
      }

      const product = productsData.data[0];
      const interval = selected === "monthly" ? "month" : "year";
      const price = product.prices?.find(
        (p: any) => p.recurring?.interval === interval,
      );

      if (!price) {
        setError("Plano não encontrado. Tente novamente.");
        setIsLoading(false);
        return;
      }

      const origin = window.location.origin;
      const checkoutRes = await fetch(`${BASE}/api/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          priceId: price.id,
          successUrl: `${origin}${BASE}/checkout/success`,
          cancelUrl:  `${origin}${BASE}/checkout/cancel`,
        }),
      });
      const checkoutData = await checkoutRes.json();

      if (!checkoutRes.ok || !checkoutData.url) {
        setError(checkoutData.error || "Erro ao iniciar pagamento.");
        setIsLoading(false);
        return;
      }

      window.location.href = checkoutData.url;
    } catch {
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
      setIsLoading(false);
    }
  };

  if (u?.plan === "pro" && !u?.trialActive && !trialExpired) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 gap-6"
      >
        <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-3xl flex items-center justify-center shadow-xl shadow-yellow-500/30">
          <Check size={36} className="text-black" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold text-white mb-2">Você já é PRO! ✦</h2>
          <p className="text-white/50 text-sm">Todos os recursos estão desbloqueados para você.</p>
        </div>
        <Link href="/">
          <Button className="gap-2">
            <ArrowLeft size={18} /> Voltar ao painel
          </Button>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pb-20 space-y-0"
    >
      {/* Header — expired state vs. regular */}
      <div className="relative overflow-hidden rounded-3xl mb-6">
        {showExpiredState ? (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-red-900/30 via-orange-900/15 to-transparent" />
            <div className="absolute top-0 right-0 w-72 h-72 bg-red-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
            <div className="relative z-10 p-6 pt-8 text-center">
              <div className="inline-flex items-center gap-2 bg-red-500/15 border border-red-500/30 text-red-400 rounded-full px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest mb-5">
                <AlertTriangle size={12} />
                Teste gratuito encerrado
              </div>
              <h1 className="text-2xl md:text-3xl font-display font-extrabold text-white leading-tight mb-3">
                Não perca acesso ao<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-300 to-orange-400">seu lucro real</span>
              </h1>
              <p className="text-white/50 text-sm leading-relaxed max-w-xs mx-auto">
                Você já viu o poder do Lucro Driver PRO. Continue tendo acesso a todos os recursos que fazem você ganhar mais.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 via-yellow-600/10 to-transparent" />
            <div className="absolute top-0 right-0 w-72 h-72 bg-yellow-500/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
            <div className="relative z-10 p-6 pt-8 text-center">
              <div className="inline-flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded-full px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest mb-5">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                {u?.trialActive ? `Teste ativo — ${u?.trialDaysLeft} dias restantes` : "Lucro Driver PRO"}
              </div>
              {u?.trialActive && (
                <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-orange-300 rounded-full px-3 py-1 text-xs font-semibold mb-4">
                  <Clock size={11} />
                  {u?.trialDaysLeft <= 1
                    ? "Último dia! Não perca seus recursos PRO."
                    : u?.trialDaysLeft <= 3
                    ? `Teste terminando em ${u?.trialDaysLeft} dias. Faça upgrade agora.`
                    : `Aproveite enquanto dura — ${u?.trialDaysLeft} dias restantes`}
                </div>
              )}
              <h1 className="text-2xl md:text-3xl font-display font-extrabold text-white leading-tight mb-3">
                {u?.trialActive
                  ? "Mantenha seu PRO ativo"
                  : <>Você está vendo apenas<br /><span className="text-yellow-400">seu faturamento.</span></>
                }
              </h1>
              <p className="text-white/50 text-sm leading-relaxed max-w-xs mx-auto">
                {u?.trialActive
                  ? "Escolha um plano para não perder acesso ao seu lucro real, relatórios e insights."
                  : "Desbloqueie seu lucro real e saiba exatamente quanto sobra no seu bolso após todos os custos."
                }
              </p>
            </div>
          </>
        )}
      </div>

      {/* Plan Toggle */}
      <div className="flex gap-3 mb-6">
        {PLANS.map((plan) => (
          <button
            key={plan.id}
            onClick={() => setSelected(plan.id as "monthly" | "yearly")}
            className={`flex-1 relative p-4 rounded-2xl border-2 transition-all duration-200 text-left ${
              selected === plan.id
                ? showExpiredState
                  ? "border-red-500/60 bg-red-500/10"
                  : "border-yellow-500 bg-yellow-500/10"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
            }`}
          >
            {plan.badge && (
              <span className="absolute -top-2 right-3 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                {plan.badge}
              </span>
            )}
            <p className="text-xs font-bold text-white/50 uppercase tracking-wide mb-1">{plan.label}</p>
            <p className="text-xl font-display font-extrabold text-white">{plan.price}</p>
            <p className="text-xs text-white/40">{plan.period}</p>
          </button>
        ))}
      </div>

      {/* Features */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 space-y-4">
        <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">O que você vai desbloquear</p>
        {FEATURES.map((f, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
              {f.icon}
            </div>
            <span className="text-sm font-medium text-white">{f.text}</span>
            <Check size={16} className="text-primary ml-auto shrink-0" />
          </div>
        ))}
      </div>

      {/* Payment note */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 mb-6">
        <p className="text-xs text-white/40 text-center leading-relaxed">
          Pagamento via cartão de crédito · Cancele quando quiser · Suporte a PIX em breve
        </p>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            key="upgrade-error"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 mb-4 text-sm text-red-400 text-center"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* CTA */}
      <button
        onClick={handleUpgrade}
        disabled={isLoading}
        className={`w-full h-14 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
          showExpiredState
            ? "bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-red-500/20 hover:from-red-400 hover:to-orange-400"
            : "bg-gradient-to-r from-yellow-400 to-yellow-600 text-black shadow-yellow-500/30 hover:from-yellow-300 hover:to-yellow-500"
        }`}
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
        ) : (
          <>
            {showExpiredState ? <Zap size={20} /> : <Lock size={20} />}
            {showExpiredState ? "Fazer upgrade agora" : "Fazer upgrade para PRO"}
            <ChevronRight size={20} className="ml-auto" />
          </>
        )}
      </button>

      <p className="text-center text-xs text-white/30 mt-3">
        Cancele quando quiser · Pagamento seguro via Stripe
      </p>
    </motion.div>
  );
}
