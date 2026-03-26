import { useState } from "react";
import { useGetRides } from "@workspace/api-client-react";
import { formatBRL } from "@/lib/utils";
import { Car, Camera, CheckCircle, ChevronDown, ChevronUp, Trash2, TrendingUp, Plus, AlertCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

import { getApiBase } from "@/lib/api";
const BASE = getApiBase();

const PLATFORMS = [
  { value: "uber", label: "Uber", color: "#1a1a1a", text: "#fff" },
  { value: "99", label: "99", color: "#fbbf24", text: "#000" },
  { value: "indriver", label: "InDrive", color: "#00ff88", text: "#000" },
  { value: "outro", label: "Outro", color: "#6b7280", text: "#fff" },
];

function getPlatform(value: string) {
  return PLATFORMS.find(p => p.value === value) || PLATFORMS[3];
}

function dateKey(ts: string | Date) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function friendlyDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (dateKey(today) === key) return "Hoje";
  if (dateKey(yesterday) === key) return "Ontem";
  return date.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
}

interface DayGroup {
  key: string;
  rides: any[];
  totalEarnings: number;
  trips: number;
  platform: string;
}

function groupByDay(rides: any[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const ride of rides) {
    const key = dateKey(ride.createdAt);
    if (!map.has(key)) {
      map.set(key, { key, rides: [], totalEarnings: 0, trips: 0, platform: ride.platform });
    }
    const g = map.get(key)!;
    g.rides.push(ride);
    g.totalEarnings += Number(ride.value);
    g.trips += 1;
  }
  return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
}

