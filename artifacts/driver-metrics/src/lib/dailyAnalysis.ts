// ─── Daily Analysis Engine v2 ─────────────────────────────────────────────────
// Produces a structured, human-sounding evaluation of the driver's workday.
// All computation runs in the browser — no external API call needed.

export type DayStatus = "great_day" | "good_day" | "weak_day" | "not_worth_it";

export interface HistoryEntry {
  date:        string;
  earnings:    number;
  trips:       number;
  kmDriven:    number | null;
  hoursWorked: number | null;
}

export interface DailyInput {
  // Today
  earnings:    number;
  costs:       number;
  trips:       number;
  km:          number | null;
  hours:       number | null;
  rating:      number | null;
  goalDaily:   number;

  // Per-trip/km/hour — today
  earningsPerHourToday: number | null;
  earningsPerTripToday: number | null;
  earningsPerKmToday:   number | null;

  // All-time averages (for baseline comparison)
  earningsPerHourAll: number | null;
  earningsPerTripAll: number | null;
  earningsPerKmAll:   number | null;

  // Historical days (last N days, excluding today)
  history: HistoryEntry[];
}

export interface DailyAnalysis {
  status:          DayStatus;
  mainMessage:     string;
  warnings:        string[];
  recommendations: string[];

  // Derived numbers exposed for the UI
  profit:     number;
  costRatio:  number | null;
  goalPct:    number | null;
  trendPct:   number | null;  // % above/below 5-day earnings average
}

// ─── Formatters ──────────────────────────────────────────────────────────────
const R = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Rn = (n: number, dec = 0) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: dec, maximumFractionDigits: dec });

const pct = (n: number) => `${Math.round(Math.abs(n))}%`;

const today = () => new Date().toISOString().slice(0, 10);

