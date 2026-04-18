/**
 * assistant.ts — Real-Time Ride Offer Analysis
 *
 * Architecture note (Android upgrade path):
 * The /analyze endpoint is image-agnostic. Whether the image comes from:
 *   - A camera photo (MVP)
 *   - A gallery file upload (MVP)
 *   - An Android AccessibilityService screenshot (future)
 *   - A MediaProjection frame (future)
 * ...the pipeline is identical: image → OCR → profit engine → verdict.
 * The capture method is an implementation detail of the client, not the server.
 */

import { Router } from "express";
import multer from "multer";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, offerCapturesTable } from "@workspace/db";
import { eq, desc, and, gte } from "drizzle-orm";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── OCR PROMPT ───────────────────────────────────────────────────────────────
// Tuned specifically for Brazilian ride-sharing offer screens.
// Each app has distinct UI patterns documented below.
const OFFER_PROMPT = `Você é um sistema especializado em ler capturas de tela de OFERTAS DE CORRIDA de aplicativos de transporte no Brasil.

CONTEXTO: O motorista está trabalhando e fotografou a tela do celular quando uma nova corrida apareceu. Sua tarefa é extrair os dados da oferta ANTES de o motorista aceitar ou rejeitar.

APLICATIVOS SUPORTADOS e seus padrões visuais:
- UBER: tela preta/escura, valor em verde ou branco em destaque, distância e tempo estimado visíveis
- 99: tela roxa/azul, valor em destaque, bairros de origem/destino mostrados
- INDRIVE: tela azul, valor proposto pelo passageiro, distância e tempo
- CABIFY: tela roxa, similar ao Uber
- LADOT / OUTROS: variado

CAMPOS A EXTRAIR:

1. isRideOffer (boolean)
   - true = é claramente uma tela de oferta/solicitação de corrida
   - false = é outro tipo de tela (resumo de ganhos, configurações, mapa, etc.)
   - Em caso de dúvida, use true

2. price (número decimal)
   - O valor em R$ que o motorista VAI RECEBER pela corrida
   - "R$ 12,50" → 12.5 | "R$8.90" → 8.9 | "12,50" → 12.5
   - NÃO extraia taxas, comissões ou valores de passageiro
   - Se não conseguir identificar com certeza → null

3. distanceKm (número decimal)
   - Distância TOTAL da corrida (não a distância até o embarque)
   - "2,3 km" → 2.3 | "1.5km" → 1.5 | "850 m" → 0.85
   - Prefira distância total da corrida sobre distância até o passageiro
   - Se só houver distância até o passageiro, use ela e marque em confidence

4. estimatedMinutes (número inteiro)
   - Tempo estimado TOTAL da corrida em minutos
   - "12 min" → 12 | "1h 5min" → 65 | "45s" → 1 | "3:20" → 200 (se formato mm:ss) ou 3 (se hh:mm)
   - Interprete como mm:ss se valor menor que 1 hora, hh:mm se formato com hora
   - Se só houver tempo até o passageiro → use e marque como baixa confiança

5. pickup (string)
   - Endereço ou bairro de embarque (onde o motorista vai buscar o passageiro)
   - Extraia o texto exato como aparece na tela
   - null se não visível

6. destination (string)
   - Endereço ou bairro de destino
   - MUITOS apps escondem o destino — null é o valor esperado frequentemente
   - null se não visível

7. platform (string)
   - "Uber" | "99" | "InDrive" | "Cabify" | "Outro"
   - Identifique pelo logo, cores e layout

8. confidence (string)
   - "high" = todos os campos principais (price, distance, time) identificados com certeza
   - "medium" = price identificado, distance ou time podem ter estimativa
   - "low" = um ou mais campos principais não identificados ou incertos

REGRAS ABSOLUTAS:
- Responda APENAS com JSON válido
- null para campos não identificados (nunca invente)
- Seja conservador: se não tiver certeza, use null

FORMATO DE RESPOSTA (exatamente assim, sem markdown):
{"isRideOffer": true, "price": 12.5, "distanceKm": 4.2, "estimatedMinutes": 18, "pickup": "Vila Madalena", "destination": null, "platform": "Uber", "confidence": "high"}`;

