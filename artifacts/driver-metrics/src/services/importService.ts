import { getApiBase } from "@/lib/api";

export interface ExtractedData {
  earnings: number | null;
  trips: number | null;
  platform: string | null;
  km: number | null;
  hours: number | null;
  rating: number | null;
}

function getAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = { ...extra };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    console.log("[AUTH_OK] importService: Bearer token attached");
  } else {
    console.warn("[AUTH_FAIL] importService: no auth_token in localStorage");
  }
  return headers;
}

export async function analyzeScreenshot(file: File): Promise<ExtractedData> {
  const BASE = getApiBase();
  const formData = new FormData();
  formData.append("screenshot", file);

  console.log("[ANALYSIS_SAVE] analyzeScreenshot: sending request");

  const response = await fetch(`${BASE}/api/import/analyze`, {
    method: "POST",
    credentials: "include",
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    console.error("[ANALYSIS_SAVE] analyzeScreenshot failed:", response.status, data.error);
    throw new Error(data.error || "Erro ao analisar imagem");
  }

  console.log("[ANALYSIS_SAVE] analyzeScreenshot: success");
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

  console.log("[ANALYSIS_SAVE] confirmImport: sending request");

  const response = await fetch(`${BASE}/api/import/confirm`, {
    method: "POST",
    credentials: "include",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error("[ANALYSIS_SAVE] confirmImport failed:", response.status, err.error);
    throw new Error(err.error || "Erro ao salvar resumo");
  }

  console.log("[ANALYSIS_SAVE] confirmImport: success");
  return response.json();
}
