import Constants from "expo-constants";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

const DEFAULT_API_URL = "http://localhost:4000/api";

type TokenProvider = () => string | null | undefined;

let authTokenProvider: TokenProvider | null = null;

export const setAuthTokenProvider = (provider: TokenProvider | null) => {
  authTokenProvider = provider;
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

type RequestConfig = {
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  body?: unknown;
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
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
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