// ─── PROFIT ENGINE ────────────────────────────────────────────────────────────
// Calculates real driver profit after variable and fixed costs.
// Formula:
//   profitPerKm = (price - variable_costs) / distance
//   profitPerHour = (price - variable_costs - fixed_costs_during_ride) / hours
//   netProfit = price - variable_costs
//
// variable_costs = costPerKm * distanceKm (fuel + wear)
// fixed_costs_during_ride = fixedCostPerHour * hours (loan, insurance, tracker pro-rated)

function calcProfit(
  price: number | null,
  distanceKm: number | null,
  estimatedMinutes: number | null,
  costPerKm: number,
  fixedCostPerHour: number,
) {
  let profitPerKm: number | null = null;
  let profitPerHour: number | null = null;
  let netProfit: number | null = null;

  if (price !== null && distanceKm !== null && distanceKm > 0) {
    const variableCosts = costPerKm * distanceKm;
    profitPerKm = (price - variableCosts) / distanceKm;
    netProfit = price - variableCosts;
  }

  if (price !== null && estimatedMinutes !== null && estimatedMinutes > 0) {
    const hours = estimatedMinutes / 60;
    const variableCosts = distanceKm !== null ? costPerKm * distanceKm : 0;
    const fixedCosts = fixedCostPerHour * hours;
    profitPerHour = (price - variableCosts - fixedCosts) / hours;
  }

  return { profitPerKm, profitPerHour, netProfit };
}

// ─── VERDICT ENGINE ───────────────────────────────────────────────────────────
// Thresholds calibrated for Brazilian market (2024-2026).
// GREEN: excellent ride, worth accepting immediately
// YELLOW: borderline, driver should consider traffic/destination
// RED: below cost threshold, not worth it at these fuel prices
function calcVerdict(profitPerKm: number | null): "green" | "yellow" | "red" {
  if (profitPerKm === null) return "yellow";
  if (profitPerKm >= 1.8) return "green";
  if (profitPerKm >= 1.0) return "yellow";
  return "red";
}

// ─── ANALYZE ENDPOINT ─────────────────────────────────────────────────────────
router.post("/analyze", upload.single("screenshot"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Nenhuma imagem enviada" });
    return;
  }

  const costPerKm = parseFloat(req.body.costPerKm ?? "0.55") || 0.55;
  const fixedCostPerHour = parseFloat(req.body.fixedCostPerHour ?? "5") || 5;

  const base64Image = req.file.buffer.toString("base64");
  const mimeType = req.file.mimetype || "image/jpeg";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 400,
      temperature: 0,
      messages: [
        { role: "system", content: OFFER_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: "high",
              },
            },
            {
              type: "text",
              text: "Analise esta captura de tela e extraia os dados da oferta de corrida. Responda apenas com o JSON no formato especificado.",
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim() ?? "{}";

    let extracted: Record<string, unknown> = {};
    try {
      const cleaned = content.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) extracted = JSON.parse(match[0]);
    } catch {
      extracted = {};
    }

    // Validate it's actually a ride offer screen
    if (extracted.isRideOffer === false) {
      res.status(422).json({
        error: "A imagem não parece ser uma oferta de corrida. Tente capturar quando uma corrida aparecer na tela.",
        code: "NOT_RIDE_OFFER",
      });
      return;
    }

    // Parse fields with strict typing
    const price: number | null = typeof extracted.price === "number" && extracted.price > 0 ? extracted.price : null;
    const distanceKm: number | null = typeof extracted.distanceKm === "number" && extracted.distanceKm > 0 ? extracted.distanceKm : null;
    const estimatedMinutes: number | null = typeof extracted.estimatedMinutes === "number" && extracted.estimatedMinutes > 0 ? Math.round(extracted.estimatedMinutes) : null;
    const pickup: string | null = typeof extracted.pickup === "string" && extracted.pickup.length > 0 ? extracted.pickup : null;
    const destination: string | null = typeof extracted.destination === "string" && extracted.destination.length > 0 ? extracted.destination : null;
    const platform: string = typeof extracted.platform === "string" ? extracted.platform : "Outro";
    const confidence: string = typeof extracted.confidence === "string" ? extracted.confidence : "medium";

    const { profitPerKm, profitPerHour, netProfit } = calcProfit(
      price, distanceKm, estimatedMinutes, costPerKm, fixedCostPerHour
    );

    const verdict = calcVerdict(profitPerKm);

    res.json({
      price,
      distanceKm,
      estimatedMinutes,
      pickup,
      destination,
      platform,
      confidence,
      profitPerKm,
      profitPerHour,
      netProfit,
      verdict,
      costPerKm,
      fixedCostPerHour,
    });
  } catch (err: any) {
    console.error("[assistant] analyze error:", err?.message);
    res.status(500).json({ error: "Erro ao analisar oferta. Tente novamente." });
  }
});