export default function Rides() {
  const { data, isLoading, refetch } = useGetRides();
  const queryClient = useQueryClient();

  const [earnings, setEarnings] = useState("");
  const [trips, setTrips] = useState("");
  const [platform, setPlatform] = useState("uber");
  const [saving, setSaving] = useState(false);
  const [savedDay, setSavedDay] = useState<null | { earnings: number; trips: number }>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [deletingDay, setDeletingDay] = useState<string | null>(null);

  const handleSave = async () => {
    setFormError(null);
    const e = parseFloat(earnings.replace(",", "."));
    const t = parseInt(trips);
    if (!e || e <= 0) { setFormError("Informe os ganhos totais do dia"); return; }
    if (!t || t <= 0) { setFormError("Informe o número de corridas"); return; }

    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/rides/daily`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ earnings: e, trips: t, platform }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "Erro ao salvar"); setSaving(false); return; }

      setSavedDay({ earnings: e, trips: t });
      setEarnings("");
      setTrips("");
      await queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      setTimeout(() => setSavedDay(null), 4000);
    } catch {
      setFormError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDay = async (key: string) => {
    setDeletingDay(key);
    try {
      const res = await fetch(`${BASE}/api/rides/day/${key}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setFormError(d.error || "Erro ao remover registros. Tente novamente.");
      } else {
        await queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      }
    } catch (err) {
      console.error("Delete day error:", err);
      setFormError("Erro de conexão ao remover registros.");
    } finally {
      setDeletingDay(null);
    }
  };

  const toggleDay = (key: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const rides = data?.rides || [];
  const groups = groupByDay(rides);
  const totalEarningsAll = rides.reduce((acc: number, r: any) => acc + Number(r.value), 0);
  const totalTripsAll = rides.length;

  if (isLoading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
    </div>
  );

  return (
    <div className="space-y-5 pb-24">

      {/* ─── SUCCESS FEEDBACK ─── */}
      <AnimatePresence>
        {savedDay && (
          <motion.div
            key="success-toast"
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl bg-primary/10 border border-primary/30 p-4 flex items-center gap-4"
          >
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm">Dia registrado com sucesso!</p>
              <p className="text-xs text-white/50 mt-0.5">
                {savedDay.trips} corridas · {formatBRL(savedDay.earnings)} recebidos hoje
              </p>
            </div>
            <button onClick={() => setSavedDay(null)} className="text-white/30 hover:text-white/60">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── DAILY SUMMARY FORM ─── */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#111] p-5 space-y-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Resumo do dia</p>
            <h2 className="text-lg font-display font-bold text-white mt-0.5">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </h2>
          </div>
          <Link href="/import">
            <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold hover:bg-primary/15 transition-colors">
              <Camera size={14} />
              Importar
            </button>
          </Link>
        </div>

        {/* Error */}
        <AnimatePresence>
          {formError && (
            <motion.div
              key="form-error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5"
            >
              <AlertCircle size={14} className="shrink-0" />
              <span className="flex-1">{formError}</span>
              <button onClick={() => setFormError(null)}><X size={12} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Earnings + Trips */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-white/40 uppercase tracking-wide block mb-1.5">
              Total recebido (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm font-bold">R$</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0,00"
                value={earnings}
                onChange={e => setEarnings(e.target.value)}
                className="w-full pl-9 pr-3 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-primary/50 focus:ring-0 outline-none text-white font-display font-bold text-xl placeholder:text-white/15 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-white/40 uppercase tracking-wide block mb-1.5">
              Corridas
            </label>
            <div className="relative">
              <Car size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={trips}
                onChange={e => setTrips(e.target.value)}
                className="w-full pl-8 pr-3 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-primary/50 focus:ring-0 outline-none text-white font-display font-bold text-xl placeholder:text-white/15 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Platform picker */}
        <div>
          <label className="text-xs font-bold text-white/40 uppercase tracking-wide block mb-2">
            Plataforma
          </label>
          <div className="flex gap-2">
            {PLATFORMS.map(p => (
              <button
                key={p.value}
                onClick={() => setPlatform(p.value)}
                className="flex-1 py-2.5 rounded-xl text-xs font-extrabold border transition-all"
                style={{
                  background: platform === p.value ? p.color : "rgba(255,255,255,0.03)",
                  color: platform === p.value ? p.text : "rgba(255,255,255,0.4)",
                  borderColor: platform === p.value ? p.color : "rgba(255,255,255,0.06)",
                  transform: platform === p.value ? "scale(1.04)" : "scale(1)",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Real-time preview */}
        {earnings && parseFloat(earnings.replace(",", ".")) > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="rounded-xl bg-primary/5 border border-primary/15 p-3 grid grid-cols-2 gap-2 text-center"
          >
            <div>
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-wide mb-0.5">Total recebido</p>
              <p className="text-sm font-bold text-primary">
                {formatBRL(parseFloat(earnings.replace(",", ".")))}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-wide mb-0.5">Por corrida</p>
              <p className="text-sm font-bold text-white">
                {trips && parseInt(trips) > 0
                  ? formatBRL(parseFloat(earnings.replace(",", ".")) / parseInt(trips))
                  : "—"}
              </p>
            </div>
          </motion.div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || !earnings || !trips}
          className="w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: (saving || !earnings || !trips)
              ? "rgba(255,255,255,0.04)"
              : "linear-gradient(135deg,#00ff88,#00cc6a)",
            color: (saving || !earnings || !trips) ? "rgba(255,255,255,0.3)" : "#0a0a0a",
          }}
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          ) : (
            <>
              <Plus size={20} strokeWidth={2.5} />
              Salvar resumo do dia
            </>
          )}
        </button>
      </div>

      {/* ─── IMPORT SCREENSHOT CARD ─── */}
      <Link href="/import">
        <motion.div
          whileTap={{ scale: 0.98 }}
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center gap-4 cursor-pointer hover:bg-white/[0.04] transition-colors"
        >
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
            <Camera size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Importar do screenshot</p>
            <p className="text-xs text-white/40 mt-0.5">Tire uma foto do seu app e preenchemos tudo automaticamente</p>
          </div>
          <div className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg shrink-0">IA</div>
        </motion.div>
      </Link>

      {/* ─── STATS STRIP ─── */}
      {groups.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Corridas", value: totalTripsAll.toString(), color: "text-white" },
            { label: "Total recebido", value: formatBRL(totalEarningsAll), color: "text-primary" },
          ].map(stat => (
            <div key={stat.label} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-wide mb-1">{stat.label}</p>
              <p className={`font-display font-bold text-sm tabular-nums ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ─── HISTORY ─── */}
      {groups.length === 0 ? (
        <div className="text-center py-16 text-white/20">
          <Car size={40} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm font-medium">Nenhum dia registrado ainda</p>
          <p className="text-xs mt-1 opacity-60">Registre seus ganhos diários acima</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-bold text-white/30 uppercase tracking-widest px-1">Histórico</p>

          <AnimatePresence>
            {groups.map((group, i) => {
              const plat = getPlatform(group.platform);
              const expanded = expandedDays.has(group.key);
              const isDeleting = deletingDay === group.key;
              const avgPerRide = group.trips > 0 ? group.totalEarnings / group.trips : 0;

              return (
                <motion.div
                  key={group.key}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: Math.min(i * 0.04, 0.2) }}
                >
                  <div className="rounded-2xl bg-[#111] border border-white/[0.06] overflow-hidden">
                    {/* Day header */}
                    <div
                      className="p-4 flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                      onClick={() => toggleDay(group.key)}
                    >
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-xs font-black shrink-0"
                        style={{ background: plat.color, color: plat.text }}
                      >
                        {plat.label === "InDrive" ? "IN" : plat.label.substring(0, 2).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white text-sm">{friendlyDate(group.key)}</p>
                          <span className="text-[10px] text-white/30 font-medium">
                            {new Date(group.key + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-white/40">{group.trips} corridas</span>
                          <span className="text-xs text-white/20">·</span>
                          <span className="text-xs text-white/40">{formatBRL(avgPerRide)}/corrida</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-display font-bold text-primary tabular-nums">{formatBRL(group.totalEarnings)}</p>
                        <p className="text-xs text-white/30 tabular-nums">total recebido</p>
                      </div>

                      <div className="text-white/20 shrink-0 ml-1">
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {expanded && (
                        <motion.div
                          key="day-detail"
                          initial={{ height: 0 }}
                          animate={{ height: "auto" }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 border-t border-white/[0.04]">
                            <div className="grid grid-cols-2 gap-3 mt-4 mb-4">
                              {[
                                { label: "Total recebido", val: formatBRL(group.totalEarnings), color: "text-primary" },
                                { label: "Por corrida", val: formatBRL(avgPerRide), color: "text-white" },
                              ].map(item => (
                                <div key={item.label} className="text-center bg-white/[0.02] rounded-xl p-3">
                                  <p className="text-[10px] text-white/30 font-bold uppercase tracking-wide mb-1">{item.label}</p>
                                  <p className={`font-bold text-sm tabular-nums ${item.color}`}>{item.val}</p>
                                </div>
                              ))}
                            </div>

                            <button
                              onClick={() => {
                                if (confirm(`Remover todos os registros de ${friendlyDate(group.key)}?`)) {
                                  handleDeleteDay(group.key);
                                }
                              }}
                              disabled={isDeleting}
                              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/20 text-red-400/70 text-sm hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/40 transition-all disabled:opacity-40"
                            >
                              {isDeleting ? (
                                <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                              ) : (
                                <Trash2 size={14} />
                              )}
                              Remover registros deste dia
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
