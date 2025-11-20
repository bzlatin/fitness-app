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
import { setAuthTokenProvider } from "../api/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

const AUTH0_DOMAIN = process.env.EXPO_PUBLIC_AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID;
const AUTH0_AUDIENCE = process.env.EXPO_PUBLIC_AUTH0_AUDIENCE;
const AUTH0_SCHEME = process.env.EXPO_PUBLIC_AUTH0_CALLBACK_SCHEME || "push-pull";

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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discovery = AuthSession.useAutoDiscovery(`https://${AUTH0_DOMAIN}`);

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: AUTH0_SCHEME,
  });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: AUTH0_CLIENT_ID,
      redirectUri,
      scopes: ["openid", "profile", "email", "offline_access"],
      usePKCE: true,
      extraParams: AUTH0_AUDIENCE
        ? {
            audience: AUTH0_AUDIENCE,
          }
        : undefined,
    },
    discovery
  );

  useEffect(() => {
    loadStoredTokens()
      .then((stored) => {
        if (stored) {
          setTokens(stored);
        }
      })
      .finally(() => setIsInitializing(false));
  }, []);

  useEffect(() => {
    const token = tokens?.accessToken ?? null;
    if (token) {
      setAuthTokenProvider(() => token);
    } else {
      setAuthTokenProvider(null);
    }
    return () => {
      setAuthTokenProvider(null);
    };
  }, [tokens?.accessToken]);

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

        const expiresAt = Date.now() + (tokenResponse.expiresIn ?? 3600) * 1000;

        const nextTokens: AuthTokens = {
          accessToken: tokenResponse.accessToken,
          idToken: tokenResponse.idToken ?? undefined,
          refreshToken: tokenResponse.refreshToken ?? undefined,
          expiresAt,
        };

        setTokens(nextTokens);
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

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(tokens?.accessToken),
      isLoading: isInitializing,
      isAuthorizing,
      login,
      logout,
      error,
    }),
    [tokens?.accessToken, isInitializing, isAuthorizing, login, logout, error]
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
