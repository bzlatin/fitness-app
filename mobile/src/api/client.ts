import Constants from "expo-constants";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

const DEFAULT_API_URL = "http://localhost:4000/api";
const DEFAULT_TIMEOUT_MS = 15000;

type TokenProvider = () => string | null | undefined;

let authTokenProvider: TokenProvider | null = null;
type AuthErrorHandler = () => void;
let authErrorHandler: AuthErrorHandler | null = null;

export const setAuthTokenProvider = (provider: TokenProvider | null) => {
  authTokenProvider = provider;
};

export const setAuthErrorHandler = (handler: AuthErrorHandler | null) => {
  authErrorHandler = handler;
};

const resolveApiBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // When running through Expo Go on a device, re-use the Metro host IP so requests reach the dev machine.
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(":")[0];
    if (host) {
      return `http://${host}:4000/api`;
    }
  }

  return DEFAULT_API_URL;
};

export const API_BASE_URL = resolveApiBaseUrl();
// Debug the resolved API host during development.
// eslint-disable-next-line no-console
console.log("API base URL", API_BASE_URL);

type RequestConfig = {
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
};

const buildUrl = (path: string, params?: RequestConfig["params"]) => {
  const base = API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(normalizedPath, base);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.append(key, String(value));
      }
    });
  }
  return url.toString();
};

const request = async <T>(
  path: string,
  init: RequestInit,
  config?: RequestConfig,
  expectJson = true
) => {
  const url = buildUrl(path, config?.params);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(config?.headers ?? {}),
  };

  const token = authTokenProvider?.();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (path.includes("/social/me")) {
    // Helpful debug to confirm auth header is being set on profile fetches.
    // eslint-disable-next-line no-console
    console.warn("No auth token set for /social/me request");
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || err.message.toLowerCase().includes("aborted"));
    if (isAbort) {
      throw new Error("Request timed out. Check your connection and try again.");
    }
    throw err instanceof Error ? err : new Error("Request failed. Please try again.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const raw = await response.text().catch(() => response.statusText);
    const parsedError = (() => {
      try {
        return raw ? (JSON.parse(raw) as { error?: string; requiresUpgrade?: boolean }) : null;
      } catch {
        return null;
      }
    })();

    // Only trigger sign-out for actual auth errors, not plan restrictions
    const isAuthError =
      response.status === 401 ||
      (response.status === 403 && !parsedError?.requiresUpgrade) ||
      (response.status === 400 && parsedError?.error?.toLowerCase() === "unauthorized");

    if (isAuthError) {
      authErrorHandler?.();
    }

    const message = parsedError?.error ?? raw ?? response.statusText;
    throw new Error(`Request failed: ${response.status} ${message}`);
  }

  if (!expectJson || response.status === 204) {
    return { data: undefined as T };
  }

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : (undefined as T);
  return { data };
};

export const apiClient = {
  get: <T>(path: string, config?: RequestConfig) =>
    request<T>(path, { method: "GET" }, config),
  post: <T>(path: string, body?: unknown, config?: RequestConfig) =>
    request<T>(
      path,
      { method: "POST", body: body ? JSON.stringify(body) : undefined },
      config
    ),
  put: <T>(path: string, body?: unknown, config?: RequestConfig) =>
    request<T>(
      path,
      { method: "PUT", body: body ? JSON.stringify(body) : undefined },
      config
    ),
  patch: <T>(path: string, body?: unknown, config?: RequestConfig) =>
    request<T>(
      path,
      { method: "PATCH", body: body ? JSON.stringify(body) : undefined },
      config
    ),
  delete: <T>(path: string, config?: RequestConfig) =>
    request<T>(path, { method: "DELETE" }, config, false),
};