// ─── RE-CALCULATE ENDPOINT ────────────────────────────────────────────────────
// Called when the driver manually corrects extracted values.
// No image needed — just recalculates profit from corrected data.
router.post("/recalculate", async (req, res) => {
  const { price, distanceKm, estimatedMinutes, costPerKm = 0.55, fixedCostPerHour = 5 } = req.body;

  const priceN = typeof price === "number" ? price : parseFloat(price) || null;
  const distN = typeof distanceKm === "number" ? distanceKm : parseFloat(distanceKm) || null;
  const minN = typeof estimatedMinutes === "number" ? estimatedMinutes : parseInt(estimatedMinutes) || null;
  const cpk = parseFloat(costPerKm) || 0.55;
  const fph = parseFloat(fixedCostPerHour) || 5;

  const { profitPerKm, profitPerHour, netProfit } = calcProfit(priceN, distN, minN, cpk, fph);
  const verdict = calcVerdict(profitPerKm);

  res.json({ profitPerKm, profitPerHour, netProfit, verdict });
});

// ─── SAVE ENDPOINT ────────────────────────────────────────────────────────────
router.post("/save", async (req, res) => {
  const userId = req.userId!;
  const {
    price, distanceKm, estimatedMinutes, pickup, destination, platform,
    profitPerKm, profitPerHour, netProfit, verdict, decision, confidence,
  } = req.body;

  try {
    const [saved] = await db.insert(offerCapturesTable).values({
      userId,
      price: price ?? null,
      distanceKm: distanceKm ?? null,
      estimatedMinutes: estimatedMinutes ?? null,
      pickup: pickup ?? null,
      destination: destination ?? null,
      platform: platform ?? "Outro",
      profitPerKm: profitPerKm ?? null,
      profitPerHour: profitPerHour ?? null,
      netProfit: netProfit ?? null,
      verdict: verdict ?? "yellow",
      decision: decision ?? null,
      rawExtracted: confidence ? JSON.stringify({ confidence }) : null,
    }).returning();

    res.status(201).json(saved);
  } catch (err: any) {
    console.error("[assistant] save error:", err?.message);
    res.status(500).json({ error: "Erro ao salvar oferta." });
  }
});

// ─── HISTORY ENDPOINT ─────────────────────────────────────────────────────────
router.get("/history", async (req, res) => {
  const userId = req.userId!;
  const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10), 500);

  try {
    const rows = await db
      .select()
      .from(offerCapturesTable)
      .where(eq(offerCapturesTable.userId, userId))
      .orderBy(desc(offerCapturesTable.capturedAt))
      .limit(limit);

    res.json(rows);
  } catch (err: any) {
    console.error("[assistant] history error:", err?.message);
    res.status(500).json({ error: "Erro ao buscar histórico." });
  }
});

// ─── STATS ENDPOINT ───────────────────────────────────────────────────────────
// Today's quick stats for the assistant header.
router.get("/stats/today", async (req, res) => {
  const userId = req.userId!;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  try {
    const rows = await db
      .select()
      .from(offerCapturesTable)
      .where(
        and(
          eq(offerCapturesTable.userId, userId),
          gte(offerCapturesTable.capturedAt, todayStart),
        )
      );

    const total = rows.length;
    const accepted = rows.filter((r) => r.decision === "accepted").length;
    const ignored = rows.filter((r) => r.decision === "ignored").length;
    const green = rows.filter((r) => r.verdict === "green").length;
    const red = rows.filter((r) => r.verdict === "red").length;
    const avgProfitPerKm = rows
      .filter((r) => r.profitPerKm !== null)
      .reduce((acc, r, _, arr) => acc + (r.profitPerKm ?? 0) / arr.length, 0) || null;

    res.json({ total, accepted, ignored, green, red, avgProfitPerKm: avgProfitPerKm || null });
  } catch (err: any) {
    console.error("[assistant] stats error:", err?.message);
    res.status(500).json({ error: "Erro ao buscar estatísticas." });
  }
});

export default router;
