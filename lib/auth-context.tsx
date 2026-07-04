"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, tokenStore, attendanceApi } from "./api";

export interface AuthUser {
  id: string; email: string; role: string; portal: string;
  firstName: string; lastName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      if (!tokenStore.access) { setLoading(false); return; }
      try {
        const { data } = await api.get<AuthUser>("/auth/me");
        setUser(data);
      } catch { tokenStore.clear(); }
      finally { setLoading(false); }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post<{ user: AuthUser; accessToken: string; refreshToken: string }>(
      "/auth/login", { email, password, portal: "coordinator" }, false,
    );
    tokenStore.set(data.accessToken, data.refreshToken);
    setUser(data.user);
    attendanceApi.clockIn().catch(() => {});
    router.push("/dashboard");
  };

  const logout = useCallback(() => {
    const refreshToken = tokenStore.refresh;
    attendanceApi.clockOut().catch(() => {});
    api.post("/auth/logout", { refreshToken }).catch(() => {});
    tokenStore.clear();
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
