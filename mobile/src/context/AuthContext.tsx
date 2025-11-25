import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import { setAuthErrorHandler, setAuthTokenProvider } from "../api/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

const AUTH0_DOMAIN = process.env.EXPO_PUBLIC_AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID;
const AUTH0_AUDIENCE = process.env.EXPO_PUBLIC_AUTH0_AUDIENCE;
const AUTH0_SCHEME = process.env.EXPO_PUBLIC_AUTH0_CALLBACK_SCHEME || "push-pull";
const TOKEN_REFRESH_BUFFER_MS = 60 * 1000; // refresh 1 minute before expiry
const TOKEN_EXPIRY_GRACE_MS = 5 * 1000;

if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID) {
  throw new Error("Missing Auth0 configuration. Please set EXPO_PUBLIC_AUTH0_DOMAIN and EXPO_PUBLIC_AUTH0_CLIENT_ID.");
}

type AuthTokens = {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  expiresAt: number;
};

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthorizing: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  error?: string | null;
};

const TOKEN_STORAGE_KEY = "fitness-app.auth-tokens";
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

let secureStoreAvailable: boolean | null = null;
const ensureSecureStore = async () => {
  if (secureStoreAvailable === null) {
    secureStoreAvailable = await SecureStore.isAvailableAsync();
  }
  return secureStoreAvailable;
};

const loadStoredTokens = async () => {
  try {
    if (!(await ensureSecureStore())) {
      return null;
    }
    const raw = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthTokens) : null;
  } catch (err) {
    console.warn("Failed to load auth tokens", err);
    return null;
  }
};

const persistTokens = async (tokens: AuthTokens | null) => {
  try {
    if (!(await ensureSecureStore())) {
      return;
    }
    if (!tokens) {
      await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    } else {
      await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    }
  } catch (err) {
    console.warn("Failed to persist auth tokens", err);
  }
};

const isTokenExpired = (expiresAt?: number) =>
  !expiresAt || expiresAt <= Date.now() + TOKEN_EXPIRY_GRACE_MS;

