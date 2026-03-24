import { useGetEarningsReport, useGetMe } from "@workspace/api-client-react";
import { Card, Button } from "@/components/ui";
import { BarChart2, Lock } from "lucide-react";
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
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4 relative">
        <div className="absolute inset-0 bg-[url('/images/pro-bg.png')] bg-cover bg-center opacity-30 rounded-3xl" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent rounded-3xl" />
        
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative z-10 max-w-md w-full"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-3xl flex items-center justify-center mx-auto mb-6 glow-gold shadow-2xl shadow-yellow-500/20">
            <Lock size={48} className="text-black" />
          </div>
          <h2 className="text-4xl font-display font-extrabold text-white mb-4">Relatórios <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600">PRO</span></h2>
          <p className="text-lg text-muted-foreground mb-8">
            Descubra seu lucro real e tome decisões baseadas em dados. Gráficos detalhados, comparativos e histórico completo disponíveis no plano Premium.
          </p>
          <Button variant="gold" size="lg" className="w-full text-lg h-16 shadow-2xl shadow-yellow-500/20">
            Faça Upgrade Agora
          </Button>
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
        <div className="bg-card/90 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-xl">
          <p className="font-bold text-white mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm flex justify-between gap-4">
              <span>{entry.name}:</span>
              <span className="font-bold">{formatBRL(entry.value)}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-10">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-full text-xs font-bold mb-4">
          RECURSO PRO ATIVADO
        </div>
        <h2 className="text-3xl font-display font-bold flex items-center gap-3">
          <BarChart2 className="text-primary" /> Análise de Desempenho
        </h2>
      </div>

      <Card className="p-6">
        <h3 className="font-bold mb-6 text-lg">Evolução Diária (Últimos 30 dias)</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={reports.daily} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#a3a3a3', fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(val) => `R$${val}`} tick={{ fill: '#a3a3a3', fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Line type="monotone" dataKey="earnings" name="Ganhos" stroke="#00ff88" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: "#00ff88", stroke: "#000", strokeWidth: 2 }} />
              <Line type="monotone" dataKey="costs" name="Custos" stroke="#ff4444" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="profit" name="Lucro" stroke="#3b82f6" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-bold mb-6 text-lg">Ganhos por Plataforma</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reports.byPlatform} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(val) => `R$${val}`} tick={{ fill: '#a3a3a3', fontSize: 12 }} />
                <YAxis dataKey="platform" type="category" tick={{ fill: '#fff', fontSize: 12, fontWeight: 'bold' }} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                <Bar dataKey="earnings" name="Ganhos" fill="#00ff88" radius={[0, 4, 4, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold mb-6 text-lg">Melhores Dias da Semana</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reports.byDayOfWeek} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#a3a3a3', fontSize: 12 }} />
                <YAxis tickFormatter={(val) => `R$${val}`} tick={{ fill: '#a3a3a3', fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                <Bar dataKey="earnings" name="Média" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
