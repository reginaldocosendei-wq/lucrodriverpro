import { Router } from "express";
import multer from "multer";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, offerCapturesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const OFFER_PROMPT = `Você é um especialista em leitura de screenshots de ofertas de corrida de aplicativos como Uber, 99, InDrive e similares no Brasil.

Analise a imagem e extraia os dados da OFERTA DE CORRIDA (não resumo de ganhos — estamos olhando para uma nova corrida sendo oferecida ao motorista):

1. **price** — Valor da corrida oferecida em reais (R$). Ex: 12.50, 8.90, 24.00
   - Procure por: o valor em destaque na tela de oferta de corrida
   - Se houver "R$ 12,50" → retorne 12.5

2. **distanceKm** — Distância total da corrida em km.
   - Procure por: "km", distância total, "2,3 km" → 2.3

3. **estimatedMinutes** — Tempo estimado total da corrida em minutos.
   - Procure por: tempo estimado, duração, "12 min" → 12
   - "1h 5min" → 65

4. **pickup** — Local de embarque (endereço ou bairro de partida).
   - Procure pelo ponto de partida, origem da corrida

5. **destination** — Destino da corrida (se visível).
   - Pode estar oculto em alguns apps — retorne null se não visível

6. **platform** — Nome do aplicativo: "Uber", "99", "InDrive", "Cabify" ou "Outro"

REGRAS:
- Responda APENAS com JSON válido, sem texto adicional
- Se não conseguir identificar um campo com certeza, use null
- Não invente valores que não estejam na imagem

FORMATO (exatamente assim):
{"price": <número ou null>, "distanceKm": <número ou null>, "estimatedMinutes": <número inteiro ou null>, "pickup": "<string ou null>", "destination": "<string ou null>", "platform": "<string>"}`;

function calcVerdict(profitPerKm: number | null): "green" | "yellow" | "red" {
  if (profitPerKm === null) return "yellow";
  if (profitPerKm >= 1.8) return "green";
  if (profitPerKm >= 1.0) return "yellow";
  return "red";
}

router.post("/analyze", upload.single("screenshot"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Nenhuma imagem enviada" });
    return;
  }

  const costPerKm: number = parseFloat(req.body.costPerKm ?? "0.55") || 0.55;
  const fixedCostPerHour: number = parseFloat(req.body.fixedCostPerHour ?? "5") || 5;

  const base64Image = req.file.buffer.toString("base64");
  const mimeType = req.file.mimetype || "image/jpeg";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 300,
      messages: [
        { role: "system", content: OFFER_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: "high" },
            },
            { type: "text", text: "Extraia os dados desta oferta de corrida. Responda apenas com o JSON." },
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
    } catch { extracted = {}; }

    const price: number | null = typeof extracted.price === "number" ? extracted.price : null;
    const distanceKm: number | null = typeof extracted.distanceKm === "number" ? extracted.distanceKm : null;
    const estimatedMinutes: number | null = typeof extracted.estimatedMinutes === "number" ? extracted.estimatedMinutes : null;
    const pickup: string | null = typeof extracted.pickup === "string" ? extracted.pickup : null;
    const destination: string | null = typeof extracted.destination === "string" ? extracted.destination : null;
    const platform: string = typeof extracted.platform === "string" ? extracted.platform : "Outro";

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
      const hourlyVariableCosts = distanceKm !== null ? costPerKm * distanceKm : 0;
      profitPerHour = (price - hourlyVariableCosts - fixedCostPerHour * hours) / hours;
    }

    const verdict = calcVerdict(profitPerKm);

    res.json({
      price,
      distanceKm,
      estimatedMinutes,
      pickup,
      destination,
      platform,
      profitPerKm,
      profitPerHour,
      netProfit,
      verdict,
    });
  } catch (err: any) {
    console.error("Assistant analyze error:", err);
    res.status(500).json({ error: "Erro ao analisar oferta. Tente novamente." });
  }
});

router.post("/save", async (req, res) => {
  const userId = req.userId!;
  const { price, distanceKm, estimatedMinutes, pickup, destination, platform, profitPerKm, profitPerHour, netProfit, verdict, decision } = req.body;

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
      rawExtracted: null,
    }).returning();
    res.status(201).json(saved);
  } catch (err: any) {
    console.error("Assistant save error:", err);
    res.status(500).json({ error: "Erro ao salvar oferta." });
  }
});

router.patch("/save/:id", async (req, res) => {
  const userId = req.userId!;
  const id = parseInt(req.params.id, 10);
  const { decision } = req.body;

  try {
    const [updated] = await db
      .update(offerCapturesTable)
      .set({ decision })
      .where(eq(offerCapturesTable.id, id))
      .returning();
    res.json(updated);
  } catch (err: any) {
    console.error("Assistant patch error:", err);
    res.status(500).json({ error: "Erro ao atualizar." });
  }
});

router.get("/history", async (req, res) => {
  const userId = req.userId!;
  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 200);

  try {
    const rows = await db
      .select()
      .from(offerCapturesTable)
      .where(eq(offerCapturesTable.userId, userId))
      .orderBy(desc(offerCapturesTable.capturedAt))
      .limit(limit);
    res.json(rows);
  } catch (err: any) {
    console.error("Assistant history error:", err);
    res.status(500).json({ error: "Erro ao buscar histórico." });
  }
});

export default router;
