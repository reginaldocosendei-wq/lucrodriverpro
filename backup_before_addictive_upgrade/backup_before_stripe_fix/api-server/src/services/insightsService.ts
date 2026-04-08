export type InsightStatus = "good" | "average" | "bad";

export interface Insight {
  type: string;
  status: InsightStatus;
  title: string;
  message: string;
  suggestion: string;
}

export interface Decision {
  score: number;              // 0–100 efficiency score
  status: InsightStatus;      // good / average / bad
  verdict: string;            // "EFICIENTE" | "ATENÇÃO" | "CRÍTICO"
  message: string;            // "Ótima performance. Continue rodando."
  suggestion: string;         // Actionable one-liner
  dominantCause: string;      // which factor drove the score most
  stopNow: boolean;           // true when R$/hora dropped >20% vs 7-day avg
  dropPercent: number | null; // how much it dropped, e.g. 28
}

interface DailySummaryRow {
  date: string;
  earnings: number;
  trips: number;
  kmDriven: number | null;
  hoursWorked: number | null;
  rating: number | null;
  platform: string | null;
}

interface InsightInput {
  summaries: DailySummaryRow[];
  costsToday: number;
  costsMonth: number;
  earningsToday: number;
  earningsMonth: number;
  tripsToday: number;
  hoursToday: number | null;
  kmToday: number | null;
  earningsPerHourToday: number | null;
  earningsPerTripToday: number | null;
  earningsPerKmToday: number | null;
  ratingToday: number | null;
  ratingAll: number | null;
}

