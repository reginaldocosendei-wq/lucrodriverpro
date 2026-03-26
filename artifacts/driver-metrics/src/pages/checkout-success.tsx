import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

import { getApiBase } from "@/lib/api";
const BASE = getApiBase();

export default function CheckoutSuccess() {
  const queryClient = useQueryClient();
  const [synced, setSynced] = useState(false);
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    // Give Stripe a moment to process the webhook, then sync the plan
    const timer = setTimeout(async () => {
      try {
        await fetch(`${BASE}/api/stripe/sync-plan`, {
          method: "POST",
          credentials: "include",
        });
        // Invalidate user query so the plan updates everywhere
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        setSynced(true);
      } catch {
        setSynced(true); // Still show success even if sync fails
      } finally {
        setSyncing(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [queryClient]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 gap-6"
    >
      {syncing ? (
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={48} className="text-primary animate-spin" />
          <p className="text-white/50 text-sm">Ativando seu PRO...</p>
        </div>
      ) : (
        <>
          {/* Success icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.1 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-primary/30 rounded-full blur-2xl scale-150" />
            <div className="relative w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/40 rounded-full flex items-center justify-center">
              <CheckCircle size={48} className="text-primary" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2"
          >
            <h1 className="text-3xl font-display font-extrabold text-white">
              Pagamento confirmado!
            </h1>
            <p className="text-primary font-bold text-lg">PRO ativado com sucesso ✦</p>
            <p className="text-white/50 text-sm max-w-xs mx-auto leading-relaxed">
              Bem-vindo ao Lucro Driver PRO. Agora você tem acesso ao seu lucro real, relatórios completos e muito mais.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="w-full max-w-xs space-y-3"
          >
            <Link href="/">
              <button className="w-full h-14 rounded-2xl bg-primary text-black font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-primary/30">
                Ir para o painel <ArrowRight size={20} />
              </button>
            </Link>
            <Link href="/reports">
              <button className="w-full h-12 rounded-2xl border border-white/10 bg-white/[0.03] text-white/70 font-semibold text-sm hover:bg-white/[0.06] transition-colors">
                Ver relatórios PRO
              </button>
            </Link>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
