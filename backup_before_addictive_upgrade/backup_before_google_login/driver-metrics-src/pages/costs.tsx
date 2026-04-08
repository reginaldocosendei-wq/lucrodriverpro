import { useState } from "react";
import { useGetCosts, useCreateCost, useDeleteCost, useGetDashboardSummary, useGetMe } from "@workspace/api-client-react";
import { formatBRL, formatMonthDay } from "@/lib/utils";
import { Button, Input, Select, Label, Card, Modal } from "@/components/ui";
import { Wallet, Plus, Trash2, Droplet, Coffee, Wrench, Home, Package, Lock, CalendarClock, Zap } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { useIsDesktop } from "@/lib/useBreakpoint";

const costSchema = z.object({
  costType: z.enum(["variable", "fixed_monthly"]),
  category: z.enum(["combustivel", "alimentacao", "manutencao", "aluguel", "seguro", "outros"] as const),
  amount: z.coerce.number().min(0.1, "Valor inválido"),
  description: z.string().min(2, "Descrição necessária"),
  date: z.string(),
});

type CostFormData = z.infer<typeof costSchema>;

const categoryIcons: Record<string, any> = {
  combustivel: <Droplet size={20} className="text-orange-500" />,
  alimentacao: <Coffee size={20} className="text-yellow-500" />,
  manutencao:  <Wrench size={20} className="text-blue-500" />,
  aluguel:     <Home size={20} className="text-purple-500" />,
  seguro:      <Lock size={20} className="text-indigo-400" />,
  outros:      <Package size={20} className="text-gray-500" />,
};

const categoryColors: Record<string, string> = {
  combustivel: "bg-orange-500",
  alimentacao: "bg-yellow-500",
  manutencao:  "bg-blue-500",
  aluguel:     "bg-purple-500",
  seguro:      "bg-indigo-400",
  outros:      "bg-gray-500",
};

const categoryNames: Record<string, string> = {
  combustivel: "Combustível",
  alimentacao: "Alimentação",
  manutencao:  "Manutenção",
  aluguel:     "Aluguel/Financ.",
  seguro:      "Seguro",
  outros:      "Outros",
};

