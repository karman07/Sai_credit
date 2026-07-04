"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users2, ClipboardCheck, Wallet, Compass } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { ApiError } from "../../lib/api";

export default function LoginPage() {
  const { user, loading: authLoading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("coordinator@saicredit.in");
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

  const highlights = [
    { icon: Users2,         text: "Oversee every rep on your team from one place" },
    { icon: ClipboardCheck, text: "Review case details, request docs, and update statuses" },
    { icon: Wallet,         text: "Manage payouts across banks and business months" },
  ];

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-primary/90 to-primary/60 text-primary-foreground dark:text-foreground dark:from-[#08201C] dark:to-[#0B2E28] dark:border-r dark:border-border">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-white/20 backdrop-blur grid place-items-center">
            <Compass className="size-5" />
          </div>
          <div>
            <span className="font-bold text-lg block leading-tight">Sai Credit Solutions</span>
            <span className="text-sm opacity-70 block leading-tight">Coordinator Portal</span>
          </div>
        </div>

        <div className="max-w-md space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight leading-tight">
              Your team&apos;s cases,<br />in one dashboard.
            </h1>
            <p className="mt-4 text-[15px] opacity-80 leading-relaxed">
              Track every case your sales reps bring in, keep documentation moving,
              and manage payouts — all from a single coordinator workspace.
            </p>
          </div>
          <div className="space-y-4">
            {highlights.map((h, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-white/20 grid place-items-center shrink-0">
                  <h.icon className="size-4" />
                </div>
                <p className="text-sm opacity-90">{h.text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs opacity-50">© {new Date().getFullYear()} Sai Credit Solutions · Coordinator Portal</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="size-9 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <Compass className="size-5" />
            </div>
            <span className="font-semibold text-lg">Sai Credit Solutions</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
          <p className="mt-1 text-sm text-muted">Sign in to your coordinator account.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-foreground-secondary mb-1.5 uppercase tracking-wide">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@saicredit.in" autoComplete="email" required
                className="input-base"
              />
            </div>
            <div>
              <div className="mb-1.5">
                <label className="block text-[12px] font-medium text-foreground-secondary uppercase tracking-wide">Password</label>
              </div>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password" required
                className="input-base"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}

            <button
              type="submit" disabled={submitting}
              className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {submitting && <div className="size-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />}
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
