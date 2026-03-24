import { useGetDashboardSummary, useGetMe } from "@workspace/api-client-react";
import { formatBRL } from "@/lib/utils";
import { Card } from "@/components/ui";
import { TrendingUp, Car, MapPin, AlertCircle, DollarSign, Target, Award, Zap, Lightbulb, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

export default function Home() {
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: user } = useGetMe();

  if (isLoading) {
    return <div className="flex min-h-[200px] items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>;
  }

  if (!summary) return null;

  const currentHour = new Date().getHours();
  const isAfterNoon = currentHour >= 12;
  const isFree = user?.plan !== "pro";
  
  const pctToday = Math.min(100, summary.goalDailyPct || 0);
  let todayColor = "bg-primary glow-primary";
  if (isAfterNoon && pctToday < 40) todayColor = "bg-destructive glow-destructive shadow-[0_0_20px_rgba(255,0,0,0.3)]";
  else if (isAfterNoon && pctToday < 80) todayColor = "bg-yellow-500 glow-gold";

  const isProfitPositive = summary.realProfitMonth >= 0;
  const profitMargin = summary.earningsMonth > 0 ? (summary.realProfitMonth / summary.earningsMonth) * 100 : 0;

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

  // Insights logic
  const insights = [];
  if (pctToday < 100 && summary.goalDailyPct > 0) {
    const dailyGoal = summary.earningsToday / (pctToday / 100);
    const remaining = dailyGoal - summary.earningsToday;
    if (remaining > 0 && isFinite(remaining)) {
      insights.push({
        id: 'meta',
        icon: <Zap size={20} className="text-yellow-500" />,
        color: "border-yellow-500",
        bg: "bg-yellow-500/10",
        text: `Falta ${formatBRL(remaining)} para bater a meta diária. Acelere!`
      });
    }
  }
  
  if (summary.avgPerKm > 0 && summary.avgPerKm < 1.5) {
    insights.push({
      id: 'rentabilidade',
      icon: <AlertCircle size={20} className="text-destructive" />,
      color: "border-destructive",
      bg: "bg-destructive/10",
      text: `Média de R$/km (${formatBRL(summary.avgPerKm)}) abaixo do ideal. Priorize corridas com multiplicador ou mais curtas.`
    });
  }

  if (summary.bestPlatform) {
    insights.push({
      id: 'destaque',
      icon: <Award size={20} className="text-primary" />,
      color: "border-primary",
      bg: "bg-primary/10",
      text: `A ${summary.bestPlatform} está rendendo mais ultimamente. Mantenha o foco nela.`
    });
  }

  const remainingDays = 30 - new Date().getDate(); // Simplified projection
  const projectedEarnings = summary.earningsMonth + (summary.earningsToday * remainingDays);
  if (projectedEarnings > summary.earningsMonth) {
    insights.push({
      id: 'projecao',
      icon: <TrendingUp size={20} className="text-blue-500" />,
      color: "border-blue-500",
      bg: "bg-blue-500/10",
      text: `No ritmo atual, você vai faturar ${formatBRL(projectedEarnings)} este mês.`
    });
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8 pb-10">
      
      {/* Hero Earnings Strip */}
      <motion.div variants={item} className="text-center space-y-2 py-4">
        <p className="text-sm font-bold text-muted-foreground tracking-widest uppercase">Ganhos Hoje</p>
        <h2 className="text-5xl md:text-6xl font-display font-extrabold tracking-tight tabular-nums">
          {formatBRL(summary.earningsToday)}
        </h2>
        <div className="max-w-xs mx-auto pt-4">
          <div className="h-2.5 bg-black rounded-full overflow-hidden border border-white/5">
            <div 
              className={`h-full transition-all duration-1000 ${todayColor}`}
              style={{ width: `${pctToday}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground font-medium">
            <span>{Math.round(pctToday)}% da meta</span>
            <span>Meta: {formatBRL(summary.earningsToday / (pctToday / 100) || 0)}</span>
          </div>
        </div>
      </motion.div>

      {/* Profit vs Revenue split */}
      <motion.div variants={item}>
        <Card className="p-6 relative overflow-hidden bg-gradient-to-br from-card to-card/40">
          <div className="grid grid-cols-2 gap-6 relative z-10">
            <div>
              <p className="text-sm text-muted-foreground mb-1 font-medium">Faturamento Mês</p>
              <h3 className="text-2xl font-display font-bold tabular-nums text-white">
                {formatBRL(summary.earningsMonth)}
              </h3>
            </div>
            <div className="text-right border-l border-white/10 pl-6">
              <p className="text-sm text-muted-foreground mb-1 font-medium flex items-center justify-end gap-1"><Target size={14} /> Lucro Real</p>
              <h3 className={`text-2xl font-display font-bold tabular-nums ${isProfitPositive ? 'text-primary drop-shadow-[0_0_8px_rgba(0,255,136,0.3)]' : 'text-destructive'}`}>
                {formatBRL(summary.realProfitMonth)}
              </h3>
            </div>
          </div>
          
          <div className="mt-6 space-y-2 relative z-10">
            <div className="flex justify-between text-xs font-bold text-muted-foreground">
              <span>Custos {formatBRL(summary.costsMonth)}</span>
              <span className={isProfitPositive ? "text-primary" : "text-destructive"}>{Math.max(0, Math.round(profitMargin))}% Margem</span>
            </div>
            <div className="h-3 bg-black rounded-full overflow-hidden flex border border-white/5">
              <div 
                className="h-full bg-destructive/80 transition-all duration-1000"
                style={{ width: `${Math.min(100, (summary.costsMonth / (summary.earningsMonth || 1)) * 100 || 0)}%` }}
              />
              <div 
                className="h-full bg-primary glow-primary transition-all duration-1000"
                style={{ width: `${Math.max(0, profitMargin)}%` }}
              />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col justify-center bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
          <Car size={20} className="text-muted-foreground mb-2" />
          <p className="text-xs font-medium text-muted-foreground">Corridas</p>
          <p className="text-xl font-display font-bold tabular-nums">{summary.totalRides}</p>
        </Card>
        
        <Card className="p-4 flex flex-col justify-center bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
          <MapPin size={20} className="text-primary mb-2" />
          <p className="text-xs font-medium text-muted-foreground">Média / KM</p>
          <p className="text-xl font-display font-bold tabular-nums">{formatBRL(summary.avgPerKm)}</p>
        </Card>

        <Card className="p-4 flex flex-col justify-center bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
          <TrendingUp size={20} className="text-primary mb-2" />
          <p className="text-xs font-medium text-muted-foreground">Média / Corrida</p>
          <p className="text-xl font-display font-bold tabular-nums">{formatBRL(summary.avgPerRide)}</p>
        </Card>

        <Card className="p-4 flex flex-col justify-center bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
          <Award size={20} className="text-yellow-500 mb-2" />
          <p className="text-xs font-medium text-muted-foreground">Melhor Plat.</p>
          <p className="text-xl font-display font-bold capitalize">{summary.bestPlatform || '-'}</p>
        </Card>
      </motion.div>

      {/* Smart Insights */}
      <motion.div variants={item} className="space-y-4">
        <h3 className="font-display text-xl font-bold flex items-center gap-2">
          <Lightbulb className="text-yellow-500" size={24} /> Insights
        </h3>
        
        <div className="space-y-3">
          {insights.slice(0, 3).map((insight) => (
            <Card key={insight.id} className={`p-4 border-l-4 ${insight.color} ${insight.bg} flex items-start gap-4 shadow-none`}>
              <div className="mt-0.5">{insight.icon}</div>
              <p className="text-sm font-medium leading-relaxed">{insight.text}</p>
            </Card>
          ))}

          {isFree && (
            <Link href="/reports">
              <Card className="p-4 border-l-4 border-yellow-500 bg-gradient-to-r from-yellow-500/10 to-transparent flex items-start gap-4 cursor-pointer hover:from-yellow-500/20 transition-all mt-3">
                <Lock size={20} className="text-yellow-500 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-white mb-1">Desbloqueie seu Lucro Real</p>
                  <p className="text-xs text-muted-foreground mb-3">Veja para onde seu dinheiro está indo e maximize seus ganhos com o PRO.</p>
                  <span className="text-xs font-bold text-yellow-500 hover:text-yellow-400">FAZER UPGRADE ✦</span>
                </div>
              </Card>
            </Link>
          )}
        </div>
      </motion.div>

      {/* Extended Goals */}
      <motion.div variants={item}>
        <Card className="p-6 space-y-6 bg-white/[0.02]">
          <h4 className="font-display text-xl font-bold">Progresso das Metas</h4>
          
          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-sm mb-2 font-medium">
                <span className="text-muted-foreground">Semana <span className="text-white ml-1">{formatBRL(summary.earningsWeek)}</span></span>
                <span className="font-bold text-primary">{Math.round(summary.goalWeeklyPct || 0)}%</span>
              </div>
              <div className="h-2.5 bg-black rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-gradient-to-r from-primary/50 to-primary glow-primary transition-all duration-1000" style={{ width: `${Math.min(100, summary.goalWeeklyPct || 0)}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2 font-medium">
                <span className="text-muted-foreground">Mês <span className="text-white ml-1">{formatBRL(summary.earningsMonth)}</span></span>
                <span className="font-bold text-primary">{Math.round(summary.goalMonthlyPct || 0)}%</span>
              </div>
              <div className="h-2.5 bg-black rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-gradient-to-r from-primary/50 to-primary glow-primary transition-all duration-1000" style={{ width: `${Math.min(100, summary.goalMonthlyPct || 0)}%` }} />
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

    </motion.div>
  );
}
