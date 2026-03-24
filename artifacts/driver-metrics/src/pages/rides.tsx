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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-display font-bold">Corridas</h2>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2" size="sm">
          <Plus size={18} /> Adicionar
        </Button>
      </div>

      <div className="space-y-4">
        {rides.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
            <Car size={48} className="mx-auto mb-4 opacity-20" />
            <p>Nenhuma corrida registrada ainda.</p>
          </div>
        ) : (
          <AnimatePresence>
            {rides.map((ride, i) => (
              <motion.div
                key={ride.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="p-4 flex flex-col md:flex-row gap-4 justify-between md:items-center hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold uppercase border border-primary/20">
                      {ride.platform.substring(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{formatBRL(ride.value)}</span>
                        <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">{formatMonthDay(ride.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><MapPin size={12}/> {ride.distanceKm}km</span>
                        <span className="flex items-center gap-1"><Clock size={12}/> {ride.durationMinutes}m</span>
                        <span className="flex items-center gap-1 text-yellow-500"><Star size={12} className="fill-yellow-500"/> {ride.passengerRating}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t border-white/5 md:border-t-0">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Líquido ({formatBRL(ride.valuePerKm)}/km)</p>
                      <p className="font-bold text-primary">{formatBRL(ride.netValue)}</p>
                    </div>
                    <button 
                      onClick={() => handleDelete(ride.id)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova Corrida">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor Bruto (R$)</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...form.register("value")} />
              {form.formState.errors.value && <p className="text-destructive text-xs mt-1">{form.formState.errors.value.message}</p>}
            </div>
            <div>
              <Label>Distância (KM)</Label>
              <Input type="number" step="0.1" placeholder="0.0" {...form.register("distanceKm")} />
              {form.formState.errors.distanceKm && <p className="text-destructive text-xs mt-1">{form.formState.errors.distanceKm.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tempo (Minutos)</Label>
              <Input type="number" placeholder="15" {...form.register("durationMinutes")} />
            </div>
            <div>
              <Label>Plataforma</Label>
              <Select {...form.register("platform")}>
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
              <Input type="number" step="0.1" min="1" max="5" {...form.register("passengerRating")} />
            </div>
            <div>
              <Label>Taxa Plataforma (%)</Label>
              <Input type="number" step="1" {...form.register("platformCommissionPct")} />
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" isLoading={createMutation.isPending}>Salvar Corrida</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
