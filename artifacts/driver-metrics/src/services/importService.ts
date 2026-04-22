import { getApiBase } from "@/lib/api";
import { storageGetSync } from "@/lib/storage";

export interface ExtractedData {
  earnings: number | null;
  trips: number | null;
  platform: string | null;
  km: number | null;
  hours: number | null;
  rating: number | null;
}

// ── Auth headers ──────────────────────────────────────────────────────────────
// Uses storageGetSync (in-memory cache populated at boot by storageInit).
// On Android this reads from Preferences; on web from localStorage.
function getAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = storageGetSync("auth_token");
  const headers: Record<string, string> = { ...extra };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    console.log("[AUTH_OK] importService: Bearer token attached (len:", token.length, ")");
  } else {
    console.warn("[AUTH_FAIL] importService: no auth_token in storage cache — request will be unauthenticated");
  }
  return headers;
}

// ── Safe JSON parser ──────────────────────────────────────────────────────────
// Checks Content-Type and reads the body as text first so we can log
// the raw response when it's HTML instead of JSON.
async function safeJson<T>(response: Response, context: string): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  console.log(`[${context}] status=${response.status} content-type="${contentType}"`);

  const text = await response.text();

  if (!contentType.includes("application/json")) {
    const preview = text.slice(0, 200);
    console.error(`[${context}] NON-JSON response — first 200 chars:`, preview);
    throw new Error(
      `Server returned HTML instead of JSON (status ${response.status}). ` +
      `Check VITE_API_BASE_URL and that the API route exists. Preview: ${preview.slice(0, 80)}`
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch (e) {
    const preview = text.slice(0, 200);
    console.error(`[${context}] JSON parse error. Body preview:`, preview);
    throw new Error(`Invalid JSON from server: ${preview.slice(0, 80)}`);
  }
}

// ── analyzeScreenshot ─────────────────────────────────────────────────────────
export async function analyzeScreenshot(file: File): Promise<ExtractedData> {
  const BASE = getApiBase();
  const url  = `${BASE}/api/import/analyze`;

  const formData = new FormData();
  formData.append("screenshot", file, file.name || "screenshot.jpg");

  console.log("[IMPORT] analyzeScreenshot → URL:", url);
  console.log("[IMPORT] file:", file.name, "type:", file.type, "size:", file.size, "bytes");

  let response: Response;
  try {
    response = await fetch(url, {
      method:      "POST",
      credentials: "include",
      headers:     getAuthHeaders(),
      body:        formData,
    });
  } catch (networkErr) {
    console.error("[IMPORT] analyzeScreenshot network error:", networkErr);
    throw new Error("Sem conexão com o servidor. Verifique sua internet e tente novamente.");
  }

  console.log("[IMPORT] analyzeScreenshot response status:", response.status);

  if (!response.ok) {
    const errData = await safeJson<{ error?: string }>(response, "IMPORT_ANALYZE_ERR").catch((e) => ({ error: e.message }));
    console.error("[IMPORT] analyzeScreenshot failed:", response.status, errData);
    throw new Error((errData as any).error || `Erro ${response.status} ao analisar imagem`);
  }

  const data = await safeJson<ExtractedData>(response, "IMPORT_ANALYZE_OK");
  console.log("[IMPORT] analyzeScreenshot success:", data);
  return data;
}

// ── confirmImport ─────────────────────────────────────────────────────────────
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
  const url  = `${BASE}/api/import/confirm`;

  console.log("[IMPORT] confirmImport → URL:", url);

  let response: Response;
  try {
    response = await fetch(url, {
      method:      "POST",
      credentials: "include",
      headers:     getAuthHeaders({ "Content-Type": "application/json" }),
      body:        JSON.stringify(data),
    });
  } catch (networkErr) {
    console.error("[IMPORT] confirmImport network error:", networkErr);
    throw new Error("Sem conexão com o servidor. Verifique sua internet e tente novamente.");
  }

  console.log("[IMPORT] confirmImport response status:", response.status);

  if (!response.ok) {
    const errData = await safeJson<{ error?: string }>(response, "IMPORT_CONFIRM_ERR").catch((e) => ({ error: e.message }));
    console.error("[IMPORT] confirmImport failed:", response.status, errData);
    throw new Error((errData as any).error || `Erro ${response.status} ao salvar resumo`);
  }

  const result = await safeJson<{ message: string; merged: boolean; summary: unknown }>(response, "IMPORT_CONFIRM_OK");
  console.log("[IMPORT] confirmImport success:", result);
  return result;
}
