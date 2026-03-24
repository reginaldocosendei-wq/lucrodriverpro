import { useEffect } from "react";
import { useGetGoals, useUpsertGoals, useGetMe } from "@workspace/api-client-react";
import { Button, Input, Label, Card } from "@/components/ui";
import { Target, Lock, Calculator } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const goalSchema = z.object({
  daily: z.coerce.number().min(0),
  weekly: z.coerce.number().min(0),
  monthly: z.coerce.number().min(0),
});

type GoalFormData = z.infer<typeof goalSchema>;

export default function Goals() {
  const { data: user } = useGetMe();
  const { data: goals, isLoading } = useGetGoals();
  const updateMutation = useUpsertGoals();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
        toast({ title: "Metas atualizadas com sucesso!" });
      }
    });
  });

  const isPro = user?.plan === "pro";

  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display font-bold flex items-center gap-3">
          <Target className="text-primary" /> Minhas Metas
        </h2>
        <p className="text-muted-foreground mt-2">Defina seus objetivos financeiros e acompanhe seu progresso no dashboard.</p>
      </div>

      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="text-primary font-bold">Meta Diária (R$)</Label>
              <Input type="number" step="1" className="text-2xl font-bold h-16" {...form.register("daily")} />
            </div>
            <div className="space-y-2">
              <Label>Meta Semanal (R$)</Label>
              <Input type="number" step="1" className="text-xl h-16" {...form.register("weekly")} />
            </div>
            <div className="space-y-2">
              <Label>Meta Mensal (R$)</Label>
              <Input type="number" step="1" className="text-xl h-16" {...form.register("monthly")} />
            </div>
          </div>
          <Button type="submit" className="w-full" size="lg" isLoading={updateMutation.isPending}>
            Salvar Metas
          </Button>
        </form>
      </Card>

      {/* Simulator - PRO Feature */}
      <div className="pt-8">
        <h3 className="text-2xl font-display font-bold flex items-center gap-2 mb-6">
          <Calculator /> Simulador de Ganhos
        </h3>
        
        {isPro ? (
          <Card className="p-6 bg-gradient-to-br from-card to-primary/5 border-primary/20">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <Label>Quantas horas vai rodar por dia?</Label>
                <Input type="number" defaultValue={8} />
                
                <Label>Dias por semana?</Label>
                <Input type="number" defaultValue={5} max={7} />
                
                <Label>Ganho médio estimado por hora (R$)</Label>
                <Input type="number" defaultValue={40} />
              </div>
              <div className="flex flex-col justify-center items-center p-6 bg-black/40 rounded-2xl border border-white/5">
                <p className="text-muted-foreground text-center mb-2">Projeção Mensal Bruta</p>
                <p className="text-5xl font-display font-bold text-primary">R$ 6.400</p>
                <p className="text-sm text-muted-foreground mt-4 text-center">Baseado nos parâmetros ao lado. Custos não inclusos.</p>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-8 relative overflow-hidden text-center group cursor-pointer border-yellow-500/20 hover:border-yellow-500/50 transition-colors">
            <div className="absolute inset-0 bg-[url('/images/pro-bg.png')] bg-cover bg-center opacity-20 group-hover:opacity-30 transition-opacity" />
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center mb-4 glow-gold shadow-xl shadow-yellow-500/20">
                <Lock size={32} className="text-black" />
              </div>
              <h4 className="text-xl font-bold text-white mb-2">Simulador Bloqueado</h4>
              <p className="text-muted-foreground max-w-sm mb-6">Descubra exatamente quanto você precisa rodar para alcançar seus sonhos com a projeção inteligente do PRO.</p>
              <Button variant="gold" size="lg">
                Desbloquear Premium
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
