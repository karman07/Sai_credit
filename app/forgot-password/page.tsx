"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "../../lib/api";
import { Button, Input } from "../../components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { email }, false);
    } finally {
      setSent(true);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-6">
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        {sent ? (
          <p className="mt-3 text-sm text-foreground-secondary">
            If an account exists for <span className="font-medium">{email}</span>, a reset link has been sent.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              Enter your email and we'll send you a reset link.
            </p>
            <form onSubmit={onSubmit} className="mt-7 space-y-4">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
