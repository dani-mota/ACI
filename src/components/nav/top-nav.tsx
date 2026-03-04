"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, Grid3X3, GitCompareArrows, Sparkles, ArrowLeft, Sun, Moon, Shield } from "lucide-react";
import { UserMenu } from "./user-menu";
import { NotificationBell } from "./notification-bell";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/components/auth-provider";
import type { Notification } from "@/lib/notifications";

/** Fetches live notifications from the API and renders NotificationBell */
function LiveNotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Notification[]) =>
        setNotifications(
          data.map((n) => ({ ...n, timestamp: new Date(n.timestamp) }))
        )
      )
      .catch(() => {});
  }, []);

  return <NotificationBell notifications={notifications} />;
}

const BASE_NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/roles", label: "Roles", icon: Grid3X3 },
  { path: "/compare", label: "Compare", icon: GitCompareArrows },
];

/** Admin nav link — extracted so useAuth() is only called in live mode */
function AdminNavLink() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (user.role !== "ADMIN") return;
    fetch("/api/access-requests?status=PENDING")
      .then((r) => r.ok ? r.json() : [])
      .then((data: unknown[]) => setPendingCount(data.length))
      .catch(() => {});
  }, [user.role]);

  if (user.role !== "ADMIN") return null;

  const isActive = pathname.startsWith("/admin");

  return (
    <Link
      href="/admin"
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
        isActive
          ? "text-aci-gold border-b-2 border-aci-gold"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Shield className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Admin</span>
      {pendingCount > 0 && (
        <span className="ml-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-aci-red text-white rounded-full px-1">
          {pendingCount}
        </span>
      )}
    </Link>
  );
}

export function TopNav({ mode = "live" }: { mode?: "live" | "tutorial" }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const isTutorial = mode === "tutorial";
  const prefix = isTutorial ? "/tutorial" : "";

  return (
    <header className="sticky top-0 z-50 h-12 bg-card border-b border-border">
      <div className="h-full max-w-[1600px] mx-auto px-4 flex items-center justify-between">
        <Link href={`${prefix}/dashboard`} className="flex items-center gap-2.5">
          <span className="text-lg font-bold tracking-tight text-foreground" style={{ fontFamily: "var(--font-dm-sans)" }}>
            ACI
          </span>
          <div className="hidden sm:block h-4 w-px bg-border" />
          <span className="hidden sm:block text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Assessment Platform
          </span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {BASE_NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const href = `${prefix}${path}`;
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "text-aci-gold border-b-2 border-aci-gold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
          {!isTutorial && <AdminNavLink />}
          <div className="w-px h-5 bg-border mx-1.5" />
          {isTutorial ? (
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-aci-gold hover:text-aci-gold/80 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exit Tutorial</span>
            </Link>
          ) : (
            <Link
              href="/tutorial/dashboard"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-aci-gold hover:text-aci-gold/80 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tutorial Demo</span>
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {!isTutorial && <LiveNotificationBell />}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {!isTutorial && <UserMenu />}
        </div>
      </div>
    </header>
  );
}
