// ─── Daily Analysis Engine ────────────────────────────────────────────────────
// Evaluates the driver's full workday and produces a structured report.
// No external API — pure rule-based logic running in the browser.

export type DayStatus = "great_day" | "good_day" | "weak_day" | "not_worth_it";

export interface DailyAnalysis {
  status:          DayStatus;
  mainMessage:     string;
  warnings:        string[];
  recommendations: string[];
  /** Computed numbers exposed for the UI */
  profit:          number;
  costRatio:       number | null;
  earningsPerHour: number | null;
  earningsPerTrip: number | null;
  earningsPerKm:   number | null;
  goalPct:         number | null;
}

export interface DailyInput {
  earnings:      number;
  costs:         number;
  trips:         number;
  km:            number | null;
  hours:         number | null;
  rating:        number | null;
  goalDaily:     number;
  earningsPerHourToday: number | null;
  earningsPerTripToday: number | null;
  earningsPerKmToday:   number | null;
}

const R = (n: number, dec = 2) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: dec, maximumFractionDigits: dec });

function pct(n: number) { return `${Math.round(n)}%`; }

export function analyzDay(input: DailyInput): DailyAnalysis | null {
  const {
    earnings, costs, trips, km, hours, rating,
    goalDaily,
    earningsPerHourToday,
    earningsPerTripToday,
    earningsPerKmToday,
  } = input;

  // Truly insufficient data — nothing to say
  if (earnings <= 0 && trips <= 0) return null;

  // ─── Core numbers ──────────────────────────────────────────────────────────
  const profit        = earnings - costs;
  const costRatio     = earnings > 0 && costs > 0 ? costs / earnings : null;
  const hasCosts      = costs > 0;
  const rph           = earningsPerHourToday;
  const rpt           = earningsPerTripToday;
  const rpkm          = earningsPerKmToday;
  const tripsPerHour  = hours && hours > 0 && trips > 0 ? trips / hours : null;
  const goalPct       = goalDaily > 0 ? (earnings / goalDaily) * 100 : null;

  const warnings:        string[] = [];
  const recommendations: string[] = [];

  // ─── 1. Status determination ───────────────────────────────────────────────
  let status: DayStatus;

  if (profit <= 0) {
    status = "not_worth_it";
  } else if (costRatio !== null && costRatio > 0.6) {
    status = "weak_day";
  } else if (costRatio !== null && costRatio > 0.4) {
    // Costs are high but there's still profit
    if (goalPct !== null && goalPct >= 80) {
      status = "good_day";
    } else {
      status = "weak_day";
    }
  } else if (costRatio !== null && costRatio <= 0.4) {
    if (goalPct !== null && goalPct >= 90) {
      status = "great_day";
    } else if (goalPct !== null && goalPct < 50) {
      status = "weak_day";
    } else {
      status = "good_day";
    }
  } else {
    // No costs registered
    if (earnings > 0 && trips >= 5) {
      status = goalPct !== null && goalPct >= 90 ? "great_day" : "good_day";
    } else {
      status = "good_day";
    }
  }

  // Override: if no costs and earnings are actually low, stay conservative
  if (!hasCosts && earnings > 0 && earnings < 60) {
    if (status === "great_day") status = "good_day";
  }

  // ─── 2. Main message ──────────────────────────────────────────────────────
  let mainMessage: string;

  const profitFmt = R(Math.abs(profit));

  if (status === "not_worth_it") {
    if (profit < 0) {
      mainMessage = `Hoje ficou no negativo. Você gastou ${R(Math.abs(profit))} a mais do que ganhou — é hora de rever os custos.`;
    } else if (costRatio !== null && costRatio > 0.75) {
      mainMessage = `Hoje quase não valeu a pena. Seus custos consumiram ${pct(costRatio * 100)} dos seus ganhos, sobrando muito pouco de lucro real.`;
    } else {
      mainMessage = "Hoje não compensou. Os custos foram altos demais para o resultado obtido.";
    }
  } else if (status === "weak_day") {
    if (costRatio !== null && costRatio > 0.4) {
      mainMessage = `Dia fraco. Você ganhou ${R(earnings)}, mas os custos reduziram seu lucro real para ${R(profit)}.`;
    } else if (goalPct !== null && goalPct < 50) {
      mainMessage = `Dia abaixo do esperado. Você atingiu apenas ${pct(goalPct)} da sua meta diária de ${R(goalDaily)}.`;
    } else {
      mainMessage = `Dia moderado. Seu lucro real foi de ${R(profit)} — há espaço para melhorar.`;
    }
  } else if (status === "good_day") {
    if (goalPct !== null && goalPct >= 80) {
      mainMessage = `Bom dia! Você atingiu ${pct(goalPct)} da sua meta e teve um lucro real de ${R(profit)}.`;
    } else if (rph !== null && rph >= 30) {
      mainMessage = `Dia razoável. Seu ganho por hora ficou em ${R(rph)}, com lucro real de ${R(profit)}.`;
    } else {
      mainMessage = `Dia positivo. Seu lucro real foi de ${R(profit)} com custos sob controle.`;
    }
  } else {
    // great_day
    if (goalPct !== null && goalPct >= 100) {
      mainMessage = `Excelente! Você bateu sua meta diária e teve um lucro real de ${R(profit)}. Hoje foi muito produtivo.`;
    } else if (rph !== null && rph >= 40) {
      mainMessage = `Ótimo dia! Seu ganho por hora ficou em ${R(rph)} e o lucro real foi de ${R(profit)}. Consistência no melhor nível.`;
    } else {
      mainMessage = `Ótimo dia! Seu lucro ficou forte: ${R(profit)} após descontar todos os custos.`;
    }
  }

  // ─── 3. Warnings ───────────────────────────────────────────────────────────

  // Costs-related
  if (!hasCosts && earnings > 0) {
    warnings.push("Você não registrou nenhum custo hoje. Sem isso, o lucro mostrado pode estar inflado.");
  } else if (costRatio !== null) {
    if (costRatio > 0.6) {
      warnings.push(`Seus custos representam ${pct(costRatio * 100)} dos ganhos — bem acima do ideal de 40%.`);
    } else if (costRatio > 0.4) {
      warnings.push(`Seus custos (${pct(costRatio * 100)} dos ganhos) estão um pouco acima do ideal de 40%.`);
    }
  }

  // Hourly rate
  if (rph !== null && rph < 20) {
    warnings.push(`Seu ganho por hora foi de apenas ${R(rph)}, que é muito baixo para o tempo investido.`);
  } else if (rph !== null && rph < 30) {
    warnings.push(`Seu ganho por hora (${R(rph)}) está abaixo do que costuma ser rentável.`);
  }

  // Low trip frequency
  if (tripsPerHour !== null && hours! >= 3 && tripsPerHour < 1.5) {
    warnings.push(`Você fez ${trips} corridas em ${hours!.toFixed(1)}h — menos de 2 corridas por hora, indicando tempo ocioso.`);
  }

  // Long day with poor returns
  if (hours !== null && hours > 10) {
    warnings.push(`Você trabalhou ${hours.toFixed(1)} horas hoje. Jornadas muito longas tendem a reduzir a eficiência.`);
  }

  // Goal missed
  if (goalPct !== null && goalPct < 70 && goalDaily > 0) {
    const missing = goalDaily - earnings;
    warnings.push(`Você ficou ${R(missing)} abaixo da sua meta diária de ${R(goalDaily)}.`);
  }

  // Rating drop
  if (rating !== null && rating < 4.7) {
    warnings.push(`Sua avaliação de hoje (${rating.toFixed(1)}) está abaixo do ideal. Avaliações baixas podem reduzir sua visibilidade.`);
  }

  // ─── 4. Recommendations ────────────────────────────────────────────────────

  if (!hasCosts) {
    recommendations.push("Registre combustível e outros gastos diariamente para ver seu lucro real com precisão.");
  } else if (costRatio !== null && costRatio > 0.4) {
    recommendations.push("Planeje melhor os gastos com combustível — priorize abastecimentos em horários ou postos mais baratos.");
    recommendations.push("Reduza paradas desnecessárias que aumentam o consumo e o desgaste do veículo.");
  }

  if (rph !== null && rph < 25) {
    recommendations.push("Considere encerrar o turno quando o ganho por hora cair muito — descansar e recomeçar em horário de pico costuma render mais.");
  }

  if (tripsPerHour !== null && tripsPerHour < 1.5 && hours! >= 3) {
    recommendations.push("Fique em regiões de maior demanda para reduzir o tempo ocioso entre corridas.");
  }

  if (goalPct !== null && goalPct < 70 && goalDaily > 0) {
    recommendations.push("Revise sua meta diária ou os horários em que você trabalha para aumentar suas chances de atingi-la.");
  }

  if (status === "great_day") {
    recommendations.push("Replique os horários e regiões de hoje nos próximos dias — isso está funcionando bem para você.");
  }

  if (hours !== null && hours > 10) {
    recommendations.push("Planeje pausas a cada 3–4 horas. Isso aumenta o foco e, consequentemente, a rentabilidade por hora.");
  }

  if (status === "good_day" && costRatio !== null && costRatio < 0.3) {
    recommendations.push("Seu controle de custos está ótimo. Continue registrando tudo para manter esse padrão.");
  }

  // Keep it concise: max 3 warnings, max 3 recommendations
  return {
    status,
    mainMessage,
    warnings:        warnings.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
    profit,
    costRatio,
    earningsPerHour: rph,
    earningsPerTrip: rpt,
    earningsPerKm:   rpkm,
    goalPct,
  };
}
