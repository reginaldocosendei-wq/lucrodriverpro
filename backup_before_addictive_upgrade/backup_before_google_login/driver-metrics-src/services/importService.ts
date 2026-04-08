import { getApiBase } from "@/lib/api";

export interface ExtractedData {
  earnings: number | null;
  trips: number | null;
  platform: string | null;
  km: number | null;
  hours: number | null;
  rating: number | null;
}

export async function analyzeScreenshot(file: File): Promise<ExtractedData> {
  const BASE = getApiBase();
  const formData = new FormData();
  formData.append("screenshot", file);

  const response = await fetch(`${BASE}/api/import/analyze`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Erro ao analisar imagem");
  }

  return response.json();
}

export async function confirmImport(data: {
  earnings: number;
  trips: number;
  platform: string;
  km: number | null;
  hours: number | null;
  rating: number | null;
  date?: string;
}): Promise<{ message: string; merged: boolean; summary: unknown }> {
  const BASE = getApiBase();
  const response = await fetch(`${BASE}/api/import/confirm`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao salvar resumo");
  }

  return response.json();
}
