import { Router } from "express";
import { db, dailySummariesTable, costsTable, goalsTable, extraEarningsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { computeCostMetrics } from "../lib/costSplit";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) { res.status(401).json({ error: "Não autenticado" }); return; }
  next();
}

function todayStr() { return new Date().toISOString().split("T")[0]; }

function dateOffset(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0];
}

function weekBounds(weeksAgo = 0) {
  const d = new Date();
  const dow = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - dow - weeksAgo * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
}

const LEVELS = [
  { level: 1, name: "Iniciante",    icon: "🌱", minDays: 0,   nextAt: 7   },
  { level: 2, name: "Aprendiz",     icon: "🚗", minDays: 7,   nextAt: 14  },
  { level: 3, name: "Motorista",    icon: "🚀", minDays: 14,  nextAt: 30  },
  { level: 4, name: "Profissional", icon: "⭐", minDays: 30,  nextAt: 60  },
  { level: 5, name: "Expert",       icon: "🏆", minDays: 60,  nextAt: 100 },
  { level: 6, name: "Lendário",     icon: "💎", minDays: 100, nextAt: 200 },
];

function computeLevel(activeDays: number) {
  let cur = LEVELS[0];
  for (const l of LEVELS) { if (activeDays >= l.minDays) cur = l; }
  const nxtIdx = LEVELS.indexOf(cur) + 1;
  const nxt = nxtIdx < LEVELS.length ? LEVELS[nxtIdx] : null;
  const base = cur.minDays;
  const cap  = nxt ? nxt.minDays : cur.nextAt;
  const xpInLevel = activeDays - base;
  const xpNeeded  = cap - base;
  return {
    level: cur.level, name: cur.name, icon: cur.icon,
    xp: activeDays, xpInLevel, xpNeeded,
    pct: Math.min(100, Math.round((xpInLevel / xpNeeded) * 100)),
    isMax: !nxt,
  };
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const today  = todayStr();
    const monthStart = `${today.substring(0, 7)}-01`;

    const [allSummaries, allCosts, [goal], allExtras] = await Promise.all([
      db.select().from(dailySummariesTable)
        .where(eq(dailySummariesTable.userId, userId))
        .orderBy(desc(dailySummariesTable.date)),
      db.select().from(costsTable).where(eq(costsTable.userId, userId)),
      db.select().from(goalsTable).where(eq(goalsTable.userId, userId)).limit(1),
      db.select().from(extraEarningsTable).where(eq(extraEarningsTable.userId, userId)),
    ]);

    const todaySummary = allSummaries.find((s) => s.date === today) ?? null;
    const yesterday    = dateOffset(1);
    const hadYesterday = allSummaries.some((s) => s.date === yesterday && s.earnings > 0);

    const earningsToday     = todaySummary?.earnings    ?? 0;
    const tripsToday        = todaySummary?.trips       ?? 0;
    const hoursToday        = todaySummary?.hoursWorked ?? null;
    const extraToday        = allExtras.filter((e) => e.date >= today).reduce((s, e) => s + e.amount, 0);
    const totalEarningsToday = earningsToday + extraToday;

    const { variableCostsToday, fixedMonthlyTotal, dailyFixedCostQuota } =
      computeCostMetrics(allCosts, today, monthStart);
    const totalCostToday = variableCostsToday + dailyFixedCostQuota;
    const profitToday    = totalEarningsToday - totalCostToday;
    const marginPct      = totalEarningsToday > 0
      ? Math.round((profitToday / totalEarningsToday) * 100)
      : 0;
    const rph = hoursToday && hoursToday > 0 && totalEarningsToday > 0
      ? totalEarningsToday / hoursToday
      : null;

    const goalDaily   = goal?.daily   ?? 0;
    const goalMonthly = goal?.monthly ?? 0;
    const dailyGoalDone = goalDaily > 0 && totalEarningsToday >= goalDaily;
    const dailyGoalPct  = goalDaily > 0
      ? Math.min(100, Math.round((totalEarningsToday / goalDaily) * 100))
      : 0;

    // ── Streak ────────────────────────────────────────────────────────────────
    const activeDates = new Set(allSummaries.filter((s) => s.earnings > 0).map((s) => s.date));
    let streak = 0;
    const checkDate = new Date();
    if (!activeDates.has(today)) checkDate.setDate(checkDate.getDate() - 1);
    for (let i = 0; i < 365; i++) {
      const ds = checkDate.toISOString().split("T")[0];
      if (activeDates.has(ds)) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
      else break;
    }
    const sortedDates = Array.from(activeDates).sort();
    let longest = 0, temp = 0;
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) { temp = 1; }
      else {
        const diff = Math.round(
          (new Date(sortedDates[i]).getTime() - new Date(sortedDates[i - 1]).getTime()) / 86400000
        );
        temp = diff === 1 ? temp + 1 : 1;
      }
      longest = Math.max(longest, temp);
    }
    longest = Math.max(longest, streak);
    const streakDanger = !activeDates.has(today);

    // ── Level ─────────────────────────────────────────────────────────────────
    const levelData = computeLevel(activeDates.size);

    // ── Missions ─────────────────────────────────────────────────────────────
    const missions = [
      {
        key: "record_today",
        title: "Registrar o dia",
        icon: "📸",
        description: earningsToday > 0 ? "Concluído!" : "Importe o resultado de hoje",
        progress: earningsToday > 0 ? 1 : 0,
        target: 1,
        pct: earningsToday > 0 ? 100 : 0,
        done: earningsToday > 0,
        xp: 5,
      },
      goalDaily > 0
        ? {
            key: "daily_goal",
            title: "Bater a meta diária",
            icon: "🎯",
            description: dailyGoalDone
              ? "Meta atingida!"
              : `R$ ${totalEarningsToday.toFixed(0)} de R$ ${goalDaily.toFixed(0)}`,
            progress: Math.min(totalEarningsToday, goalDaily),
            target: goalDaily,
            pct: dailyGoalPct,
            done: dailyGoalDone,
            xp: 10,
          }
        : {
            key: "set_goal",
            title: "Definir meta diária",
            icon: "🎯",
            description: "Vá em Metas e defina quanto quer ganhar",
            progress: 0,
            target: 1,
            pct: 0,
            done: false,
            xp: 5,
          },
      {
        key: "efficiency",
        title: "Meta: eficiência acima de 30%",
        icon: "💡",
        description: totalEarningsToday > 0
          ? marginPct >= 30 ? "Eficiência atingida!" : `Margem atual: ${marginPct}%`
          : "Registre o dia para ver sua eficiência",
        progress: totalEarningsToday > 0 ? Math.min(Math.max(0, marginPct), 30) : 0,
        target: 30,
        pct: totalEarningsToday > 0
          ? Math.min(100, Math.round((Math.max(0, marginPct) / 30) * 100))
          : 0,
        done: marginPct >= 30 && totalEarningsToday > 0,
        xp: 8,
      },
    ];

    // ── Emotional status ──────────────────────────────────────────────────────
    const hour = new Date().getHours();
    let emotional: { status: string; message: string; color: string; icon: string };

    if (totalEarningsToday <= 0) {
      if (hour >= 14) {
        emotional = {
          status: "warning",
          message: hadYesterday
            ? `Ontem você registrou — hoje ainda não. Não perca o ritmo.`
            : `Você ainda não registrou o dia. Cada hora sem dados é uma hora perdida.`,
          color: "#eab308",
          icon: "⏰",
        };
      } else {
        emotional = {
          status: "idle",
          message: "Bom dia! Registre seu resultado ao final do turno.",
          color: "rgba(255,255,255,0.4)",
          icon: "🌅",
        };
      }
    } else if (marginPct >= 50) {
      emotional = {
        status: "crushing",
        message: `${marginPct}% de margem com ${tripsToday} corrida${tripsToday !== 1 ? "s" : ""}. Você está dominando hoje!`,
        color: "#00ff88",
        icon: "🔥",
      };
    } else if (marginPct >= 35) {
      emotional = {
        status: "great",
        message: `Ótimo dia! Margem de ${marginPct}%${rph ? ` e R$ ${rph.toFixed(2).replace(".", ",")}/hora` : ""}.`,
        color: "#4ade80",
        icon: "⚡",
      };
    } else if (marginPct >= 20) {
      emotional = {
        status: "good",
        message: `Margem de ${marginPct}%. Tem espaço para melhorar — foque nas corridas mais longas.`,
        color: "#60a5fa",
        icon: "📈",
      };
    } else if (profitToday >= 0) {
      emotional = {
        status: "warning",
        message: `Margem de ${marginPct}% está baixa. Seus custos estão pesados hoje.`,
        color: "#f97316",
        icon: "⚠️",
      };
    } else {
      emotional = {
        status: "bad",
        message: `Prejuízo de R$ ${Math.abs(profitToday).toFixed(2).replace(".", ",")} hoje. Revise seus custos ou aumente as horas de pico.`,
        color: "#ef4444",
        icon: "🚨",
      };
    }

    // ── Smart alerts ──────────────────────────────────────────────────────────
    const alerts: Array<{ type: string; message: string; icon: string }> = [];

    if (streakDanger && streak > 0 && hour >= 10) {
      alerts.push({
        type: "warning",
        message: `Não perca sua sequência de ${streak} dia${streak !== 1 ? "s" : ""}! Registre hoje.`,
        icon: "🔥",
      });
    }
    if ([7, 14, 30, 60, 100].includes(streak) && activeDates.has(today)) {
      alerts.push({
        type: "success",
        message: `${streak} dias seguidos! Consistência é o que separa os grandes motoristas.`,
        icon: "🏆",
      });
    }
    if (dailyGoalDone) {
      alerts.push({
        type: "success",
        message: `Meta do dia atingida! R$ ${totalEarningsToday.toFixed(2).replace(".", ",")} registrados.`,
        icon: "🎯",
      });
    }
    if (totalEarningsToday > 0 && marginPct < 10) {
      alerts.push({
        type: "danger",
        message: `Margem crítica de ${marginPct}%. Verifique se todos os custos estão corretos.`,
        icon: "🚨",
      });
    }
    if (rph !== null && rph < 15 && totalEarningsToday > 0) {
      alerts.push({
        type: "warning",
        message: `Ganho por hora: R$ ${rph.toFixed(2).replace(".", ",")}. Tente focar nos horários de pico.`,
        icon: "⏱️",
      });
    }
    if (levelData.pct >= 90 && !levelData.isMax) {
      alerts.push({
        type: "info",
        message: `Quase no Nível ${levelData.level + 1}! Faltam ${levelData.xpNeeded - levelData.xpInLevel} registro${levelData.xpNeeded - levelData.xpInLevel !== 1 ? "s" : ""} para subir.`,
        icon: "⭐",
      });
    }

    // ── Weekly comparison ─────────────────────────────────────────────────────
    const tw = weekBounds(0);
    const lw = weekBounds(1);
    const thisWeekEarnings = allSummaries.filter((s) => s.date >= tw.start && s.date <= tw.end).reduce((s, d) => s + d.earnings, 0);
    const lastWeekEarnings = allSummaries.filter((s) => s.date >= lw.start && s.date <= lw.end).reduce((s, d) => s + d.earnings, 0);
    const weekDelta    = thisWeekEarnings - lastWeekEarnings;
    const weekDeltaPct = lastWeekEarnings > 0 ? Math.round((weekDelta / lastWeekEarnings) * 100) : null;

    const days7 = Array.from({ length: 7 }, (_, i) => {
      const ds  = dateOffset(6 - i);
      const sum = allSummaries.find((s) => s.date === ds);
      const d   = new Date(); d.setDate(d.getDate() - (6 - i));
      return {
        date: ds,
        earnings: sum?.earnings ?? 0,
        label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
        isToday: ds === today,
      };
    });
    const maxDay7 = Math.max(...days7.map((d) => d.earnings), 1);

    // ── Shock of reality ──────────────────────────────────────────────────────
    const monthSummaries = allSummaries.filter((s) => s.date >= monthStart);
    const monthEarnings  = monthSummaries.reduce((s, d) => s + d.earnings, 0);
    const workedDays     = monthSummaries.filter((d) => d.earnings > 0).length;
    const dayOfMonth     = new Date().getDate();
    const daysInMonth    = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const daysLeft       = daysInMonth - dayOfMonth;
    const dailyAvg       = workedDays > 0 ? monthEarnings / workedDays : 0;
    const workedRatio    = dayOfMonth > 0 ? workedDays / dayOfMonth : 0;
    const projWorkedLeft = Math.round(workedRatio * daysLeft);
    const projMonthEarnings = monthEarnings + dailyAvg * projWorkedLeft;

    const varCostMonth = allCosts
      .filter((c) => (c.costType ?? "variable") === "variable" && c.date >= monthStart)
      .reduce((s, c) => s + c.amount, 0);
    const projProfit = projMonthEarnings - varCostMonth - fixedMonthlyTotal;

    const totalHoursMonth = monthSummaries.reduce((s, d) => s + (d.hoursWorked ?? 0), 0);
    const effectiveHourlyRate = totalHoursMonth > 0 ? monthEarnings / totalHoursMonth : null;
    const daysToGoal = goalMonthly > 0 && dailyAvg > 0
      ? Math.max(0, Math.ceil((goalMonthly - monthEarnings) / dailyAvg))
      : null;

    res.json({
      streak: { current: streak, longest, danger: streakDanger, fire: streak >= 3 },
      level: levelData,
      emotional,
      missions,
      alerts,
      weeklyComparison: {
        thisWeekEarnings,
        lastWeekEarnings,
        delta: weekDelta,
        deltaPct: weekDeltaPct,
        days: days7,
        maxDay: maxDay7,
      },
      shockOfReality: {
        dailyAvg,
        projectedMonth: projMonthEarnings,
        projectedProfit: projProfit,
        workedDaysThisMonth: workedDays,
        daysLeftInMonth: daysLeft,
        effectiveHourlyRate,
        daysToHitMonthlyGoal: daysToGoal,
        monthEarnings,
        goalMonthly,
        goalMonthlyPct: goalMonthly > 0
          ? Math.min(100, Math.round((monthEarnings / goalMonthly) * 100))
          : null,
      },
    });
  } catch (err: any) {
    console.error("[gamification]", err);
    res.status(500).json({ error: "Erro ao calcular gamificação" });
  }
});

export default router;
