"use client";

import { ThemeProvider } from "./theme";
import { AuthProvider } from "./auth-context";
import { ToastProvider } from "../components/ui";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
