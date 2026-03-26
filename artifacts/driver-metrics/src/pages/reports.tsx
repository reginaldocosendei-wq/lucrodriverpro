import { useState } from "react";
import { useGetEarningsReport, useGetMe } from "@workspace/api-client-react";
import { Card } from "@/components/ui";
import { BarChart2, Lock, TrendingUp, Users, Zap, CheckCircle, AlertCircle, X, Camera } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/90 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl">
        <p className="font-bold text-white mb-3 text-sm">{label}</p>
        <div className="space-y-2">
          {payload.map((entry: any) => (
            <div key={entry.dataKey} className="flex items-center justify-between gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-muted-foreground font-medium">{entry.name}</span>
              </div>
              <span className="font-bold tabular-nums text-white">{formatBRL(entry.value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

export default function Reports() {
  const { data: user } = useGetMe();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: reports, isLoading } = useGetEarningsReport({
    query: { enabled: user?.plan === "pro" }
  });

  const [trialLoading, setTrialLoading] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);
  const [trialSuccess, setTrialSuccess] = useState(false);

  const isPro = user?.plan === "pro";

  const handleStartTrial = async () => {
    setTrialLoading(true);
    setTrialError(null);
    try {
      const res = await fetch(`${BASE}/api/auth/trial/start`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setTrialError(data.error || "Algo deu errado. Tente novamente.");
        setTrialLoading(false);
        return;
      }
      setTrialSuccess(true);
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      }, 800);
    } catch (err) {
      console.error("Start trial error:", err);
      setTrialError("Algo deu errado. Tente novamente.");
    } finally {
      setTrialLoading(false);
    }
  };

  if (!isPro) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center py-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 to-background z-0" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-yellow-500/10 blur-[100px] rounded-full z-0 pointer-events-none" />

        {/* Blurred fake charts in background */}
        <div className="absolute inset-0 z-0 opacity-20 flex flex-col gap-8 p-4 blur-sm pointer-events-none select-none">
          <div className="h-64 border border-white/10 rounded-3xl bg-white/[0.02] flex items-end justify-between px-8 pb-8 pt-20">
            {[40, 70, 45, 90, 60, 100, 80].map((h, i) => (
              <div key={i} className="w-12 bg-white/20 rounded-t-lg" style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-48 border border-white/10 rounded-3xl bg-white/[0.02]" />
            <div className="h-48 border border-white/10 rounded-3xl bg-white/[0.02]" />
          </div>
        </div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="relative z-10 max-w-lg w-full bg-black/60 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-yellow-500/20">
            <Lock size={48} className="text-black" />
          </div>

          <div className="inline-flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-4">
            <Users size={14} className="text-yellow-500" />
            <span className="text-xs font-bold text-white">Mais de 5.000 motoristas já usam o PRO</span>
          </div>

          <h2 className="text-3xl md:text-4xl font-display font-extrabold text-white mb-3 tracking-tight">
            Relatórios <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600">PRO</span>
          </h2>

          <p className="text-sm text-white/50 mb-2 leading-relaxed">
            Você está vendo apenas dados básicos. Desbloqueie relatórios completos com PRO e descubra seu lucro real.
          </p>

          <p className="text-base text-white/70 mb-6 font-medium leading-relaxed">
            Motoristas com relatórios avançados ganham em média <strong className="text-white">23% mais</strong>.
          </p>

          {/* Error */}
          <AnimatePresence>
            {trialError && (
              <motion.div
                key="trial-error"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/30 p-3 mb-4 text-sm text-red-400 text-left"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span className="flex-1">{trialError}</span>
                <button onClick={() => setTrialError(null)} className="text-red-400/60 hover:text-red-400">
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success toast */}
          <AnimatePresence>
            {trialSuccess && (
              <motion.div
                key="trial-success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 rounded-xl bg-primary/10 border border-primary/30 p-4 mb-4 text-sm text-primary text-left"
              >
                <CheckCircle size={20} className="shrink-0 text-primary" />
                <div>
                  <p className="font-bold text-white mb-0.5">Teste ativado com sucesso!</p>
                  <p className="text-white/60 text-xs">Seu período de teste gratuito de 7 dias foi iniciado. Aproveite os recursos PRO!</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-3">
            <button
              onClick={handleStartTrial}
              disabled={trialLoading || trialSuccess}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-extrabold text-base flex items-center justify-center gap-2 shadow-xl shadow-yellow-500/30 hover:from-yellow-300 hover:to-yellow-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {trialLoading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : trialSuccess ? (
                <>
                  <CheckCircle size={20} />
                  Teste ativado!
                </>
              ) : (
                <>
                  <Zap size={20} />
                  Experimentar grátis por 7 dias
                </>
              )}
            </button>

            <button
              onClick={() => navigate("/upgrade")}
              className="w-full h-12 rounded-2xl border border-white/10 bg-white/[0.02] text-white/60 hover:text-white hover:bg-white/[0.05] font-semibold text-sm flex items-center justify-center gap-2 transition-all"
            >
              Ver todos os planos
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isLoading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500" />
    </div>
  );
  if (!reports) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-10">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-full text-[10px] font-extrabold uppercase tracking-widest mb-4 shadow-[0_0_10px_rgba(255,215,0,0.1)]">
          {(user as any)?.trialActive ? "⏳ MODO TESTE - " + (user as any)?.trialDaysLeft + " DIAS RESTANTES" : "✦ RECURSO PRO ATIVO"}
        </div>
        {(user as any)?.trialActive && (
          <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
            <span className="text-xs text-yellow-500/80">Teste gratuito ativo — faça upgrade para não perder acesso</span>
            <button
              onClick={() => navigate("/upgrade")}
              className="text-xs font-bold text-yellow-400 hover:text-yellow-300 transition-colors ml-3 shrink-0"
            >
              Fazer upgrade →
            </button>
          </div>
        )}
        <h2 className="text-3xl font-display font-bold flex items-center gap-3">
          <BarChart2 className="text-primary" /> Análise de Desempenho
        </h2>
      </div>

      <Card className="p-6 md:p-8 bg-card/50">
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-display font-bold text-xl flex items-center gap-2">
            <TrendingUp size={20} className="text-primary" /> Evolução Diária <span className="text-muted-foreground text-sm font-medium ml-2">(Últimos 30 dias)</span>
          </h3>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={reports.daily} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: '#737373', fontSize: 10, fontWeight: 600 }} tickLine={false} axisLine={false} dy={10} />
              <YAxis tickFormatter={(val) => `R$${val}`} tick={{ fill: '#737373', fontSize: 10, fontWeight: 600 }} tickLine={false} axisLine={false} dx={-10} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }} />
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 600 }} iconType="circle" />
              <Line type="monotone" dataKey="earnings" name="Ganhos" stroke="#00ff88" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: "#00ff88", stroke: "#000", strokeWidth: 2 }} />
              <Line type="monotone" dataKey="costs" name="Custos" stroke="#ff4444" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: "#ff4444", stroke: "#000", strokeWidth: 2 }} />
              <Line type="monotone" dataKey="profit" name="Lucro Real" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: "#3b82f6", stroke: "#000", strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6 md:p-8 bg-card/50">
          <h3 className="font-display font-bold text-xl mb-8">Ganhos por Plataforma</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reports.byPlatform} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tickFormatter={(val) => `R$${val}`} tick={{ fill: '#737373', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="platform" type="category" tick={{ fill: '#fff', fontSize: 11, fontWeight: 'bold' }} axisLine={false} tickLine={false} dx={-10} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                <Bar dataKey="earnings" name="Ganhos Brutos" fill="#00ff88" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 md:p-8 bg-card/50">
          <h3 className="font-display font-bold text-xl mb-8">Melhores Dias da Semana</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reports.byDayOfWeek} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#737373', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tickFormatter={(val) => `R$${val}`} tick={{ fill: '#737373', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} dx={-10} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                <Bar dataKey="earnings" name="Média de Ganhos" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
