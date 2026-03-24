import { Router } from "express";
import multer from "multer";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, ridesTable } from "@workspace/db";

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
1. O valor total de ganhos (em reais)
2. O número total de corridas/viagens
3. A plataforma (Uber, 99, InDrive, ou "outro")

Responda APENAS com JSON no formato: {"earnings": <número>, "trips": <número>, "platform": "<nome>"}
Se não conseguir identificar algum valor, use null.
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
              text: "Extraia os dados de ganhos desta screenshot do aplicativo de motorista.",
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim() ?? "{}";
    let extracted: { earnings: number | null; trips: number | null; platform: string | null };

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : { earnings: null, trips: null, platform: null };
    } catch {
      extracted = { earnings: null, trips: null, platform: null };
    }

    res.json({
      earnings: extracted.earnings,
      trips: extracted.trips,
      platform: extracted.platform,
    });
  } catch (err: any) {
    console.error("Import analyze error:", err);
    res.status(500).json({ error: "Erro ao analisar imagem" });
  }
});

router.post("/confirm", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { earnings, trips, platform } = req.body;

  if (!earnings || !trips || !platform) {
    res.status(400).json({ error: "Dados incompletos" });
    return;
  }

  const totalEarnings = parseFloat(earnings);
  const totalTrips = parseInt(trips);
  const platformCommissionPct = 25;
  const perRide = totalEarnings / totalTrips;
  const commissionAmount = totalEarnings * (platformCommissionPct / 100);
  const netValue = totalEarnings - commissionAmount;
  const netPerRide = netValue / totalTrips;

  const ridesData = Array.from({ length: totalTrips }, () => ({
    userId,
    value: parseFloat(perRide.toFixed(2)),
    distanceKm: 0,
    durationMinutes: 0,
    platform: platform || "Outro",
    passengerRating: 5,
    platformCommissionPct,
    netValue: parseFloat(netPerRide.toFixed(2)),
    valuePerKm: 0,
    commissionAmount: parseFloat((commissionAmount / totalTrips).toFixed(2)),
  }));

  const inserted = await db.insert(ridesTable).values(ridesData).returning();

  res.status(201).json({
    message: "Importação concluída com sucesso",
    ridesCreated: inserted.length,
    totalEarnings,
    netValue,
  });
});

export default router;