// ─── Main function ────────────────────────────────────────────────────────────
export function analyzDay(input: DailyInput): DailyAnalysis | null {
  const {
    earnings, costs, trips, km, hours, rating,
    goalDaily,
    earningsPerHourToday: rph,
    earningsPerTripToday: rpt,
    earningsPerKmToday:   rpkm,
    earningsPerHourAll,
    earningsPerTripAll,
    earningsPerKmAll,
    history,
  } = input;

  if (earnings <= 0 && trips <= 0) return null;

  // ── Core numbers ────────────────────────────────────────────────────────────
  const profit       = earnings - costs;
  const hasCosts     = costs > 0;
  const costRatio    = earnings > 0 && hasCosts ? costs / earnings : null;
  const marginPct    = earnings > 0 ? (profit / earnings) * 100 : 0;
  const tripsPerHour = hours != null && hours > 0 && trips > 0 ? trips / hours : null;
  const goalPct      = goalDaily > 0 ? (earnings / goalDaily) * 100 : null;
  const goalMissing  = goalDaily > 0 ? Math.max(0, goalDaily - earnings) : 0;

  // ── 5-day earnings trend (exclude today) ───────────────────────────────────
  const todayStr  = today();
  const recentDays = history
    .filter((h) => h.date !== todayStr && h.earnings > 0)
    .slice(0, 5);

  const avgRecentEarnings =
    recentDays.length >= 2
      ? recentDays.reduce((s, h) => s + h.earnings, 0) / recentDays.length
      : null;

  const trendPct =
    avgRecentEarnings != null && avgRecentEarnings > 0
      ? ((earnings - avgRecentEarnings) / avgRecentEarnings) * 100
      : null;

  // ── Pattern flags ────────────────────────────────────────────────────────
  const isHighRevenueWeakProfit =
    hasCosts && earnings >= 120 && costRatio !== null && costRatio > 0.45;

  const isShortTripsPattern =
    rph != null && rpkm != null &&
    rph >= 25 && rpkm != null && rpkm < 0.80;

  const isIdleTime =
    tripsPerHour !== null && hours != null && hours >= 3 && tripsPerHour < 1.5;

  const rphVsAvg =
    rph != null && earningsPerHourAll != null && earningsPerHourAll > 0
      ? ((rph - earningsPerHourAll) / earningsPerHourAll) * 100
      : null;

  const rptVsAvg =
    rpt != null && earningsPerTripAll != null && earningsPerTripAll > 0
      ? ((rpt - earningsPerTripAll) / earningsPerTripAll) * 100
      : null;

  const rpkmVsAvg =
    rpkm != null && earningsPerKmAll != null && earningsPerKmAll > 0
      ? ((rpkm - earningsPerKmAll) / earningsPerKmAll) * 100
      : null;

  // ── 1. Status ────────────────────────────────────────────────────────────
  let status: DayStatus;

  if (profit <= 0) {
    status = "not_worth_it";
  } else if (costRatio !== null && costRatio > 0.60) {
    status = "not_worth_it";
  } else if (costRatio !== null && costRatio > 0.45) {
    status = goalPct !== null && goalPct >= 85 ? "good_day" : "weak_day";
  } else if (goalPct !== null && goalPct < 45 && goalDaily > 0) {
    status = "weak_day";
  } else if (!hasCosts && earnings < 70) {
    status = "good_day";
  } else {
    const isGreat =
      profit > 0 &&
      (costRatio === null || costRatio <= 0.38) &&
      (goalPct === null || goalPct >= 85) &&
      (trendPct === null || trendPct >= -5);

    status = isGreat ? "great_day" : "good_day";
  }

  // ── 2. Main message ──────────────────────────────────────────────────────
  let mainMessage: string;

  if (status === "not_worth_it") {
    if (profit < 0) {
      mainMessage = `Hoje não valeu. Você ficou no vermelho: gastou ${R(Math.abs(profit))} a mais do que ganhou. Vale a pena revisar onde esse dinheiro foi.`;
    } else if (costRatio !== null && costRatio > 0.60) {
      mainMessage = `Os custos engoliu o dia. Você ganhou ${R(earnings)}, mas ${pct(costRatio * 100)} foi embora com despesas — sobrou muito pouco para chamar de lucro.`;
    } else {
      mainMessage = `O dia de hoje não compensou. O resultado ficou abaixo do mínimo para cobrir o esforço.`;
    }
  } else if (status === "weak_day") {
    if (isHighRevenueWeakProfit) {
      mainMessage = `Dia de alto faturamento, mas o lucro escapou pelos custos. Você movimentou ${R(earnings)} e ficou com apenas ${R(profit)} no bolso — margem de ${pct(marginPct)}.`;
    } else if (goalPct !== null && goalPct < 45 && goalDaily > 0) {
      mainMessage = `Dia abaixo do esperado. Você atingiu ${pct(goalPct)} da meta e ficou ${R(goalMissing)} longe — o esforço existiu, mas o resultado não acompanhou.`;
    } else if (trendPct !== null && trendPct < -20) {
      mainMessage = `Dia fraco comparado à sua média recente. Você ganhou ${pct(Math.abs(trendPct))} menos que nos últimos ${recentDays.length} dias — pode ter sido um dia ruim de demanda.`;
    } else {
      mainMessage = `Resultado moderado. Seu lucro real foi de ${R(profit)}, mas ainda há espaço para melhorar a eficiência.`;
    }
  } else if (status === "good_day") {
    if (isShortTripsPattern) {
      mainMessage = `Bom dia no volume, mas o padrão de corridas curtas comprimiu o ganho por km. Você rendeu bem por hora (${Rn(rph!)}/h), mas cada quilômetro valeu menos que o ideal.`;
    } else if (trendPct !== null && trendPct >= 15) {
      mainMessage = `Dia acima da sua média! Você ganhou ${pct(trendPct)} mais que nos últimos ${recentDays.length} dias — isso mostra que a estratégia de hoje funcionou.`;
    } else if (goalPct !== null && goalPct >= 90) {
      mainMessage = `Quase lá! Você atingiu ${pct(goalPct)} da meta com lucro de ${R(profit)} — faltou pouco para um dia perfeito.`;
    } else if (rph != null && rph >= 35) {
      mainMessage = `Dia positivo. Seu ganho por hora ficou em ${Rn(rph!)}/h e o lucro real foi de ${R(profit)} — ritmo consistente.`;
    } else {
      mainMessage = `Dia positivo. Você fechou com ${R(profit)} de lucro real e os custos ficaram sob controle. Nada a reclamar.`;
    }
  } else {
    // great_day
    if (goalPct !== null && goalPct >= 100) {
      mainMessage = `Meta batida e lucro sólido: ${R(profit)} no bolso depois de pagar todas as despesas. Hoje foi um dos bons — repita essa fórmula.`;
    } else if (trendPct !== null && trendPct >= 25) {
      mainMessage = `Dia fora da curva — você ganhou ${pct(trendPct)} acima da sua média dos últimos dias. Algo funcionou muito bem hoje, vale entender o que foi.`;
    } else if (rph != null && rph >= 40) {
      mainMessage = `Dia eficiente de verdade. ${Rn(rph!)}/h é um ritmo excelente, e o lucro de ${R(profit)} mostra que o tempo foi bem investido.`;
    } else {
      mainMessage = `Ótimo dia! Você ganhou bem, manteve os custos no lugar e fechou com ${R(profit)} de lucro real. Assim é que funciona.`;
    }
  }

  // ── 3. Warnings ──────────────────────────────────────────────────────────
  const warnings: string[] = [];

  // Missing costs
  if (!hasCosts && earnings > 0) {
    warnings.push("Nenhum custo registrado hoje. Sem combustível, alimentação e outros gastos, o lucro que aparece está inflado.");
  }

  // High cost ratio
  if (costRatio !== null && costRatio > 0.45) {
    warnings.push(
      `Seus custos representam ${pct(costRatio * 100)} dos ganhos — ideal é ficar abaixo de 40%. ${isHighRevenueWeakProfit ? "Faturamento alto não resolve se a despesa acompanha." : ""}`
        .trim()
    );
  }

  // Low hourly rate
  if (rph != null && rph < 22) {
    const vsAvg = rphVsAvg != null ? ` (${pct(Math.abs(rphVsAvg))} ${rphVsAvg < 0 ? "abaixo" : "acima"} da sua média habitual)` : "";
    warnings.push(`Você ganhou apenas ${Rn(rph)}/h${vsAvg}. Para o tempo investido, o retorno ficou muito baixo.`);
  } else if (rphVsAvg !== null && rphVsAvg < -20) {
    warnings.push(`Seu ganho por hora (${Rn(rph!)}/h) ficou ${pct(Math.abs(rphVsAvg))} abaixo da sua média — hoje não foi o seu ritmo.`);
  }

  // Idle time / low trips per hour
  if (isIdleTime) {
    const idleHours = hours != null ? (hours - trips / 2).toFixed(1) : null;
    warnings.push(
      `${trips} corridas em ${hours!.toFixed(1)}h significa que você ficou parado boa parte do tempo.${idleHours ? ` Estima-se ~${idleHours}h de espera.` : ""}`
    );
  }

  // Short trips pattern warning
  if (isShortTripsPattern) {
    warnings.push(`Seu ganho por km (${rpkm!.toFixed(2)}/km) está baixo apesar de um bom ganho por hora — padrão de corridas muito curtas, que desgastam mais o veículo por real ganho.`);
  }

  // Earnings per trip down vs average
  if (rptVsAvg !== null && rptVsAvg < -18 && rpt != null) {
    warnings.push(`Valor médio por corrida (${R(rpt)}) está ${pct(Math.abs(rptVsAvg))} abaixo da sua média histórica — corridas mais curtas ou com tarifas menores hoje.`);
  }

  // Trend warning
  if (trendPct !== null && trendPct < -25 && recentDays.length >= 3) {
    warnings.push(`Você ganhou ${pct(Math.abs(trendPct))} menos que sua média dos últimos ${recentDays.length} dias (${R(avgRecentEarnings!)}) — abaixo do seu padrão recente.`);
  }

  // Long day
  if (hours != null && hours > 10) {
    warnings.push(`Você trabalhou ${hours.toFixed(1)} horas. Jornadas longas costumam reduzir o foco e piorar o ganho por hora nas últimas horas.`);
  }

  // Goal missed significantly
  if (goalPct !== null && goalPct < 60 && goalDaily > 0) {
    warnings.push(`Você ficou ${R(goalMissing)} longe da sua meta de ${R(goalDaily)} — atingiu só ${pct(goalPct)}.`);
  }

  // Rating
  if (rating != null && rating < 4.7) {
    warnings.push(`Avaliação de ${rating.toFixed(1)} está abaixo do ideal. Isso pode reduzir sua prioridade nas plataformas.`);
  }

  // ── 4. Recommendations ───────────────────────────────────────────────────
  const recommendations: string[] = [];

  // No costs → register them
  if (!hasCosts) {
    recommendations.push("Registre combustível, alimentação e desgaste do veículo todos os dias — sem isso você não sabe se realmente está lucrando.");
  } else if (costRatio !== null && costRatio > 0.45) {
    recommendations.push("Revise seus maiores custos: compare postos de combustível na sua rota e corte gastos que não são obrigatórios.");
    if (isHighRevenueWeakProfit) {
      recommendations.push("Em dias de alto faturamento, o custo tende a subir junto. Defina um teto de gasto diário e não ultrapasse mesmo nos dias bons.");
    }
  }

  // Low hourly rate — adjust when to work
  if (rph != null && rph < 25) {
    recommendations.push("Considere encerrar o turno quando o ritmo cair. Hora parado esperando corrida tem custo de desgaste e combustível, mas sem retorno.");
  }

  // Idle time → position strategy
  if (isIdleTime) {
    recommendations.push("Fique em regiões de alta demanda nos seus horários de pico. Menos espera entre corridas é o jeito mais fácil de aumentar o ganho por hora.");
  }

  // Short trips pattern → seek longer rides
  if (isShortTripsPattern) {
    recommendations.push("Corridas curtas rendem por hora, mas desgastam mais por km. Experimente aceitar corridas de bairros que gerem trajetos mais longos quando a demanda estiver alta.");
  }

  // Trend up → replicate
  if (trendPct !== null && trendPct >= 20) {
    recommendations.push("Anote os horários e regiões de hoje. Quando um dia bate a média assim, geralmente tem algo repetível na estratégia.");
  }

  // Trend down → investigate
  if (trendPct !== null && trendPct < -20) {
    recommendations.push("Quando o resultado cai muito abaixo da média, vale investigar: foi horário errado, região de baixa demanda ou dia fraco na plataforma?");
  }

  // Goal
  if (goalPct !== null) {
    if (goalPct >= 100) {
      recommendations.push("Meta batida! Considere definir metas semanais além das diárias — isso ajuda a sustentar o resultado bom sem depender de um único dia.");
    } else if (goalPct < 60 && goalDaily > 0) {
      recommendations.push("Se sua meta está difícil de bater consistentemente, pode ser que ela esteja alta demais para os dias disponíveis. Ajuste ou distribua o objetivo ao longo da semana.");
    }
  }

  // Long hours
  if (hours != null && hours > 10) {
    recommendations.push("Tente dividir jornadas longas em dois turnos com intervalo. Dados mostram que a produtividade por hora cai depois de 7–8h contínuas.");
  }

  // Good cost control → acknowledge it
  if (hasCosts && costRatio !== null && costRatio < 0.30 && status !== "not_worth_it") {
    recommendations.push("Seu controle de custos hoje foi ótimo. Manter esse padrão é o que separa um bom mês de um mês mediano.");
  }

  // Trim to max 3 each — prioritize most impactful
  return {
    status,
    mainMessage,
    warnings:        warnings.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
    profit,
    costRatio,
    goalPct,
    trendPct,
  };
}
