export type InsightStatus = "good" | "average" | "bad";

export interface Insight {
  type: string;
  status: InsightStatus;
  title: string;
  message: string;
  suggestion: string;
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
  if (earningsToday > 0) {
    if (costsToday === 0) {
      insights.push({
        type: "costsMissing",
        status: "average",
        title: "Custos não registrados",
        message: "Você ainda não registrou gastos de hoje. Sem isso, não é possível calcular seu lucro real.",
        suggestion: "Registre combustível, alimentação e outros custos para ver seu lucro verdadeiro.",
      });
    } else {
      const costRatio = costsToday / earningsToday;

      if (costRatio > 0.5) {
        insights.push({
          type: "costRatio",
          status: "bad",
          title: "Custos muito altos hoje ❌",
          message: `Seus custos de hoje (R$ ${costsToday.toFixed(2).replace(".", ",")}) representam ${Math.round(costRatio * 100)}% dos seus ganhos. A margem ideal fica abaixo de 40%.`,
          suggestion: "Reduza gastos desnecessários. Combustível, pedágios e alimentação podem ser otimizados.",
        });
      } else if (costRatio > 0.4) {
        insights.push({
          type: "costRatio",
          status: "average",
          title: "Custos acima do ideal",
          message: `Seus custos hoje são ${Math.round(costRatio * 100)}% dos seus ganhos. O ideal é ficar abaixo de 40%.`,
          suggestion: "Tente planejar melhor seus gastos com combustível para ganhar margem.",
        });
      } else {
        insights.push({
          type: "costRatio",
          status: "good",
          title: "Custos bem controlados ✓",
          message: `Seus custos representam apenas ${Math.round(costRatio * 100)}% dos seus ganhos hoje — dentro do ideal.`,
          suggestion: "Continue controlando seus gastos assim. Isso é o que garante seu lucro real.",
        });
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

  // Prioritize: bad first, then good, then average. Max 5 insights.
  const prioritized = [
    ...insights.filter((i) => i.status === "bad"),
    ...insights.filter((i) => i.status === "good"),
    ...insights.filter((i) => i.status === "average"),
  ].slice(0, 5);

  return prioritized;
}
