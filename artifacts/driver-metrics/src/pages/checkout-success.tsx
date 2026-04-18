import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

import { getApiBase, authFetch } from "@/lib/api";
const BASE = getApiBase();

type SyncState = "syncing" | "success" | "partial";

async function attemptSync(sessionId: string | null): Promise<boolean> {
  const body: Record<string, string> = {};
  if (sessionId) body.sessionId = sessionId;

  const res = await authFetch(`${BASE}/api/stripe/sync-plan`, {
    method:      "POST",
    credentials: "include",
    headers:     { "Content-Type": "application/json" },
    body:        JSON.stringify(body),
  });

  if (!res.ok) return false;
  const data = await res.json();
  return data.plan === "pro";
}

export default function CheckoutSuccess() {
  const queryClient = useQueryClient();
  const [location]  = useLocation();
  const [syncState, setSyncState] = useState<SyncState>("syncing");

  useEffect(() => {
    const params    = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    let cancelled = false;

    async function runSync() {
      const delays = [2000, 3000, 4000];

      for (let attempt = 0; attempt < delays.length; attempt++) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
        if (cancelled) return;

        try {
          const isPro = await attemptSync(sessionId);
          if (cancelled) return;

          if (isPro) {
            await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            setSyncState("success");
            return;
          }
        } catch {
        }
      }

      if (cancelled) return;
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setSyncState("partial");
    }

    runSync();
    return () => { cancelled = true; };
  }, [queryClient, location]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 gap-6"
    >
      {syncState === "syncing" ? (
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={48} className="text-primary animate-spin" />
          <p className="text-white/50 text-sm">Ativando seu PRO...</p>
        </div>
      ) : syncState === "success" ? (
        <>
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
      ) : (
        <>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.1 }}
            className="relative"
          >
            <div className="relative w-24 h-24 bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 border-2 border-yellow-500/40 rounded-full flex items-center justify-center">
              <AlertCircle size={48} className="text-yellow-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2"
          >
            <h1 className="text-2xl font-display font-extrabold text-white">
              Pagamento recebido!
            </h1>
            <p className="text-yellow-400 font-bold text-base">Ativação em andamento</p>
            <p className="text-white/50 text-sm max-w-xs mx-auto leading-relaxed">
              Seu pagamento foi confirmado. O acesso PRO pode levar alguns minutos para ser ativado. Se o painel ainda mostrar o plano gratuito, faça logout e entre novamente.
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
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