export default function Costs() {
  const { data: user } = useGetMe();
  const { data: dashboard } = useGetDashboardSummary();
  const { data, isLoading } = useGetCosts();
  const createMutation = useCreateCost();
  const deleteMutation = useDeleteCost();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<CostFormData>({
    resolver: zodResolver(costSchema),
    defaultValues: {
      costType:    "variable",
      category:    "combustivel",
      amount:      undefined,
      description: "",
      date:        format(new Date(), "yyyy-MM-dd"),
    },
  });

  const watchedType = form.watch("costType");

  const onSubmit = form.handleSubmit((data) => {
    setSubmitError(null);
    createMutation.mutate(
      { data: { ...data, costType: data.costType } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/costs"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
          setIsModalOpen(false);
          setSubmitError(null);
          form.reset({ ...form.getValues(), description: "", amount: undefined });
        },
        onError: () => {
          setSubmitError("Erro ao salvar custo. Tente novamente.");
        },
      }
    );
  });

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja remover este gasto? Essa ação não pode ser desfeita.")) {
      deleteMutation.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/costs"] });
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
          },
        }
      );
    }
  };

  const isDesktop = useIsDesktop();
  const isFree = user?.plan !== "pro";

  if (isLoading)
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );

  const costs = data?.costs || [];

  // ── Split by type ──────────────────────────────────────────────────────────
  const variableCosts = costs.filter((c) => ((c as any).costType ?? "variable") !== "fixed_monthly");
  const fixedCosts    = costs.filter((c) => ((c as any).costType ?? "variable") === "fixed_monthly");

  // Fixed monthly totals (not date-filtered — they're recurring)
  const fixedMonthlyTotal   = (data as any)?.fixedMonthlyTotal   ?? fixedCosts.reduce((s, c) => s + Number(c.amount), 0);
  const dailyFixedCostQuota = (data as any)?.dailyFixedCostQuota ?? (fixedMonthlyTotal / 30);

  // Variable breakdown for the bar chart
  const categoryTotals = variableCosts.reduce((acc, cost) => {
    acc[cost.category] = (acc[cost.category] || 0) + Number(cost.amount);
    return acc;
  }, {} as Record<string, number>);
  const totalVariableValue = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

  const costPercentage = dashboard?.earningsMonth
    ? Math.min(100, ((totalVariableValue + fixedMonthlyTotal) / dashboard.earningsMonth) * 100)
    : 0;

  return (
    <div style={{ paddingBottom: 40 }}>

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 style={{ fontSize: isDesktop ? 28 : 24, fontWeight: 800, color: "#f9fafb", letterSpacing: "-0.02em", marginBottom: 4 }}>
            Custos
          </h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>
            Variáveis diários + fixos mensais
          </p>
        </div>
        {!isFree && (
          <Button onClick={() => setIsModalOpen(true)} className="gap-2" size="sm" variant="danger">
            <Plus size={18} /> Adicionar
          </Button>
        )}
      </div>

      {/* ── Desktop: 2-col grid. Mobile: single column ────────────────────── */}
      <div style={isDesktop
        ? { display: "grid", gridTemplateColumns: "minmax(300px, 1fr) minmax(0, 2fr)", gap: 24, alignItems: "start" }
        : { display: "flex", flexDirection: "column", gap: 16 }
      }>

        {/* ── Left column: Summary + breakdown ─────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Hero Summary */}
          <Card className="p-6 bg-gradient-to-br from-destructive/10 to-card border-destructive/20 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-destructive/10 rounded-full blur-3xl" />
            <div className="text-center relative z-10">
              <p className="text-sm font-bold text-destructive uppercase tracking-widest mb-2">Total de custos</p>
              <h3 className="text-5xl font-display font-extrabold text-white tabular-nums mb-2">
                {formatBRL((data?.totalMonth || 0) + fixedMonthlyTotal)}
              </h3>
              <p className="text-sm text-muted-foreground font-medium">
                = <span className="text-destructive font-bold">{costPercentage.toFixed(1)}%</span> do faturamento este mês
              </p>
            </div>
          </Card>

          {/* Fixed monthly cost summary card */}
          {!isFree && fixedMonthlyTotal > 0 && (
            <div style={{
              background: "rgba(99,102,241,0.06)",
              border: "1px solid rgba(99,102,241,0.2)",
              borderRadius: 16,
              padding: "16px 18px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <CalendarClock size={14} color="#818cf8" />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(129,140,248,0.8)", textTransform: "uppercase" }}>
                  Custos fixos mensais
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <p style={{ fontSize: 22, fontWeight: 900, color: "#f9fafb", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                    {formatBRL(fixedMonthlyTotal)}
                  </p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>
                    {fixedCosts.length} item{fixedCosts.length !== 1 ? "s" : ""} recorrente{fixedCosts.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Cota diária</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#818cf8", fontVariantNumeric: "tabular-nums" }}>
                    {formatBRL(dailyFixedCostQuota)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Variable breakdown bar */}
          {!isFree && totalVariableValue > 0 && (
            <Card className="p-5">
              <h4 className="text-sm font-bold text-muted-foreground mb-4">Custos variáveis por categoria</h4>
              <div className="h-4 w-full bg-black rounded-full overflow-hidden flex border border-white/5 mb-4">
                {Object.entries(categoryTotals).map(([cat, amount]) => {
                  const pct = (amount / totalVariableValue) * 100;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={cat}
                      className={`h-full ${categoryColors[cat]}`}
                      style={{ width: `${pct}%` }}
                      title={`${categoryNames[cat]}: ${formatBRL(amount)}`}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-4 text-xs font-medium text-muted-foreground">
                {Object.entries(categoryTotals)
                  .sort((a, b) => b[1] - a[1])
                  .filter(([, amount]) => amount > 0)
                  .map(([cat, amount]) => (
                    <div key={cat} className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${categoryColors[cat]}`} />
                      <span className="capitalize">{categoryNames[cat]}</span>
                      <span className="text-white ml-1">{((amount / totalVariableValue) * 100).toFixed(0)}%</span>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          {/* Category totals (desktop sidebar) */}
          {isDesktop && !isFree && totalVariableValue > 0 && (
            <Card className="p-5">
              <h4 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-widest">Por categoria</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.entries(categoryTotals)
                  .sort((a, b) => b[1] - a[1])
                  .filter(([, amount]) => amount > 0)
                  .map(([cat, amount]) => (
                    <div key={cat} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {categoryIcons[cat]}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{categoryNames[cat]}</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#f87171", fontVariantNumeric: "tabular-nums" }}>{formatBRL(amount)}</span>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </div>

        {/* ── Right column: Cost list / paywall ────────────────────────── */}
        <div>
          {isFree ? (
            /* Free Plan Paywall */
            <div className="relative mt-2">
              <div className="space-y-3 opacity-30 blur-sm select-none pointer-events-none">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-white/5" />
                      <div className="space-y-2">
                        <div className="h-4 w-32 bg-white/10 rounded" />
                        <div className="h-3 w-24 bg-white/5 rounded" />
                      </div>
                    </div>
                    <div className="h-6 w-20 bg-destructive/20 rounded" />
                  </Card>
                ))}
              </div>
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-3xl flex items-center justify-center mb-6 glow-gold shadow-2xl">
                  <Lock size={40} className="text-black" />
                </div>
                <h3 className="text-2xl font-display font-bold text-white mb-2">Você está vendo apenas seu faturamento</h3>
                <p className="text-muted-foreground max-w-sm mb-8 leading-relaxed">
                  Faturamento engana. Descubra quanto realmente sobra no seu bolso após todos os custos com o Lucro Driver PRO.
                </p>
                <Link href="/reports">
                  <Button variant="gold" size="lg" className="px-10 shadow-[0_0_30px_rgba(255,215,0,0.3)]">
                    Desbloquear lucro real
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">

              {/* ── Fixed monthly costs section ─────────────────────────── */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <CalendarClock size={13} color="#818cf8" />
                  <h4 style={{ fontSize: 10, fontWeight: 700, color: "rgba(129,140,248,0.7)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Custos Fixos Mensais
                  </h4>
                </div>
                {fixedCosts.length === 0 ? (
                  <div
                    onClick={() => { form.setValue("costType", "fixed_monthly"); setIsModalOpen(true); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                      border: "1px dashed rgba(99,102,241,0.25)",
                      background: "rgba(99,102,241,0.03)",
                      borderRadius: 16, padding: "14px 18px",
                    }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Plus size={15} color="#818cf8" />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>Adicionar custo fixo</p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Aluguel, seguro, financiamento…</p>
                    </div>
                  </div>
                ) : (
                  <AnimatePresence>
                    {fixedCosts.map((cost, i) => (
                      <motion.div
                        key={cost.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ delay: i * 0.04 }}
                        style={{ marginBottom: 10 }}
                      >
                        <div style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          background: "rgba(99,102,241,0.05)",
                          border: "1px solid rgba(99,102,241,0.15)",
                          borderRadius: 14, padding: "14px 16px",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {categoryIcons[cost.category] ?? <Package size={20} className="text-gray-500" />}
                            </div>
                            <div>
                              <p style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb" }}>{cost.description}</p>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.07em" }}>Fixo</span>
                                <span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "inline-block" }} />
                                <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>
                                  {categoryNames[cost.category] ?? cost.category}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ textAlign: "right" }}>
                              <p style={{ fontSize: 15, fontWeight: 800, color: "#818cf8", fontVariantNumeric: "tabular-nums" }}>{formatBRL(cost.amount)}</p>
                              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>por mês</p>
                            </div>
                            <button
                              onClick={() => handleDelete(cost.id)}
                              style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", borderRadius: 8 }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>

              {/* ── Variable daily costs section ─────────────────────────── */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <Zap size={13} color="rgba(255,255,255,0.4)" />
                  <h4 style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Custos Variáveis
                  </h4>
                </div>
                {variableCosts.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
                    <Wallet size={36} className="mx-auto mb-3 opacity-20" />
                    <p style={{ fontSize: 13 }}>Nenhum custo variável registrado.</p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {variableCosts.map((cost, i) => (
                      <motion.div
                        key={cost.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ delay: i * 0.04 }}
                        style={{ marginBottom: 10 }}
                      >
                        <Card className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors border-l-4 border-transparent hover:border-destructive/50">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shadow-inner">
                              {categoryIcons[cost.category]}
                            </div>
                            <div>
                              <p className="font-bold text-base">{cost.description}</p>
                              <div className="flex items-center gap-2 text-[10px] font-bold tracking-wide text-muted-foreground uppercase mt-1">
                                <span>{categoryNames[cost.category] ?? cost.category}</span>
                                <span className="w-1 h-1 rounded-full bg-white/20" />
                                <span>{formatMonthDay(cost.date)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <p className="font-display font-bold text-lg text-destructive tabular-nums">{formatBRL(cost.amount)}</p>
                            <button
                              onClick={() => handleDelete(cost.id)}
                              className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-destructive rounded-lg transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>

            </div>
          )}
        </div>
      </div>

      {/* ── Add cost modal ────────────────────────────────────────────────────── */}
      {!isFree && (
        <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSubmitError(null); }} title="Adicionar Custo">
          <form onSubmit={onSubmit} className="space-y-5">
            {submitError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">{submitError}</p>
            )}

            {/* ── Cost type toggle ──────────────────────────────────────── */}
            <div>
              <Label>Tipo de custo</Label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
                {(["variable", "fixed_monthly"] as const).map((type) => {
                  const active = watchedType === type;
                  const isFixed = type === "fixed_monthly";
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        form.setValue("costType", type);
                        if (isFixed) form.setValue("category", "aluguel");
                        else form.setValue("category", "combustivel");
                      }}
                      style={{
                        padding: "10px 12px", borderRadius: 12, cursor: "pointer",
                        border: active
                          ? `1.5px solid ${isFixed ? "rgba(99,102,241,0.6)" : "rgba(0,255,136,0.5)"}`
                          : "1.5px solid rgba(255,255,255,0.08)",
                        background: active
                          ? isFixed ? "rgba(99,102,241,0.1)" : "rgba(0,255,136,0.07)"
                          : "rgba(255,255,255,0.02)",
                        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
                        transition: "all 0.15s",
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700, color: active ? (isFixed ? "#818cf8" : "#00ff88") : "rgba(255,255,255,0.55)" }}>
                        {isFixed ? "Fixo mensal" : "Variável"}
                      </span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", lineHeight: 1.3 }}>
                        {isFixed ? "Aluguel, seguro…" : "Combustível, alimentação…"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label>{watchedType === "fixed_monthly" ? "Valor mensal (R$)" : "Valor (R$)"}</Label>
              <Input type="number" step="0.01" placeholder="0.00" className="font-display font-bold text-lg h-14" {...form.register("amount")} />
              {form.formState.errors.amount && <p className="text-destructive text-xs mt-1">{form.formState.errors.amount.message}</p>}
            </div>

            <div>
              <Label>Categoria</Label>
              <Select className="h-14" {...form.register("category")}>
                {watchedType === "fixed_monthly"
                  ? (
                    <>
                      <option value="aluguel">Aluguel / Financiamento</option>
                      <option value="seguro">Seguro</option>
                      <option value="manutencao">Manutenção recorrente</option>
                      <option value="outros">Outros fixos</option>
                    </>
                  ) : (
                    <>
                      <option value="combustivel">Combustível</option>
                      <option value="alimentacao">Alimentação</option>
                      <option value="manutencao">Manutenção</option>
                      <option value="outros">Outros</option>
                    </>
                  )}
              </Select>
            </div>

            <div>
              <Label>Descrição</Label>
              <Input
                placeholder={watchedType === "fixed_monthly" ? "Ex: Aluguel Renault Kwid" : "Ex: Gasolina Posto Ipiranga"}
                className="h-14"
                {...form.register("description")}
              />
              {form.formState.errors.description && <p className="text-destructive text-xs mt-1">{form.formState.errors.description.message}</p>}
            </div>

            {watchedType === "variable" && (
              <div>
                <Label>Data</Label>
                <Input type="date" className="h-14" {...form.register("date")} />
              </div>
            )}

            {watchedType === "fixed_monthly" && (
              <div style={{
                padding: "10px 14px", borderRadius: 10,
                background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)",
              }}>
                <p style={{ fontSize: 12, color: "rgba(129,140,248,0.8)", lineHeight: 1.5 }}>
                  Custos fixos são debitados <strong>diariamente</strong> do seu lucro como uma cota diária: <strong>valor mensal ÷ 30</strong>.
                </p>
              </div>
            )}

            <div className="pt-6 mt-6 border-t border-white/10 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button
                type="submit"
                variant={watchedType === "fixed_monthly" ? "ghost" : "danger"}
                size="lg"
                isLoading={createMutation.isPending}
                style={watchedType === "fixed_monthly" ? {
                  background: "rgba(99,102,241,0.15)",
                  border: "1px solid rgba(99,102,241,0.3)",
                  color: "#818cf8",
                } : undefined}
              >
                Salvar Custo
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
