import { motion } from "framer-motion";
import { XCircle, ArrowLeft, Lock } from "lucide-react";
import { Link } from "wouter";

export default function CheckoutCancel() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 gap-6"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", damping: 15, stiffness: 200 }}
        className="relative"
      >
        <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl scale-150" />
        <div className="relative w-24 h-24 bg-gradient-to-br from-red-500/20 to-red-500/5 border-2 border-red-500/30 rounded-full flex items-center justify-center">
          <XCircle size={48} className="text-red-400" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="space-y-2"
      >
        <h1 className="text-2xl font-display font-bold text-white">Pagamento cancelado</h1>
        <p className="text-white/50 text-sm max-w-xs mx-auto leading-relaxed">
          Nenhuma cobrança foi feita. Você pode tentar novamente quando quiser.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="w-full max-w-xs space-y-3"
      >
        <Link href="/upgrade">
          <button className="w-full h-14 rounded-2xl bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-extrabold text-base flex items-center justify-center gap-2 shadow-xl shadow-yellow-500/30">
            <Lock size={20} /> Tentar novamente
          </button>
        </Link>
        <Link href="/">
          <button className="w-full h-12 rounded-2xl border border-white/10 bg-white/[0.03] text-white/60 font-semibold text-sm hover:bg-white/[0.06] transition-colors flex items-center justify-center gap-2">
            <ArrowLeft size={16} /> Voltar ao painel
          </button>
        </Link>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-xs text-white/30 max-w-xs"
      >
        Tem alguma dúvida? Entre em contato com nosso suporte.
      </motion.p>
    </motion.div>
  );
}
