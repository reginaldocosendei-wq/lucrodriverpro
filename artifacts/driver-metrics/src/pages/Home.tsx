import { useGetDashboardSummary } from "@workspace/api-client-react";
import { formatBRL } from "@/lib/utils";
import { Card } from "@/components/ui";
import { TrendingUp, Car, MapPin, AlertCircle, TrendingDown, DollarSign, Target, Award } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const { data: summary, isLoading } = useGetDashboardSummary();

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>;
  }

  if (!summary) return null;

  const currentHour = new Date().getHours();
  const isAfterNoon = currentHour >= 12;
  const showGoalAlert = summary.goalDailyPct < 50 && isAfterNoon;
  const showKmAlert = summary.avgPerKm > 0 && summary.avgPerKm < 1.5;

  const isProfitPositive = summary.realProfitMonth >= 0;

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      
      {/* Alerts */}
      {(showGoalAlert || showKmAlert) && (
        <motion.div variants={item} className="space-y-3">
          {showGoalAlert && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 px-4 py-3 rounded-xl flex items-center gap-3">
              <AlertCircle size={20} />
              <p className="text-sm font-medium">Você está abaixo da meta hoje. Acelere!</p>
            </div>
          )}
          {showKmAlert && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-xl flex items-center gap-3">
              <TrendingDown size={20} />
              <p className="text-sm font-medium">Sua média está {formatBRL(summary.avgPerKm)}/km. Hoje não está compensando rodar.</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Main Highlights */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div variants={item}>
          <Card className="p-5 bg-gradient-to-br from-card to-card/50">
            <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1"><DollarSign size={14}/> Ganho Hoje</p>
            <h3 className="text-2xl md:text-3xl font-display font-bold text-primary">{formatBRL(summary.earningsToday)}</h3>
            <div className="mt-4 h-2 bg-black rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary glow-primary transition-all duration-1000"
                style={{ width: `${Math.min(100, summary.goalDailyPct || 0)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-right">{Math.round(summary.goalDailyPct || 0)}% da meta</p>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1"><Target size={14}/> Lucro Real Mês</p>
            <h3 className={`text-2xl md:text-3xl font-display font-bold ${isProfitPositive ? 'text-primary' : 'text-destructive'}`}>
              {formatBRL(summary.realProfitMonth)}
            </h3>
            <p className="text-xs text-muted-foreground mt-4 pt-2 border-t border-white/5">
              Ganho {formatBRL(summary.earningsMonth)} <br/>
              Custo <span className="text-destructive">{formatBRL(summary.costsMonth)}</span>
            </p>
          </Card>
        </motion.div>
      </div>

      {/* Stats Grid */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col justify-center">
          <Car size={20} className="text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">Corridas</p>
          <p className="text-xl font-bold">{summary.totalRides}</p>
        </Card>
        
        <Card className="p-4 flex flex-col justify-center">
          <MapPin size={20} className="text-primary mb-2" />
          <p className="text-xs text-muted-foreground">Média / KM</p>
          <p className="text-xl font-bold">{formatBRL(summary.avgPerKm)}</p>
        </Card>

        <Card className="p-4 flex flex-col justify-center">
          <TrendingUp size={20} className="text-primary mb-2" />
          <p className="text-xs text-muted-foreground">Média / Corrida</p>
          <p className="text-xl font-bold">{formatBRL(summary.avgPerRide)}</p>
        </Card>

        <Card className="p-4 flex flex-col justify-center">
          <Award size={20} className="text-yellow-500 mb-2" />
          <p className="text-xs text-muted-foreground">Melhor Plat.</p>
          <p className="text-xl font-bold capitalize">{summary.bestPlatform || '-'}</p>
        </Card>
      </motion.div>

      {/* Extended Goals */}
      <motion.div variants={item}>
        <Card className="p-5 space-y-5">
          <h4 className="font-display font-bold text-lg mb-2">Progresso das Metas</h4>
          
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Semana ({formatBRL(summary.earningsWeek)})</span>
              <span className="font-bold">{Math.round(summary.goalWeeklyPct || 0)}%</span>
            </div>
            <div className="h-2 bg-black rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${Math.min(100, summary.goalWeeklyPct || 0)}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Mês ({formatBRL(summary.earningsMonth)})</span>
              <span className="font-bold">{Math.round(summary.goalMonthlyPct || 0)}%</span>
            </div>
            <div className="h-2 bg-black rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${Math.min(100, summary.goalMonthlyPct || 0)}%` }} />
            </div>
          </div>
        </Card>
      </motion.div>

    </motion.div>
  );
}
