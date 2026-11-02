"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { Sidebar, RTO_COORDINATOR_ROUTES } from "../../components/sidebar";
import { Topbar } from "../../components/topbar";
import { ChatWidget } from "../../components/ChatWidget";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const rtoOnly = !!user?.rtoAccess;
  const blocked = rtoOnly && !RTO_COORDINATOR_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  // RTO coordinators are limited to the RTO workspace plus their own HR pages.
  useEffect(() => {
    if (blocked) router.replace("/rto");
  }, [blocked, router]);

  if (loading || !user || blocked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar />
        <main className="flex-1 p-6 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
      <ChatWidget />
    </div>
  );
}
