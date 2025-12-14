const normalizeBase = (value?: string | null) => {
  if (!value) return null;
  return value.endsWith("/") ? value.slice(0, -1) : value;
};

const base =
  normalizeBase(process.env.EXPO_PUBLIC_LANDING_BASE_URL) ??
  normalizeBase(process.env.EXPO_PUBLIC_LEGAL_BASE_URL);

const fallbackBase = "https://push-pull.app";

export const TERMS_URL =
  process.env.EXPO_PUBLIC_LEGAL_TERMS_URL ?? `${base ?? fallbackBase}/terms`;

export const PRIVACY_URL =
  process.env.EXPO_PUBLIC_LEGAL_PRIVACY_URL ??
  `${base ?? fallbackBase}/privacy`;

export const SUPPORT_URL =
  process.env.EXPO_PUBLIC_LEGAL_SUPPORT_URL ?? `${base ?? fallbackBase}/support`;
