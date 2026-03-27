export type Platform = "Uber" | "99" | "InDrive" | "Outro";

export interface PlatformConfig {
  name: Platform;
  color: string;
  displayName: string;
  screenshotHint: string;
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  Uber: {
    name: "Uber",
    color: "#00b4d8",
    displayName: "Uber",
    screenshotHint: "Vá em Ganhos > Hoje ou a semana no app do Uber",
  },
  "99": {
    name: "99",
    color: "#fbbf24",
    displayName: "99",
    screenshotHint: "Vá em Histórico > Hoje no app da 99",
  },
  InDrive: {
    name: "InDrive",
    color: "#22c55e",
    displayName: "InDrive",
    screenshotHint: "Vá em Meus ganhos no app do InDrive",
  },
  Outro: {
    name: "Outro",
    color: "#a78bfa",
    displayName: "Outro app",
    screenshotHint: "Tire uma foto da tela de resumo de ganhos",
  },
};

export function getPlatformConfig(platform: string | null): PlatformConfig {
  if (!platform) return PLATFORM_CONFIGS["Outro"];
  const key = Object.keys(PLATFORM_CONFIGS).find(
    (k) => k.toLowerCase() === platform.toLowerCase()
  );
  return key ? PLATFORM_CONFIGS[key as Platform] : PLATFORM_CONFIGS["Outro"];
}

export function platformColor(platform: string | null): string {
  return getPlatformConfig(platform).color;
}
