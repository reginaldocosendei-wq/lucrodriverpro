import { Router } from "express";
import multer from "multer";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, dailySummariesTable, usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { parseExtracted, parseBRLNumber, parseTrips, todayDateStr } from "../services/importService";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

const SYSTEM_PROMPT = `Você é um especialista em leitura de screenshots de aplicativos de transporte para motoristas parceiros no Brasil.

Analise a imagem e extraia exatamente estes dados:

1. **earnings** — Valor total RECEBIDO pelo motorista (já descontada comissão do app). Em reais.
   - Procure por: "Ganhos", "Total ganho", "Você recebeu", "Valor líquido", valores como "R$ 234,50"
   - NUNCA retorne o valor bruto ou a comissão separada
   - Se houver período exibido (dia, semana, mês), prefira o TOTAL do período

2. **trips** — Número total de corridas/viagens realizadas.
   - Procure por: "Viagens", "Corridas", "Trips", "Entregas" seguido de número
   - Deve ser um número inteiro positivo

3. **km** — Distância total percorrida em quilômetros (apenas se visível).
   - Procure por: "km online", "km dirigidos", "distância", "km percorridos", valores como "45,3 km"
   - Converta para número decimal: "45,3 km" → 45.3

4. **hours** — Tempo total trabalhado em HORAS decimais (apenas se visível).
   - Procure por: "horas online", "tempo online", "tempo ativo", "horas trabalhadas"
   - Converta obrigatoriamente para decimal:
     * "2h 30min" → 2.5
     * "1h 45min" → 1.75
     * "45min"    → 0.75
     * "3:30"     → 3.5
   - Retorne sempre como número decimal, NUNCA como string

5. **rating** — Avaliação média dos passageiros de 0 a 5 (apenas se visível).
   - Procure por: estrelas ★, "avaliação", "nota", valores como "4,92" ou "4.8"
   - Deve ser um número entre 0 e 5

6. **platform** — Nome do aplicativo.
   - Detecte pelo logo, cores ou nome na tela: "Uber", "99", "InDrive", "Cabify"
   - Se não reconhecer, use "Outro"

REGRAS ABSOLUTAS:
- Responda APENAS com JSON válido, sem texto adicional, sem markdown
- Se não conseguir identificar um campo com certeza, use null
- Não invente valores que não estejam na imagem
- Se a tela mostrar múltiplos períodos (hoje, semana, mês), extraia o que estiver em destaque ou o maior período completo

FORMATO DE RESPOSTA (exatamente assim):
{"earnings": <número ou null>, "trips": <número inteiro ou null>, "km": <número ou null>, "hours": <número decimal ou null>, "rating": <número 0-5 ou null>, "platform": "<string ou null>"}`;

router.post("/analyze", requireAuth, upload.single("screenshot"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Nenhuma imagem enviada" });
    return;
  }

  const base64Image = req.file.buffer.toString("base64");
  const mimeType = req.file.mimetype || "image/jpeg";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 256,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
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
              text: "Extraia todos os dados de ganhos desta screenshot de aplicativo de motorista. Responda apenas com o JSON.",
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim() ?? "{}";

    let rawParsed: unknown = {};
    try {
      // Strip markdown code fences if the model wrapped it
      const cleaned = content.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        rawParsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      rawParsed = {};
    }

    const extracted = parseExtracted(rawParsed);
    res.json(extracted);
  } catch (err: any) {
    console.error("Import analyze error:", err);
    res.status(500).json({ error: "Erro ao analisar imagem. Tente novamente." });
  }
});

router.post("/confirm", requireAuth, async (req, res) => {
  const userId = req.userId!;
  // Accept both new (km/hours) and old (kmDriven/hoursWorked) field names for backwards compat
  const { earnings, trips, platform, km, hours, kmDriven, hoursWorked, rating, date } = req.body;

  const resolvedKm = km ?? kmDriven ?? null;
  const resolvedHours = hours ?? hoursWorked ?? null;

  if (!earnings || !trips) {
    res.status(400).json({ error: "Ganhos e número de corridas são obrigatórios" });
    return;
  }

  const summaryDate = date ?? todayDateStr();
  const earningsNum = parseBRLNumber(earnings);
  const tripsNum = parseTrips(trips);

  if (earningsNum === null || earningsNum <= 0) {
    res.status(400).json({ error: "Valor de ganhos inválido" });
    return;
  }
  if (tripsNum === null || tripsNum <= 0) {
    res.status(400).json({ error: "Número de corridas inválido" });
    return;
  }

  try {
    // Fetch user preference (replace vs merge)
    const [userPrefs] = await db
      .select({ saveModeReplace: usersTable.saveModeReplace })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    const shouldReplace = userPrefs?.saveModeReplace ?? false;

    const existing = await db
      .select()
      .from(dailySummariesTable)
      .where(and(eq(dailySummariesTable.userId, userId), eq(dailySummariesTable.date, summaryDate)))
      .limit(1);

    const newKm      = resolvedKm    != null ? parseBRLNumber(resolvedKm)              : null;
    const newHours   = resolvedHours != null ? parseFloat(String(resolvedHours))       : null;
    const newRating  = rating        != null ? parseFloat(String(rating))              : null;
    const newPlatform = platform || "Outro";

    let result;
    let merged = false;

    if (existing.length > 0) {
      const prev = existing[0];

      if (shouldReplace) {
        // Replace mode: overwrite all fields with the new values
        result = await db
          .update(dailySummariesTable)
          .set({
            earnings: earningsNum, trips: tripsNum, platform: newPlatform,
            kmDriven: newKm, hoursWorked: newHours, rating: newRating,
            updatedAt: new Date(),
          })
          .where(eq(dailySummariesTable.id, prev.id))
          .returning();
      } else {
        // Merge mode: accumulate sumable fields, keep latest rating
        result = await db
          .update(dailySummariesTable)
          .set({
            earnings:    prev.earnings    + earningsNum,
            trips:       prev.trips       + tripsNum,
            platform:    newPlatform      || prev.platform || "Outro",
            kmDriven:    (prev.kmDriven   != null || newKm    != null) ? (prev.kmDriven    ?? 0) + (newKm    ?? 0) : null,
            hoursWorked: (prev.hoursWorked != null || newHours != null) ? (prev.hoursWorked ?? 0) + (newHours ?? 0) : null,
            rating:      newRating ?? prev.rating,
            updatedAt:   new Date(),
          })
          .where(eq(dailySummariesTable.id, prev.id))
          .returning();
        merged = true;
      }
    } else {
      result = await db.insert(dailySummariesTable).values({
        userId,
        date: summaryDate,
        earnings: earningsNum,
        trips: tripsNum,
        platform: newPlatform,
        kmDriven:    newKm,
        hoursWorked: newHours,
        rating:      newRating,
      }).returning();
    }

    res.status(201).json({
      message: merged
        ? "Os dados deste dia foram somados com sucesso."
        : shouldReplace && existing.length > 0
          ? "Registro do dia substituído com sucesso."
          : "Registro salvo com sucesso.",
      merged,
      replaced: shouldReplace && existing.length > 0,
      summary: result[0],
    });
  } catch (err: any) {
    console.error("Import confirm error:", err);
    res.status(500).json({ error: "Erro ao salvar resumo. Tente novamente." });
  }
});

export default router;
