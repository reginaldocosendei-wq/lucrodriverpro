import { useGetEarningsReport, useGetMe } from "@workspace/api-client-react";
import { Card, Button } from "@/components/ui";
import { BarChart2, Lock, TrendingUp, Users } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';
import { motion } from "framer-motion";

export default function Reports() {
  const { data: user } = useGetMe();
  const { data: reports, isLoading } = useGetEarningsReport({
    query: { enabled: user?.plan === "pro" } // Only fetch if pro
  });

  const isPro = user?.plan === "pro";

  if (!isPro) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center py-10 relative overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 to-background z-0" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-yellow-500/10 blur-[100px] rounded-full z-0 pointer-events-none" />
        
        {/* Fake charts in background */}
        <div className="absolute inset-0 z-0 opacity-20 flex flex-col gap-8 p-4 blur-sm pointer-events-none select-none">
          <div className="h-64 border border-white/10 rounded-3xl bg-white/[0.02] flex items-end justify-between px-8 pb-8 pt-20">
            {[40, 70, 45, 90, 60, 100, 80].map((h, i) => (
              <div key={i} className="w-12 bg-white/20 rounded-t-lg" style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-48 border border-white/10 rounded-3xl bg-white/[0.02]" />
            <div className="h-48 border border-white/10 rounded-3xl bg-white/[0.02]" />
          </div>
        </div>
        
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="relative z-10 max-w-lg w-full bg-black/60 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-3xl flex items-center justify-center mx-auto mb-6 glow-gold shadow-2xl shadow-yellow-500/20">
            <Lock size={48} className="text-black" />
          </div>
          
          <div className="inline-flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6">
            <Users size={14} className="text-yellow-500" />
            <span className="text-xs font-bold text-white">Mais de 5.000 motoristas já usam o PRO</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-display font-extrabold text-white mb-4 tracking-tight">
            Relatórios <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]">PRO</span>
          </h2>
          
          <p className="text-lg text-muted-foreground mb-8 font-medium leading-relaxed">
            Motoristas que usam relatórios avançados ganham, em média, <strong className="text-white">23% mais</strong>. Descubra seus melhores dias, as plataformas mais rentáveis e seu lucro real.
          </p>
          
          <div className="space-y-4">
            <Button variant="gold" size="lg" className="w-full text-lg h-16 shadow-[0_0_30px_rgba(255,215,0,0.3)]">
              Experimentar grátis por 7 dias
            </Button>
            <Button variant="ghost" size="lg" className="w-full text-muted-foreground hover:text-white">
              Ver todos os planos
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div></div>;
  if (!reports) return null;

  // Custom Tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card/90 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl">
          <p className="font-bold text-white mb-3 text-sm">{label}</p>
          <div className="space-y-2">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-muted-foreground font-medium">{entry.name}</span>
                </div>
                <span className="font-bold tabular-nums text-white">{formatBRL(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-10">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-full text-[10px] font-extrabold uppercase tracking-widest mb-4 shadow-[0_0_10px_rgba(255,215,0,0.1)]">
          ✦ RECURSO PRO ATIVO
        </div>
        <h2 className="text-3xl font-display font-bold flex items-center gap-3">
          <BarChart2 className="text-primary" /> Análise de Desempenho
        </h2>
      </div>

      <Card className="p-6 md:p-8 bg-card/50">
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-display font-bold text-xl flex items-center gap-2">
            <TrendingUp size={20} className="text-primary" /> Evolução Diária <span className="text-muted-foreground text-sm font-medium ml-2">(Últimos 30 dias)</span>
          </h3>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={reports.daily} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: '#737373', fontSize: 10, fontWeight: 600 }} tickLine={false} axisLine={false} dy={10} />
              <YAxis tickFormatter={(val) => `R$${val}`} tick={{ fill: '#737373', fontSize: 10, fontWeight: 600 }} tickLine={false} axisLine={false} dx={-10} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }} />
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 600 }} iconType="circle" />
              <Line type="monotone" dataKey="earnings" name="Ganhos" stroke="#00ff88" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: "#00ff88", stroke: "#000", strokeWidth: 2 }} />
              <Line type="monotone" dataKey="costs" name="Custos" stroke="#ff4444" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: "#ff4444", stroke: "#000", strokeWidth: 2 }} />
              <Line type="monotone" dataKey="profit" name="Lucro Real" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: "#3b82f6", stroke: "#000", strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6 md:p-8 bg-card/50">
          <h3 className="font-display font-bold text-xl mb-8">Ganhos por Plataforma</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reports.byPlatform} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tickFormatter={(val) => `R$${val}`} tick={{ fill: '#737373', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="platform" type="category" tick={{ fill: '#fff', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' }} axisLine={false} tickLine={false} dx={-10} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.02)'}} />
                <Bar dataKey="earnings" name="Ganhos Brutos" fill="#00ff88" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 md:p-8 bg-card/50">
          <h3 className="font-display font-bold text-xl mb-8">Melhores Dias da Semana</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reports.byDayOfWeek} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#737373', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tickFormatter={(val) => `R$${val}`} tick={{ fill: '#737373', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} dx={-10} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.02)'}} />
                <Bar dataKey="earnings" name="Média de Ganhos" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}