function avg(nums: number[]): number | null {
  const valid = nums.filter((n) => isFinite(n) && n > 0);
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

function safeDiv(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

function getDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

export function generateInsights(input: InsightInput): Insight[] {
  const {
    summaries,
    costsToday,
    earningsToday,
    tripsToday,
    hoursToday,
    earningsPerHourToday,
    earningsPerTripToday,
    earningsPerKmToday,
    ratingToday,
    ratingAll,
  } = input;

  const insights: Insight[] = [];
  const today = getDateStr(0);
  const d7ago = getDateStr(7);
  const d14ago = getDateStr(14);

  // Summaries split: last 7 days (excluding today) and previous 7 days
  const last7 = summaries.filter((s) => s.date < today && s.date >= d7ago);
  const prev7 = summaries.filter((s) => s.date < d7ago && s.date >= d14ago);

  // ─── 1. HOURLY RATE vs TREND ──────────────────────────────────────────────
  if (earningsPerHourToday != null) {
    const avgHourly7 = avg(
      last7
        .filter((s) => s.hoursWorked && s.hoursWorked > 0)
        .map((s) => safeDiv(s.earnings, s.hoursWorked!)!)
        .filter((v): v is number => v !== null),
    );

    if (avgHourly7 !== null && avgHourly7 > 0) {
      const ratio = earningsPerHourToday / avgHourly7;
      const todayFormatted = `R$ ${earningsPerHourToday.toFixed(2).replace(".", ",")}`;
      const avgFormatted = `R$ ${avgHourly7.toFixed(2).replace(".", ",")}`;

      if (ratio >= 1.1) {
        insights.push({
          type: "hourlyRate",
          status: "good",
          title: "Hora muito mais rentável 🚀",
          message: `Você está ganhando ${todayFormatted}/hora hoje — ${Math.round((ratio - 1) * 100)}% acima da sua média de ${avgFormatted}/hora.`,
          suggestion: "Tente replicar os horários e regiões de hoje nos próximos dias.",
        });
      } else if (ratio <= 0.8) {
        insights.push({
          type: "hourlyRate",
          status: "bad",
          title: "Hora menos rentável ⚠️",
          message: `Você está ganhando ${todayFormatted}/hora — ${Math.round((1 - ratio) * 100)}% abaixo da sua média de ${avgFormatted}/hora.`,
          suggestion: "Mude de região ou aguarde um horário de maior pico para melhorar sua taxa horária.",
        });
      } else {
        insights.push({
          type: "hourlyRate",
          status: "average",
          title: "Taxa por hora estável",
          message: `Seu ganho por hora está em ${todayFormatted}, dentro da sua média de ${avgFormatted}/hora.`,
          suggestion: "Para ganhar mais por hora, foque em corridas mais longas e evite tempos ociosos.",
        });
      }
    }
  }

  // ─── 2. LONG HOURS BURNOUT ────────────────────────────────────────────────
  // "Your hourly rate dropped after X hours" — triggers when worked > 8h AND rate is below average
  if (
    hoursToday !== null &&
    hoursToday > 8 &&
    earningsPerHourToday !== null
  ) {
    const avgHourly7 = avg(
      last7
        .filter((s) => s.hoursWorked && s.hoursWorked > 0)
        .map((s) => safeDiv(s.earnings, s.hoursWorked!)!)
        .filter((v): v is number => v !== null),
    );

    if (avgHourly7 !== null && earningsPerHourToday < avgHourly7 * 0.85) {
      insights.push({
        type: "burnout",
        status: "bad",
        title: `Taxa caiu após ${Math.floor(hoursToday)}h de trabalho`,
        message: `Você já trabalhou ${hoursToday.toFixed(1)}h mas sua taxa por hora está ${Math.round((1 - earningsPerHourToday / avgHourly7) * 100)}% abaixo da sua média. Longas jornadas tendem a reduzir a eficiência.`,
        suggestion: "Considere fazer uma pausa ou encerrar o turno. Menos horas com mais qualidade rendem mais.",
      });
    }
  }

  // ─── 3. TRIP VALUE vs TREND ───────────────────────────────────────────────
  if (earningsPerTripToday != null && tripsToday >= 3) {
    const avgTrip7 = avg(
      last7
        .filter((s) => s.trips > 0)
        .map((s) => safeDiv(s.earnings, s.trips)!)
        .filter((v): v is number => v !== null),
    );

    if (avgTrip7 !== null && avgTrip7 > 0) {
      const ratio = earningsPerTripToday / avgTrip7;
      const todayFmt = `R$ ${earningsPerTripToday.toFixed(2).replace(".", ",")}`;
      const avgFmt = `R$ ${avgTrip7.toFixed(2).replace(".", ",")}`;

      if (ratio >= 1.1) {
        insights.push({
          type: "tripValue",
          status: "good",
          title: "Corridas mais rentáveis 💰",
          message: `Cada corrida rendeu ${todayFmt} hoje — ${Math.round((ratio - 1) * 100)}% a mais do que sua média de ${avgFmt}.`,
          suggestion: "Continue priorizando corridas longas. Evite cancelamentos que reduzem sua média.",
        });
      } else if (ratio <= 0.8) {
        insights.push({
          type: "tripValue",
          status: "bad",
          title: "Corridas pouco rentáveis",
          message: `Você está ganhando ${todayFmt} por corrida — ${Math.round((1 - ratio) * 100)}% abaixo da sua média de ${avgFmt}.`,
          suggestion: "Evite corridas curtas de baixo valor. Foque nas regiões onde as corridas tendem a ser mais longas.",
        });
      }
    }
  }

  // ─── 4. COST vs EARNINGS ─────────────────────────────────────────────────
  const fixedMonthlyTotal   = (input as any).fixedMonthlyTotal   ?? 0;
  const dailyFixedCostQuota = (input as any).dailyFixedCostQuota ?? 0;
  const hasFixedCosts       = fixedMonthlyTotal > 0;

  if (earningsToday > 0) {
    if (costsToday === 0 && !hasFixedCosts) {
      insights.push({
        type: "costsMissing",
        status: "average",
        title: "Custos não registrados",
        message: "Você ainda não registrou gastos de hoje. Sem isso, não é possível calcular seu lucro real.",
        suggestion: "Registre combustível, alimentação e outros custos para ver seu lucro verdadeiro.",
      });
    } else {
      // Total daily cost burden = variable costs today + fixed monthly quota
      const totalDailyCosts = costsToday + dailyFixedCostQuota;
      const costRatio = totalDailyCosts / earningsToday;

      if (costRatio > 0.5) {
        const fixedNote = hasFixedCosts
          ? ` (incluindo R$ ${dailyFixedCostQuota.toFixed(2).replace(".", ",")} de cota fixa diária)`
          : "";
        insights.push({
          type: "costRatio",
          status: "bad",
          title: "Custos muito altos hoje ❌",
          message: `Seus custos totais de hoje${fixedNote} representam ${Math.round(costRatio * 100)}% dos seus ganhos. A margem ideal fica abaixo de 40%.`,
          suggestion: "Reduza gastos variáveis desnecessários. Combustível, pedágios e alimentação podem ser otimizados.",
        });
      } else if (costRatio > 0.4) {
        insights.push({
          type: "costRatio",
          status: "average",
          title: "Custos acima do ideal",
          message: `Seus custos totais hoje são ${Math.round(costRatio * 100)}% dos seus ganhos. O ideal é ficar abaixo de 40%.`,
          suggestion: hasFixedCosts
            ? "Seus custos fixos mensais já pesam no resultado diário. Controle os gastos variáveis para compensar."
            : "Tente planejar melhor seus gastos com combustível para ganhar margem.",
        });
      } else {
        const fmtFixed = `R$ ${fixedMonthlyTotal.toFixed(2).replace(".", ",")}`;
        const profitLine = hasFixedCosts
          ? ` Seus custos fixos mensais (${fmtFixed}) já estão sendo absorvidos no cálculo diário.`
          : "";
        insights.push({
          type: "costRatio",
          status: "good",
          title: "Custos bem controlados ✓",
          message: `Seus custos representam apenas ${Math.round(costRatio * 100)}% dos seus ganhos hoje — dentro do ideal.${profitLine}`,
          suggestion: "Continue controlando seus gastos assim. Isso é o que garante seu lucro real.",
        });
      }

      // Extra insight when fixed costs are a significant burden
      if (hasFixedCosts && dailyFixedCostQuota > 0 && earningsToday > 0) {
        const fixedPct = Math.round((dailyFixedCostQuota / earningsToday) * 100);
        if (fixedPct >= 25) {
          const fmtFixed = `R$ ${fixedMonthlyTotal.toFixed(2).replace(".", ",")}`;
          insights.push({
            type: "fixedCostBurden",
            status: fixedPct >= 40 ? "bad" : "average",
            title: fixedPct >= 40 ? "Custos fixos pesam muito ⚠️" : "Atenção aos custos fixos",
            message: `Seus custos fixos mensais (${fmtFixed}) consomem ${fixedPct}% do seu faturamento diário.`,
            suggestion: "Avalie se todos os custos fixos registrados são realmente necessários.",
          });
        }
      }
    }
  }

  // ─── 5. WEEKLY PERFORMANCE TREND ─────────────────────────────────────────
  if (last7.length >= 3 && prev7.length >= 3) {
    const avgLast7 = avg(last7.map((s) => s.earnings));
    const avgPrev7 = avg(prev7.map((s) => s.earnings));

    if (avgLast7 !== null && avgPrev7 !== null && avgPrev7 > 0) {
      const change = (avgLast7 - avgPrev7) / avgPrev7;
      const pct = Math.round(Math.abs(change) * 100);

      if (change >= 0.1) {
        insights.push({
          type: "weeklyTrend",
          status: "good",
          title: `Performance em alta esta semana 📈`,
          message: `Sua média diária de ganhos subiu ${pct}% comparado à semana anterior. Você está evoluindo.`,
          suggestion: "Identifique o que mudou esta semana e tente manter esse ritmo.",
        });
      } else if (change <= -0.1) {
        insights.push({
          type: "weeklyTrend",
          status: "bad",
          title: `Performance em queda esta semana 📉`,
          message: `Sua média diária de ganhos caiu ${pct}% comparado à semana anterior.`,
          suggestion: "Revise seus horários de trabalho e as regiões que você está atendendo.",
        });
      } else {
        insights.push({
          type: "weeklyTrend",
          status: "average",
          title: "Semana estável",
          message: `Seu faturamento médio esta semana está ${change >= 0 ? "+" : ""}${pct}% em relação à semana passada.`,
          suggestion: "Tente aumentar sua eficiência por hora para crescer sem trabalhar mais.",
        });
      }
    }
  }

  // ─── 6. RATING ALERT ─────────────────────────────────────────────────────
  if (ratingToday !== null && ratingAll !== null && ratingAll > 0) {
    const drop = ratingAll - ratingToday;
    if (drop >= 0.15) {
      insights.push({
        type: "ratingDrop",
        status: "bad",
        title: "Avaliação caiu hoje ⭐",
        message: `Sua avaliação de hoje (${ratingToday.toFixed(1)}) está abaixo da sua média geral (${ratingAll.toFixed(1)}). Isso pode afetar sua visibilidade no app.`,
        suggestion: "Mantenha o veículo limpo, seja gentil e confirme o destino antes de iniciar a corrida.",
      });
    } else if (ratingToday >= 4.9) {
      insights.push({
        type: "ratingHigh",
        status: "good",
        title: "Avaliação excelente ⭐",
        message: `Sua avaliação de ${ratingToday.toFixed(1)} está entre as mais altas. Passageiros adoram você.`,
        suggestion: "Continue assim! Alta avaliação traz mais corridas e melhores destinos.",
      });
    }
  }

  // ─── 7. KM EFFICIENCY ────────────────────────────────────────────────────
  if (earningsPerKmToday !== null) {
    const avgKm7 = avg(
      last7
        .filter((s) => s.kmDriven && s.kmDriven > 0)
        .map((s) => safeDiv(s.earnings, s.kmDriven!)!)
        .filter((v): v is number => v !== null),
    );

    if (avgKm7 !== null && avgKm7 > 0) {
      const ratio = earningsPerKmToday / avgKm7;

      if (ratio <= 0.75) {
        insights.push({
          type: "kmEfficiency",
          status: "bad",
          title: "Muitos km, pouco retorno",
          message: `Você está rodando ${Math.round((1 - ratio) * 100)}% mais km por real ganho do que o normal. Corridas longas vazias ou regiões distantes estão custando caro.`,
          suggestion: "Fique mais próximo de regiões de alta demanda para reduzir km improdutivos.",
        });
      } else if (ratio >= 1.2) {
        insights.push({
          type: "kmEfficiency",
          status: "good",
          title: "Ótima eficiência por km 🏁",
          message: `Você está ganhando ${Math.round((ratio - 1) * 100)}% mais por km do que sua média. Sua rota está ótima.`,
          suggestion: "Continue nessa região e horário — a relação ganho/km está muito boa.",
        });
      }
    }
  }

  // ─── 8. STOP-TIME SIGNAL ─────────────────────────────────────────────────
  // Fires when R$/hora has dropped >20% vs 7-day average with 2+ hours worked.
  if (earningsPerHourToday != null && hoursToday !== null && hoursToday >= 2) {
    const avgH = avg(
      last7
        .filter((s) => s.hoursWorked && s.hoursWorked > 0)
        .map((s) => safeDiv(s.earnings, s.hoursWorked!)!)
        .filter((v): v is number => v !== null),
    );
    if (avgH !== null && avgH > 0) {
      const drop = (avgH - earningsPerHourToday) / avgH;
      if (drop > 0.2) {
        const pct = Math.round(drop * 100);
        insights.push({
          type: "stopTime",
          status: "bad",
          title: `Hora de parar 🛑`,
          message: `Você está trabalhando mais, mas ganhando menos. Sua taxa por hora caiu ${pct}% em relação à sua média — continuar pode não compensar.`,
          suggestion: "Encerre o turno agora e retome amanhã em um horário de maior demanda.",
        });
      }
    }
  }

  // Prioritize: bad first, then good, then average. Max 5 insights.
  const prioritized = [
    ...insights.filter((i) => i.status === "bad"),
    ...insights.filter((i) => i.status === "good"),
    ...insights.filter((i) => i.status === "average"),
  ].slice(0, 5);

  return prioritized;
}

// ─── DECISION ENGINE ─────────────────────────────────────────────────────────
// Collapses all signals into a single 0–100 efficiency score and one clear verdict.
export function calculateDecision(input: InsightInput): Decision | null {
  const {
    summaries,
    costsToday,
    earningsToday,
    tripsToday,
    hoursToday,
    earningsPerHourToday,
    earningsPerTripToday,
    earningsPerKmToday,
  } = input;

  // Need at least some today-data to make a decision
  if (earningsToday <= 0 && tripsToday <= 0) return null;

  const today = getDateStr(0);
  const d7ago = getDateStr(7);
  const d14ago = getDateStr(14);
  const last7 = summaries.filter((s) => s.date < today && s.date >= d7ago);
  const prev7 = summaries.filter((s) => s.date < d7ago && s.date >= d14ago);

  let score = 50; // neutral baseline
  let dominantCause = "geral";

  // ── Factor 1: Hourly rate vs 7-day average (weight: ±25) ──────────────────
  let hourlyDelta = 0;
  if (earningsPerHourToday != null) {
    const avgH = avg(
      last7
        .filter((s) => s.hoursWorked && s.hoursWorked > 0)
        .map((s) => safeDiv(s.earnings, s.hoursWorked!)!)
        .filter((v): v is number => v !== null),
    );
    if (avgH !== null && avgH > 0) {
      const r = earningsPerHourToday / avgH;
      if (r >= 1.15)      { score += 25; hourlyDelta = 25; }
      else if (r >= 1.0)  { score += 10; hourlyDelta = 10; }
      else if (r >= 0.85) { score -= 10; hourlyDelta = -10; }
      else                { score -= 25; hourlyDelta = -25; }
      if (Math.abs(hourlyDelta) >= 20) dominantCause = "taxa_horaria";
    }
  }

  // ── Factor 2: Trip value vs 7-day average (weight: ±15) ──────────────────
  let tripDelta = 0;
  if (earningsPerTripToday != null && tripsToday >= 2) {
    const avgT = avg(
      last7
        .filter((s) => s.trips > 0)
        .map((s) => safeDiv(s.earnings, s.trips)!)
        .filter((v): v is number => v !== null),
    );
    if (avgT !== null && avgT > 0) {
      const r = earningsPerTripToday / avgT;
      if (r >= 1.1)      { score += 15; tripDelta = 15; }
      else if (r >= 0.9) { score +=  5; tripDelta = 5;  }
      else if (r >= 0.8) { score -= 10; tripDelta = -10; }
      else               { score -= 15; tripDelta = -15; }
      if (Math.abs(tripDelta) >= 15 && Math.abs(tripDelta) > Math.abs(hourlyDelta))
        dominantCause = "valor_corrida";
    }
  }

  // ── Factor 3: Cost ratio (weight: ±20) ───────────────────────────────────
  let costDelta = 0;
  if (earningsToday > 0 && costsToday > 0) {
    const ratio = costsToday / earningsToday;
    if (ratio < 0.25)      { score += 20; costDelta = 20; }
    else if (ratio < 0.40) { score += 10; costDelta = 10; }
    else if (ratio < 0.55) { score -= 15; costDelta = -15; }
    else                   { score -= 25; costDelta = -25; }
    if (costDelta <= -20 && Math.abs(costDelta) > Math.abs(hourlyDelta))
      dominantCause = "custos";
  }

  // ── Factor 4: Burnout / long hours (weight: −10 to −20) ──────────────────
  let burnoutDelta = 0;
  if (hoursToday !== null) {
    if (hoursToday > 12)       { score -= 20; burnoutDelta = -20; }
    else if (hoursToday > 10)  { score -= 12; burnoutDelta = -12; }
    else if (hoursToday > 8)   { score -=  5; burnoutDelta = -5;  }
    if (burnoutDelta <= -12 && dominantCause === "geral")
      dominantCause = "horas_trabalhadas";
  }

  // ── Factor 5: Weekly trend (weight: ±10) ─────────────────────────────────
  if (last7.length >= 3 && prev7.length >= 3) {
    const avgL = avg(last7.map((s) => s.earnings));
    const avgP = avg(prev7.map((s) => s.earnings));
    if (avgL !== null && avgP !== null && avgP > 0) {
      const change = (avgL - avgP) / avgP;
      if (change >= 0.1)       score += 10;
      else if (change <= -0.1) score -= 10;
    }
  }

  // ── Factor 6: km efficiency (weight: ±10) ────────────────────────────────
  if (earningsPerKmToday !== null) {
    const avgKm = avg(
      last7
        .filter((s) => s.kmDriven && s.kmDriven > 0)
        .map((s) => safeDiv(s.earnings, s.kmDriven!)!)
        .filter((v): v is number => v !== null),
    );
    if (avgKm !== null && avgKm > 0) {
      const r = earningsPerKmToday / avgKm;
      if (r >= 1.2)      score += 10;
      else if (r <= 0.75) score -= 10;
    }
  }

  // Clamp 0–100
  score = Math.round(Math.max(0, Math.min(100, score)));

  // ── Build verdict ─────────────────────────────────────────────────────────
  const status: InsightStatus =
    score >= 70 ? "good" : score >= 45 ? "average" : "bad";

  const verdict =
    score >= 70 ? "EFICIENTE" : score >= 45 ? "ATENÇÃO" : "CRÍTICO";

  // Context-aware messages based on dominant cause
  const messages: Record<string, { good: string; average: string; bad: string }> = {
    taxa_horaria: {
      good: "Sua taxa por hora está acima da média. Ótimo momento para continuar rodando.",
      average: "Sua taxa por hora está moderada. Avalie se vale a pena continuar nessa região.",
      bad: "Sua performance por hora caiu significativamente. Considere encerrar o turno em breve.",
    },
    valor_corrida: {
      good: "Corridas muito rentáveis hoje. Continue priorizando essa estratégia.",
      average: "Valor médio por corrida abaixo do esperado. Filtre corridas curtas.",
      bad: "Suas corridas estão rendendo pouco. Mude de região ou aguarde maior demanda.",
    },
    custos: {
      good: "Custos controlados. Sua margem de lucro está saudável.",
      average: "Seus custos estão reduzindo seu lucro. Planeje melhor os gastos.",
      bad: "Custos muito altos. Cada real gasto está corroendo seu lucro real.",
    },
    horas_trabalhadas: {
      good: "Bom equilíbrio de horas. Mantenha o ritmo.",
      average: "Jornada longa. Monitore sua taxa por hora para não perder eficiência.",
      bad: "Você trabalhou muitas horas. Sua eficiência tende a cair — considere uma pausa.",
    },
    geral: {
      good: "Ótima performance geral. Continue rodando — o momento é favorável.",
      average: "Performance estável. Há espaço para melhorar eficiência e reduzir custos.",
      bad: "Performance abaixo do ideal. Revise horários, região e gastos.",
    },
  };

  const suggestions: Record<string, { good: string; average: string; bad: string }> = {
    taxa_horaria: {
      good: "Aproveite o pico atual — cada hora agora vale mais.",
      average: "Tente mudar para uma região de maior demanda.",
      bad: "Pause, descanse e recomece em um horário de pico.",
    },
    valor_corrida: {
      good: "Prefira aceitar corridas acima de R$ 15 para manter a média.",
      average: "Evite aceitar corridas abaixo de R$ 10.",
      bad: "Mova-se para o centro ou aeroporto onde as corridas costumam ser mais longas.",
    },
    custos: {
      good: "Continue registrando todos os gastos para manter o controle.",
      average: "Reduza paradas desnecessárias que aumentam o consumo de combustível.",
      bad: "Cadastre seus custos detalhados e identifique onde cortar.",
    },
    horas_trabalhadas: {
      good: "Planeje uma pausa a cada 3–4 horas para manter o foco.",
      average: "Faça uma pausa de 20 minutos para recuperar a concentração.",
      bad: "Encerre o turno — sua saúde e segurança valem mais que corridas extras.",
    },
    geral: {
      good: "Replique os horários e regiões de hoje na próxima semana.",
      average: "Registre seus resultados diariamente para identificar padrões.",
      bad: "Analise quais dias e horários deram mais retorno e foque neles.",
    },
  };

  const cause = dominantCause in messages ? dominantCause : "geral";

  // ── Stop-time detection ────────────────────────────────────────────────────
  // Fires when R$/hora today has dropped >20% vs the 7-day average,
  // AND the driver has been working at least 2 hours (avoids false early alarms).
  let stopNow = false;
  let dropPercent: number | null = null;

  if (earningsPerHourToday != null && hoursToday != null && hoursToday >= 2) {
    const avgH = avg(
      last7
        .filter((s) => s.hoursWorked && s.hoursWorked > 0)
        .map((s) => safeDiv(s.earnings, s.hoursWorked!)!)
        .filter((v): v is number => v !== null),
    );
    if (avgH !== null && avgH > 0) {
      const drop = (avgH - earningsPerHourToday) / avgH;
      if (drop > 0.2) {
        stopNow = true;
        dropPercent = Math.round(drop * 100);
      }
    }
  } else if (hoursToday != null && hoursToday >= 12) {
    // No historical data but worked 12+ hours — always recommend stopping
    stopNow = true;
  }

  return {
    score,
    status,
    verdict,
    message: messages[cause][status],
    suggestion: suggestions[cause][status],
    dominantCause: cause,
    stopNow,
    dropPercent,
  };
}
