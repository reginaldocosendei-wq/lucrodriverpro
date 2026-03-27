import { Router } from "express";
import multer from "multer";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, dailySummariesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { parseExtracted, todayDateStr } from "../services/importService";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

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
      max_completion_tokens: 512,
      messages: [
        {
          role: "system",
          content: `Você é um assistente especializado em extrair dados de screenshots de aplicativos de motoristas de aplicativo (Uber, 99, InDrive, etc.).
Analise a imagem e extraia:
1. O valor total de ganhos recebidos pelo motorista (em reais) — este é o valor final já recebido, sem descontar comissão
2. O número total de corridas/viagens realizadas
3. A plataforma (Uber, 99, InDrive, ou "Outro")
4. A distância total percorrida em km (se visível)
5. O tempo total trabalhado em horas (se visível; converta minutos para decimal, ex: 90 min = 1.5)
6. A avaliação média dos passageiros (nota de 0 a 5, se visível)

Responda APENAS com JSON neste formato exato:
{"earnings": <número ou null>, "trips": <número inteiro ou null>, "platform": "<nome ou null>", "kmDriven": <número ou null>, "hoursWorked": <número decimal ou null>, "rating": <número de 0 a 5 ou null>}

Se não conseguir identificar um valor, use null para aquele campo.
Não inclua texto adicional, apenas o JSON.`,
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
              text: "Extraia todos os dados de ganhos desta screenshot do aplicativo de motorista.",
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim() ?? "{}";
    let parsed: unknown;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      parsed = {};
    }

    const extracted = parseExtracted(parsed);
    res.json(extracted);
  } catch (err: any) {
    console.error("Import analyze error:", err);
    res.status(500).json({ error: "Erro ao analisar imagem. Tente novamente." });
  }
});

router.post("/confirm", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { earnings, trips, platform, kmDriven, hoursWorked, rating, date } = req.body;

  if (!earnings || !trips) {
    res.status(400).json({ error: "Ganhos e número de corridas são obrigatórios" });
    return;
  }

  const summaryDate = date ?? todayDateStr();
  const earningsNum = parseFloat(earnings);
  const tripsNum = parseInt(trips);

  if (isNaN(earningsNum) || earningsNum <= 0) {
    res.status(400).json({ error: "Valor de ganhos inválido" });
    return;
  }
  if (isNaN(tripsNum) || tripsNum <= 0) {
    res.status(400).json({ error: "Número de corridas inválido" });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(dailySummariesTable)
      .where(and(eq(dailySummariesTable.userId, userId), eq(dailySummariesTable.date, summaryDate)))
      .limit(1);

    const payload = {
      userId,
      date: summaryDate,
      earnings: earningsNum,
      trips: tripsNum,
      platform: platform || "Outro",
      kmDriven: kmDriven != null ? parseFloat(kmDriven) : null,
      hoursWorked: hoursWorked != null ? parseFloat(hoursWorked) : null,
      rating: rating != null ? parseFloat(rating) : null,
    };

    let result;
    if (existing.length > 0) {
      result = await db
        .update(dailySummariesTable)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(dailySummariesTable.id, existing[0].id))
        .returning();
    } else {
      result = await db.insert(dailySummariesTable).values(payload).returning();
    }

    res.status(201).json({
      message: "Resumo do dia salvo com sucesso",
      summary: result[0],
    });
  } catch (err: any) {
    console.error("Import confirm error:", err);
    res.status(500).json({ error: "Erro ao salvar resumo. Tente novamente." });
  }
});

export default router;
