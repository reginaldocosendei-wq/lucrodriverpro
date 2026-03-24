import { useState } from "react";
import { useGetCosts, useCreateCost, useDeleteCost } from "@workspace/api-client-react";
import { formatBRL, formatMonthDay } from "@/lib/utils";
import { Button, Input, Select, Label, Card, Modal } from "@/components/ui";
import { Wallet, Plus, Trash2, Droplet, Coffee, Wrench, Home, Package } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

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

const categoryNames: Record<string, string> = {
  combustivel: "Combustível",
  alimentacao: "Alimentação",
  manutencao: "Manutenção",
  aluguel: "Aluguel",
  outros: "Outros",
};

export default function Costs() {
  const { data, isLoading } = useGetCosts();
  const createMutation = useCreateCost();
  const deleteMutation = useDeleteCost();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    createMutation.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/costs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
        setIsModalOpen(false);
        form.reset({ ...form.getValues(), description: "", amount: undefined });
      }
    });
  });

  const handleDelete = (id: number) => {
    if (confirm("Excluir este custo?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/costs"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
        }
      });
    }
  };

  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>;

  const costs = data?.costs || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-display font-bold">Custos</h2>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2" size="sm" variant="danger">
          <Plus size={18} /> Adicionar
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 bg-destructive/5 border-destructive/20 text-center">
          <p className="text-xs text-muted-foreground mb-1">Hoje</p>
          <p className="font-bold text-destructive">{formatBRL(data?.totalDay)}</p>
        </Card>
        <Card className="p-4 bg-destructive/5 border-destructive/20 text-center">
          <p className="text-xs text-muted-foreground mb-1">Semana</p>
          <p className="font-bold text-destructive">{formatBRL(data?.totalWeek)}</p>
        </Card>
        <Card className="p-4 bg-destructive/10 border-destructive/30 text-center">
          <p className="text-xs text-destructive/80 mb-1 font-bold">Mês</p>
          <p className="font-bold text-destructive text-lg">{formatBRL(data?.totalMonth)}</p>
        </Card>
      </div>

      <div className="space-y-3 mt-8">
        {costs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
            <Wallet size={48} className="mx-auto mb-4 opacity-20" />
            <p>Nenhum custo registrado.</p>
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
                <Card className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                      {categoryIcons[cost.category]}
                    </div>
                    <div>
                      <p className="font-bold">{cost.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="capitalize">{categoryNames[cost.category]}</span>
                        <span>•</span>
                        <span>{formatMonthDay(cost.date)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <p className="font-bold text-destructive">{formatBRL(cost.amount)}</p>
                    <button 
                      onClick={() => handleDelete(cost.id)}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors"
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Adicionar Custo">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" placeholder="0.00" {...form.register("amount")} />
            {form.formState.errors.amount && <p className="text-destructive text-xs mt-1">{form.formState.errors.amount.message}</p>}
          </div>
          
          <div>
            <Label>Categoria</Label>
            <Select {...form.register("category")}>
              {Object.entries(categoryNames).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Descrição</Label>
            <Input placeholder="Ex: Gasolina Posto Ipiranga" {...form.register("description")} />
            {form.formState.errors.description && <p className="text-destructive text-xs mt-1">{form.formState.errors.description.message}</p>}
          </div>

          <div>
            <Label>Data</Label>
            <Input type="date" {...form.register("date")} />
          </div>

          <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="danger" isLoading={createMutation.isPending}>Salvar Custo</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
