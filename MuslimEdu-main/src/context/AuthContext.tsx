import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import {
  AuthUser,
  loginRequest,
  fetchMe,
  logoutRequest,
  saveToken,
  getStoredToken,
  clearToken,
  AuthApiError,
} from '../services/authService';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean; // true while checking for a saved token on launch
  isSubmitting: boolean; // true while a login request is in flight
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On app launch: check keychain for a saved token, and validate it via /me
  useEffect(() => {
    (async () => {
      try {
        const storedToken = await getStoredToken();
        if (!storedToken) {
          setIsLoading(false);
          return;
        }
        const me = await fetchMe(storedToken);
        setToken(storedToken);
        setUser(me);
      } catch {
        // Token invalid/expired - clear it silently and fall back to login screen
        await clearToken();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await loginRequest(email, password);
      try {
        await saveToken(result.token);
      } catch (storageErr) {
        // Login itself worked, but persisting the token failed (e.g. the
        // Keychain native module isn't linked in this build). Surface it
        // clearly instead of hiding it behind a generic message.
        throw new Error(
          `Signed in, but couldn't save your session on this device: ${
            storageErr instanceof Error ? storageErr.message : 'unknown storage error'
          }`,
        );
      }
      setToken(result.token);
      setUser(result.user);
      return true;
    } catch (err) {
      // Show the server's message for known API errors, and the actual
      // error text for everything else - no more silent "Something went wrong".
      let message: string;
      if (err instanceof AuthApiError) {
        message = err.message;
      } else if (err instanceof Error && err.message) {
        message = err.message;
      } else {
        message = 'Something went wrong.';
      }
      setError(message);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      await logoutRequest(token);
    }
    await clearToken();
    setToken(null);
    setUser(null);
  }, [token]);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isSubmitting,
        error,
        login,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
