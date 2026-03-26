import { Link } from "wouter";
import { Home, AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="w-20 h-20 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
        <AlertCircle size={36} className="text-white/30" />
      </div>
      <div>
        <p className="text-4xl font-display font-extrabold text-white/10 mb-3">404</p>
        <p className="text-white font-bold text-lg">Página não encontrada</p>
        <p className="text-white/40 text-sm mt-2 max-w-xs mx-auto leading-relaxed">
          Essa rota não existe. Volte ao início para continuar usando o app.
        </p>
      </div>
      <Link href="/">
        <button className="flex items-center gap-2 px-6 py-3 bg-primary text-black font-bold rounded-xl text-sm">
          <Home size={16} /> Voltar ao início
        </button>
      </Link>
    </div>
  );
}
