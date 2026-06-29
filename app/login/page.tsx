"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { Button, Input } from "../../components/ui";
import { ApiError } from "../../lib/api";

export default function LoginPage() {
  const { user, loading: authLoading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("admin@saicredit.in");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) router.replace("/dashboard");
  }, [user, authLoading, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-surface border-r border-border relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="size-9 rounded-lg bg-primary text-primary-foreground grid place-items-center shadow-sm">
            <ShieldCheck className="size-5" />
          </div>
          <span className="font-semibold text-lg tracking-tight">Sai Credit Solutions</span>
        </div>
        
        <div className="relative z-10 max-w-xl mt-8 flex-1 flex flex-col justify-center">
          <div className="mb-8 mix-blend-multiply flex justify-start">
            <img 
              src="/crm_image.png" 
              alt="Dashboard Preview" 
              className="w-full max-w-[600px] h-auto object-contain"
            />
          </div>

          <h1 className="text-3xl font-bold tracking-tight leading-tight">
            Operations command center.
          </h1>
          <p className="mt-4 text-foreground-secondary text-[15px] leading-relaxed">
            Manage loans, coordinate with banks, track compliances, and oversee your entire team's pipeline in one place.
          </p>
        </div>

        <p className="relative z-10 text-xs text-muted mt-8">© {new Date().getFullYear()} Sai Credit Solutions · Admin Portal</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="size-9 rounded-lg bg-primary text-primary-foreground grid place-items-center shadow-sm">
              <ShieldCheck className="size-5" />
            </div>
            <span className="font-semibold text-lg tracking-tight">Sai Credit Solutions</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted">Admin & Operations portal access.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-foreground-secondary mb-1.5">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[13px] font-medium text-foreground-secondary">
                  Password
                </label>
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="rounded-md border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
