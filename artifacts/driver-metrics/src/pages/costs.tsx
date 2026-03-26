import { useState } from "react";
import { useGetCosts, useCreateCost, useDeleteCost, useGetDashboardSummary, useGetMe } from "@workspace/api-client-react";
import { formatBRL, formatMonthDay } from "@/lib/utils";
import { Button, Input, Select, Label, Card, Modal } from "@/components/ui";
import { Wallet, Plus, Trash2, Droplet, Coffee, Wrench, Home, Package, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

const costSchema = z.object({
  category: z.enum(["combustivel", "alimentacao", "manutencao", "aluguel", "outros"] as const),
  amount: z.coerce.number().min(0.1, "Valor inválido"),
  description: z.string().min(2, "Descrição necessária"),
  date: z.string(),
});

type CostFormData = z.infer<typeof costSchema>;

const categoryIcons: Record<string, any> = {
  combustivel: <Droplet size={20} className="text-orange-500" />,
  alimentacao: <Coffee size={20} className="text-yellow-500" />,
  manutencao: <Wrench size={20} className="text-blue-500" />,
  aluguel: <Home size={20} className="text-purple-500" />,
  outros: <Package size={20} className="text-gray-500" />,
};

const categoryColors: Record<string, string> = {
  combustivel: "bg-orange-500",
  alimentacao: "bg-yellow-500",
  manutencao: "bg-blue-500",
  aluguel: "bg-purple-500",
  outros: "bg-gray-500",
};

const categoryNames: Record<string, string> = {
  combustivel: "Combustível",
  alimentacao: "Alimentação",
  manutencao: "Manutenção",
  aluguel: "Aluguel",
  outros: "Outros",
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
      category: "combustivel",
      amount: undefined,
      description: "",
      date: format(new Date(), 'yyyy-MM-dd'),
    }
  });

  const onSubmit = form.handleSubmit((data) => {
    setSubmitError(null);
    createMutation.mutate({ data }, {
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
    });
  });

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja remover este gasto? Essa ação não pode ser desfeita.")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/costs"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
        }
      });
    }
  };

  const isFree = user?.plan !== "pro";

  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>;

  const costs = data?.costs || [];
  
  // Calculate category breakdown
  const categoryTotals = costs.reduce((acc, cost) => {
    acc[cost.category] = (acc[cost.category] || 0) + Number(cost.amount);
    return acc;
  }, {} as Record<string, number>);
  
  const totalCostsValue = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
  const costPercentage = dashboard?.earningsMonth ? Math.min(100, (totalCostsValue / dashboard.earningsMonth) * 100) : 0;

  return (
    <div className="space-y-6 pb-10 relative">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-display font-bold">Custos</h2>
        {!isFree && (
          <Button onClick={() => setIsModalOpen(true)} className="gap-2" size="sm" variant="danger">
            <Plus size={18} /> Adicionar
          </Button>
        )}
      </div>

      {/* Hero Summary */}
      <Card className="p-6 bg-gradient-to-br from-destructive/10 to-card border-destructive/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 bg-destructive/10 rounded-full blur-3xl" />
        <div className="text-center relative z-10">
          <p className="text-sm font-bold text-destructive uppercase tracking-widest mb-2">Seus gastos do mês</p>
          <h3 className="text-5xl font-display font-extrabold text-white tabular-nums mb-2">
            {formatBRL(data?.totalMonth || 0)}
          </h3>
          <p className="text-sm text-muted-foreground font-medium">
            = <span className="text-destructive font-bold">{costPercentage.toFixed(1)}%</span> do seu faturamento deste mês
          </p>
        </div>
      </Card>

      {/* Breakdown Bar */}
      {!isFree && totalCostsValue > 0 && (
        <Card className="p-5">
          <h4 className="text-sm font-bold text-muted-foreground mb-4">Como seu dinheiro foi gasto</h4>
          <div className="h-4 w-full bg-black rounded-full overflow-hidden flex border border-white/5 mb-4">
            {Object.entries(categoryTotals).map(([cat, amount]) => {
              const pct = (amount / totalCostsValue) * 100;
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
               .sort((a,b) => b[1] - a[1])
               .filter(([_, amount]) => amount > 0)
               .map(([cat, amount]) => (
                <div key={cat} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${categoryColors[cat]}`} />
                  <span className="capitalize">{categoryNames[cat]}</span>
                  <span className="text-white ml-1">{((amount / totalCostsValue) * 100).toFixed(0)}%</span>
                </div>
             ))}
          </div>
        </Card>
      )}

      {/* Free Plan Paywall Overlay */}
      {isFree ? (
        <div className="relative mt-8">
          {/* Fake content behind blur */}
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
        <div className="space-y-3 mt-8">
          <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-widest px-2">Histórico</h4>
          {costs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
              <Wallet size={48} className="mx-auto mb-4 opacity-20" />
              <p>Nenhum custo registrado este mês.</p>
            </div>
          ) : (
            <AnimatePresence>
              {costs.map((cost, i) => (
                <motion.div
                  key={cost.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors border-l-4 border-transparent hover:border-destructive/50">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shadow-inner">
                        {categoryIcons[cost.category]}
                      </div>
                      <div>
                        <p className="font-bold text-base">{cost.description}</p>
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-wide text-muted-foreground uppercase mt-1">
                          <span>{categoryNames[cost.category]}</span>
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
      )}

      {!isFree && (
        <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSubmitError(null); }} title="Adicionar Custo">
          <form onSubmit={onSubmit} className="space-y-5">
            {submitError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">{submitError}</p>
            )}
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" placeholder="0.00" className="font-display font-bold text-lg h-14" {...form.register("amount")} />
              {form.formState.errors.amount && <p className="text-destructive text-xs mt-1">{form.formState.errors.amount.message}</p>}
            </div>
            
            <div>
              <Label>Categoria</Label>
              <Select className="h-14" {...form.register("category")}>
                {Object.entries(categoryNames).map(([key, name]) => (
                  <option key={key} value={key}>{name}</option>
                ))}
              </Select>
            </div>

            <div>
              <Label>Descrição</Label>
              <Input placeholder="Ex: Gasolina Posto Ipiranga" className="h-14" {...form.register("description")} />
              {form.formState.errors.description && <p className="text-destructive text-xs mt-1">{form.formState.errors.description.message}</p>}
            </div>

            <div>
              <Label>Data</Label>
              <Input type="date" className="h-14" {...form.register("date")} />
            </div>

            <div className="pt-6 mt-6 border-t border-white/10 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="danger" size="lg" isLoading={createMutation.isPending}>Salvar Custo</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}