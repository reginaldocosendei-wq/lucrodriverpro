import { useEffect, useState } from "react";
import { useGetGoals, useUpsertGoals, useGetMe, useGetDashboardSummary } from "@workspace/api-client-react";
import { Button, Input, Label, Card } from "@/components/ui";
import { Target, Lock, Calculator, TrendingUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { formatBRL } from "@/lib/utils";
import { Link } from "wouter";

const goalSchema = z.object({
  daily: z.coerce.number().min(0),
  weekly: z.coerce.number().min(0),
  monthly: z.coerce.number().min(0),
});

type GoalFormData = z.infer<typeof goalSchema>;

export default function Goals() {
  const { data: user } = useGetMe();
  const { data: goals, isLoading } = useGetGoals();
  const { data: summary } = useGetDashboardSummary();
  const updateMutation = useUpsertGoals();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [horas, setHoras] = useState(8);
  const [dias, setDias] = useState(5);
  const [ganhoHora, setGanhoHora] = useState(40);

  const projecaoMensal = horas * dias * 4.33 * ganhoHora;

  const form = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: { daily: 0, weekly: 0, monthly: 0 }
  });

  useEffect(() => {
    if (goals) {
      form.reset({
        daily: goals.daily,
        weekly: goals.weekly,
        monthly: goals.monthly,
      });
    }
  }, [goals, form]);

  const onSubmit = form.handleSubmit((data) => {
    updateMutation.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
        toast({ title: "Suas metas foram salvas com sucesso!" });
      },
      onError: () => {
        toast({ title: "Erro ao salvar metas. Tente novamente.", variant: "destructive" });
      },
    });
  });

  const isPro = user?.plan === "pro";

  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-10 pb-10">
      <div>
        <h2 className="text-3xl font-display font-bold flex items-center gap-3">
          <Target className="text-primary" /> Minhas Metas
        </h2>
        <p className="text-muted-foreground mt-2 font-medium">Defina seus objetivos de ganhos e acompanhe seu progresso no painel.</p>
      </div>

      <Card className="p-6 bg-gradient-to-br from-card to-white/[0.02]">
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <Label className="text-primary font-bold uppercase tracking-wider text-[10px]">Sua meta diária (R$)</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-display font-bold">R$</span>
                <Input type="number" step="1" className="font-display text-2xl font-bold h-16 pl-12 bg-black/40 border-white/10 focus-visible:border-primary" {...form.register("daily")} />
              </div>
              {summary && goals && goals.daily > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 bg-black rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, summary.goalDailyPct)}%` }} />
                  </div>
                  <span className="text-xs font-bold text-primary">{Math.round(summary.goalDailyPct)}%</span>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <Label className="uppercase tracking-wider text-[10px] font-bold text-muted-foreground">Meta semanal (R$)</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-display font-bold">R$</span>
                <Input type="number" step="1" className="font-display text-xl font-bold h-16 pl-12 bg-black/40 border-white/5 focus-visible:border-white/20" {...form.register("weekly")} />
              </div>
              {summary && goals && goals.weekly > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 bg-black rounded-full overflow-hidden">
                    <div className="h-full bg-white/50" style={{ width: `${Math.min(100, summary.goalWeeklyPct)}%` }} />
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">{Math.round(summary.goalWeeklyPct)}%</span>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <Label className="uppercase tracking-wider text-[10px] font-bold text-muted-foreground">Meta mensal (R$)</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-display font-bold">R$</span>
                <Input type="number" step="1" className="font-display text-xl font-bold h-16 pl-12 bg-black/40 border-white/5 focus-visible:border-white/20" {...form.register("monthly")} />
              </div>
              {summary && goals && goals.monthly > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 bg-black rounded-full overflow-hidden">
                    <div className="h-full bg-white/50" style={{ width: `${Math.min(100, summary.goalMonthlyPct)}%` }} />
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">{Math.round(summary.goalMonthlyPct)}%</span>
                </div>
              )}
            </div>
          </div>
          <Button type="submit" className="w-full md:w-auto mt-6" size="lg" isLoading={updateMutation.isPending}>
            Salvar Metas
          </Button>
        </form>
      </Card>

      {/* Simulator - PRO Feature */}
      <div className="pt-4">
        <h3 className="text-2xl font-display font-bold flex items-center gap-2 mb-6">
          <Calculator className="text-yellow-500" /> Simulador de Ganhos
        </h3>
        
        {isPro ? (
          <Card className="p-6 bg-gradient-to-br from-card to-primary/5 border-primary/20 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
            <div className="grid md:grid-cols-2 gap-10 relative z-10">
              <div className="space-y-8">
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-bold text-white">Horas por dia</Label>
                    <span className="font-display font-bold text-primary">{horas}h</span>
                  </div>
                  <input 
                    type="range" min="1" max="16" step="1" 
                    value={horas} onChange={(e) => setHoras(Number(e.target.value))}
                    className="w-full h-2 bg-black rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-bold text-white">Dias por semana</Label>
                    <span className="font-display font-bold text-primary">{dias} dias</span>
                  </div>
                  <input 
                    type="range" min="1" max="7" step="1" 
                    value={dias} onChange={(e) => setDias(Number(e.target.value))}
                    className="w-full h-2 bg-black rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-bold text-white">Ganho médio por hora</Label>
                    <span className="font-display font-bold text-primary">{formatBRL(ganhoHora)}</span>
                  </div>
                  <input 
                    type="range" min="15" max="100" step="5" 
                    value={ganhoHora} onChange={(e) => setGanhoHora(Number(e.target.value))}
                    className="w-full h-2 bg-black rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

              </div>
              <div className="flex flex-col justify-center items-center p-8 bg-black/60 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent" />
                <div className="relative z-10 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 text-primary mb-4">
                    <TrendingUp size={24} />
                  </div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">Projeção de faturamento mensal</p>
                  <p className="text-5xl md:text-6xl font-display font-extrabold text-white tabular-nums drop-shadow-[0_0_15px_rgba(0,255,136,0.3)] text-gradient">
                    {formatBRL(projecaoMensal)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-4 max-w-[200px] mx-auto font-medium">
                    Estimativa bruta. Comissões das plataformas e custos não incluídos.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Link href="/reports">
            <Card className="p-8 relative overflow-hidden text-center group cursor-pointer border-yellow-500/20 hover:border-yellow-500/50 transition-colors">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-10" />
              
              {/* Blurred background mockup */}
              <div className="grid md:grid-cols-2 gap-8 opacity-20 blur-sm pointer-events-none">
                <div className="space-y-6">
                  <div className="h-4 bg-white/20 rounded w-full" />
                  <div className="h-4 bg-white/20 rounded w-3/4" />
                  <div className="h-4 bg-white/20 rounded w-full" />
                </div>
                <div className="h-40 bg-white/10 rounded-2xl" />
              </div>

              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-3xl flex items-center justify-center mb-4 glow-gold shadow-2xl shadow-yellow-500/20">
                  <Lock size={40} className="text-black" />
                </div>
                <h4 className="text-2xl font-display font-bold text-white mb-2">Simulador de Ganhos PRO</h4>
                <p className="text-muted-foreground max-w-sm mb-6 leading-relaxed">Descubra exatamente quanto você precisa rodar para atingir seus objetivos. Simule cenários e planeje sua semana com inteligência.</p>
                <Button variant="gold" size="lg" className="px-8 shadow-[0_0_20px_rgba(255,215,0,0.3)]">
                  Desbloquear simulador
                </Button>
              </div>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}