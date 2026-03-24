import { useState } from "react";
import { useGetRides, useCreateRide, useDeleteRide } from "@workspace/api-client-react";
import { formatBRL, formatMonthDay } from "@/lib/utils";
import { Button, Input, Select, Label, Card, Modal } from "@/components/ui";
import { Car, Plus, MapPin, Clock, Star, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

const rideSchema = z.object({
  value: z.coerce.number().min(0.1, "Valor inválido"),
  distanceKm: z.coerce.number().min(0.1, "Distância inválida"),
  durationMinutes: z.coerce.number().min(1, "Tempo inválido"),
  platform: z.enum(["uber", "99", "indriver", "outro"] as const),
  passengerRating: z.coerce.number().min(1).max(5),
  platformCommissionPct: z.coerce.number().min(0).max(100),
});

type RideFormData = z.infer<typeof rideSchema>;

const platformStyles: Record<string, { bg: string, text: string, border: string }> = {
  uber: { bg: "bg-black", text: "text-white", border: "border-black" },
  "99": { bg: "bg-yellow-500", text: "text-black", border: "border-yellow-500" },
  indriver: { bg: "bg-[#00ff88]", text: "text-black", border: "border-[#00ff88]" },
  outro: { bg: "bg-white/10", text: "text-white", border: "border-white/20" },
};

export default function Rides() {
  const { data, isLoading } = useGetRides();
  const createMutation = useCreateRide();
  const deleteMutation = useDeleteRide();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const form = useForm<RideFormData>({
    resolver: zodResolver(rideSchema),
    defaultValues: {
      platform: "uber",
      passengerRating: 5,
      platformCommissionPct: 25,
      value: undefined,
      distanceKm: undefined,
      durationMinutes: undefined,
    }
  });

  const onSubmit = form.handleSubmit((data) => {
    createMutation.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
        setIsModalOpen(false);
        form.reset();
      }
    });
  });

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta corrida?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
        }
      });
    }
  };

  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>;

  const rides = data?.rides || [];
  
  const totalRides = rides.length;
  const totalGross = rides.reduce((acc, r) => acc + Number(r.value), 0);
  const totalNet = rides.reduce((acc, r) => acc + Number(r.netValue), 0);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-display font-bold">Corridas</h2>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2" size="sm">
          <Plus size={18} /> Adicionar
        </Button>
      </div>

      {/* Summary Strip */}
      <Card className="flex items-center justify-between p-4 bg-primary/10 border-primary/20 backdrop-blur-md">
        <div className="text-center flex-1 border-r border-white/10">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total</p>
          <p className="font-display font-bold text-lg">{totalRides}</p>
        </div>
        <div className="text-center flex-1 border-r border-white/10">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Bruto</p>
          <p className="font-display font-bold text-lg text-white tabular-nums">{formatBRL(totalGross)}</p>
        </div>
        <div className="text-center flex-1">
          <p className="text-[10px] text-primary uppercase font-bold tracking-wider">Líquido</p>
          <p className="font-display font-bold text-lg text-primary tabular-nums">{formatBRL(totalNet)}</p>
        </div>
      </Card>

      <div className="space-y-4">
        {rides.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border-2 border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <Car size={40} className="text-white/20" />
            </div>
            <h3 className="text-xl font-display font-bold text-white mb-2">Nenhuma corrida ainda</h3>
            <p className="text-sm max-w-[250px] mx-auto">Registre suas corridas para começar a ver métricas detalhadas do seu lucro real.</p>
            <Button onClick={() => setIsModalOpen(true)} className="mt-6 gap-2" variant="outline">
              <Plus size={16} /> Registrar Primeira Corrida
            </Button>
          </div>
        ) : (
          <AnimatePresence>
            {rides.map((ride, i) => {
              const pStyle = platformStyles[ride.platform] || platformStyles.outro;
              
              return (
                <motion.div
                  key={ride.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: i * 0.05 }}
                  className="group"
                >
                  <div className={`relative rounded-2xl border-l-4 ${pStyle.border} bg-card shadow-xl overflow-hidden`}>
                    <div className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl ${pStyle.bg} flex items-center justify-center ${pStyle.text} font-black uppercase text-sm shadow-lg`}>
                          {ride.platform === "indriver" ? "IN" : ride.platform.substring(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display font-bold text-xl tabular-nums tracking-tight">{formatBRL(ride.value)}</span>
                            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-md font-bold text-muted-foreground">{formatMonthDay(ride.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 font-medium">
                            <span className="flex items-center gap-1"><MapPin size={12} className="text-primary"/> {ride.distanceKm}km</span>
                            <span className="flex items-center gap-1"><Clock size={12} className="text-blue-400"/> {ride.durationMinutes}m</span>
                            <span className="flex items-center gap-1 text-yellow-500"><Star size={12} className="fill-yellow-500"/> {ride.passengerRating}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Rentabilidade</p>
                          <p className="font-bold text-sm text-primary tabular-nums">{formatBRL(ride.valuePerKm)}/km</p>
                        </div>
                        <button 
                          onClick={() => handleDelete(ride.id)}
                          className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-white bg-white/5 hover:bg-destructive rounded-xl transition-all"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova Corrida">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor Bruto (R$)</Label>
              <Input type="number" step="0.01" placeholder="0.00" className="font-display font-bold text-lg h-14" {...form.register("value")} />
              {form.formState.errors.value && <p className="text-destructive text-xs mt-1">{form.formState.errors.value.message}</p>}
            </div>
            <div>
              <Label>Distância (KM)</Label>
              <Input type="number" step="0.1" placeholder="0.0" className="h-14" {...form.register("distanceKm")} />
              {form.formState.errors.distanceKm && <p className="text-destructive text-xs mt-1">{form.formState.errors.distanceKm.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tempo (Minutos)</Label>
              <Input type="number" placeholder="15" className="h-14" {...form.register("durationMinutes")} />
            </div>
            <div>
              <Label>Plataforma</Label>
              <Select className="h-14" {...form.register("platform")}>
                <option value="uber">Uber</option>
                <option value="99">99</option>
                <option value="indriver">InDrive</option>
                <option value="outro">Outro</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nota Passageiro</Label>
              <Input type="number" step="0.1" min="1" max="5" className="h-14" {...form.register("passengerRating")} />
            </div>
            <div>
              <Label>Taxa Plataforma (%)</Label>
              <Input type="number" step="1" className="h-14" {...form.register("platformCommissionPct")} />
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-white/10 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" size="lg" isLoading={createMutation.isPending}>Salvar Corrida</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}