const buildAuthTokens = (
  tokenResponse: AuthSession.TokenResponse,
  fallbackRefreshToken?: string
): AuthTokens => {
  const expiresAt = Date.now() + (tokenResponse.expiresIn ?? 3600) * 1000;
  return {
    accessToken: tokenResponse.accessToken,
    idToken: tokenResponse.idToken ?? undefined,
    refreshToken: tokenResponse.refreshToken ?? fallbackRefreshToken ?? undefined,
    expiresAt,
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const discovery = AuthSession.useAutoDiscovery(`https://${AUTH0_DOMAIN}`);

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: AUTH0_SCHEME,
    path: "redirect", // ensure native builds use push-pull://redirect (avoids bare scheme redirects)
  });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: AUTH0_CLIENT_ID,
      redirectUri,
      scopes: ["openid", "profile", "email", "offline_access"],
      usePKCE: true,
      extraParams: {
        ...(AUTH0_AUDIENCE ? { audience: AUTH0_AUDIENCE } : {}),
        // Use "login" to always show the login screen and prevent auto-login
        // This allows users to choose their authentication method or switch accounts
        prompt: "login",
      },
    },
    discovery
  );

  const refreshTokens = useCallback(
    async (current: AuthTokens) => {
      if (!discovery) {
        throw new Error("Auth0 discovery document not ready for refresh.");
      }
      if (isRefreshing) {
        return current;
      }
      if (!current.refreshToken) {
        setTokens(null);
        await persistTokens(null);
        setError("Session expired. Please sign in again.");
        throw new Error("No refresh token available");
      }

      setIsRefreshing(true);
      try {
        const refreshed = await AuthSession.refreshAsync(
          {
            clientId: AUTH0_CLIENT_ID,
            refreshToken: current.refreshToken,
            extraParams: AUTH0_AUDIENCE
              ? {
                  audience: AUTH0_AUDIENCE,
                }
              : undefined,
          },
          discovery
        );

        if (!refreshed.accessToken) {
          throw new Error("Auth0 refresh did not return an access token.");
        }

        const nextTokens = buildAuthTokens(refreshed, current.refreshToken);
        setTokens(nextTokens);
        setAuthTokenProvider(() => nextTokens.accessToken);
        await persistTokens(nextTokens);
        setError(null);
        return nextTokens;
      } catch (err) {
        console.error("Failed to refresh Auth0 tokens", err);
        setTokens(null);
        await persistTokens(null);
        setError("Session expired. Please sign in again.");
        throw err;
      } finally {
        setIsRefreshing(false);
      }
    },
    [discovery, isRefreshing]
  );

  useEffect(() => {
    let isMounted = true;
    const bootstrap = async () => {
      try {
        const stored = await loadStoredTokens();
        if (!isMounted || !stored) return;
        if (isTokenExpired(stored.expiresAt)) {
          if (discovery) {
            try {
              await refreshTokens(stored);
            } catch {
              // refreshTokens already cleared state on failure
            }
          } else {
            setTokens(null);
            await persistTokens(null);
            setError("Session expired. Please sign in again.");
          }
        } else {
          setTokens(stored);
          setAuthTokenProvider(() => stored.accessToken);
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };
    void bootstrap();
    return () => {
      isMounted = false;
    };
  }, [refreshTokens, discovery]);

  useEffect(() => {
    const token = tokens?.accessToken ?? null;
    if (token && !isTokenExpired(tokens?.expiresAt)) {
      setAuthTokenProvider(() => token);
    } else {
      setAuthTokenProvider(null);
    }
  }, [tokens?.accessToken, tokens?.expiresAt]);

  const invalidateSession = useCallback(async () => {
    setTokens(null);
    await persistTokens(null);
    setAuthTokenProvider(null);
    setError("Session expired. Please sign in again.");
  }, []);

  useEffect(() => {
    setAuthErrorHandler(() => {
      void invalidateSession();
    });
    return () => setAuthErrorHandler(null);
  }, [invalidateSession]);

  useEffect(() => {
    if (
      !tokens ||
      !tokens.refreshToken ||
      isTokenExpired(tokens.expiresAt) ||
      !discovery
    ) {
      return;
    }

    const msUntilRefresh = tokens.expiresAt - Date.now() - TOKEN_REFRESH_BUFFER_MS;
    const timeoutMs = Math.max(msUntilRefresh, 0);
    const timer = setTimeout(() => {
      void refreshTokens(tokens);
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [tokens?.accessToken, tokens?.expiresAt, tokens?.refreshToken, discovery, refreshTokens]);

  useEffect(() => {
    const completeAuth = async () => {
      if (!response) return;
      if (response.type === "error") {
        setError(response.error?.message ?? "Authentication failed. Please try again.");
        setIsAuthorizing(false);
        return;
      }
      if (response.type !== "success" || !response.params?.code) {
        return;
      }
      if (!request || !discovery) return;

      try {
        const tokenResponse = await AuthSession.exchangeCodeAsync(
          {
            code: response.params.code,
            clientId: AUTH0_CLIENT_ID,
            redirectUri,
            extraParams: {
              code_verifier: request.codeVerifier ?? "",
            },
          },
          discovery
        );

        if (!tokenResponse.accessToken) {
          throw new Error("Auth0 response did not include an access token.");
        }

        const nextTokens = buildAuthTokens(tokenResponse);
        setTokens(nextTokens);
        setAuthTokenProvider(() => nextTokens.accessToken);
        await persistTokens(nextTokens);
        setError(null);
      } catch (err) {
        console.error("Failed to complete Auth0 login", err);
        setError("Authentication failed. Please try again.");
        setTokens(null);
        await persistTokens(null);
      } finally {
        setIsAuthorizing(false);
      }
    };

    void completeAuth();
  }, [response, request, discovery, redirectUri]);

  const login = useCallback(async () => {
    if (!request) {
      setError("Auth session not ready. Please try again.");
      return;
    }
    setError(null);
    setIsAuthorizing(true);
    try {
      const result = await promptAsync();
      if (result.type !== "success") {
        setIsAuthorizing(false);
        if (result.type === "error") {
          setError(result.error?.message ?? "Authentication was cancelled.");
        } else if (result.type === "dismiss") {
          setError("Authentication cancelled.");
        }
      }
    } catch (err) {
      console.error("Auth0 login failed", err);
      setError((err as Error).message);
      setIsAuthorizing(false);
    }
  }, [request, promptAsync]);

  const logout = useCallback(async () => {
    setIsAuthorizing(true);
    try {
      setTokens(null);
      await persistTokens(null);
      setAuthTokenProvider(null);
    } catch (err) {
      console.error("Failed to log out", err);
    } finally {
      setIsAuthorizing(false);
    }
  }, []);

  const isSessionActive =
    Boolean(tokens?.accessToken) && !isTokenExpired(tokens?.expiresAt);

  const getAccessToken = useCallback(async () => {
    if (!tokens) return null;
    if (isTokenExpired(tokens.expiresAt)) {
      try {
        const refreshed = await refreshTokens(tokens);
        return refreshed.accessToken;
      } catch {
        return null;
      }
    }
    return tokens.accessToken;
  }, [tokens, refreshTokens]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: isSessionActive,
      isLoading: isInitializing,
      isAuthorizing,
      login,
      logout,
      getAccessToken,
      error,
    }),
    [isSessionActive, isInitializing, isAuthorizing, login, logout, getAccessToken, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return ctx;
};
