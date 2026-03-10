"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Bell, CheckCircle2, Clock, UserPlus, ArrowRightCircle, AlertTriangle } from "lucide-react";
import { formatRelativeDate } from "@/lib/format";
import type { Notification, NotificationType } from "@/lib/notifications";

interface NotificationBellProps {
  notifications: Notification[];
}

const TYPE_ICONS: Record<NotificationType, typeof Bell> = {
  ASSESSMENT_COMPLETED: CheckCircle2,
  AWAITING_DECISION: Clock,
  STATUS_CHANGED: ArrowRightCircle,
  NEW_CANDIDATE: UserPlus,
  RED_FLAG_DETECTED: AlertTriangle,
};

const TYPE_COLORS: Record<NotificationType, string> = {
  ASSESSMENT_COMPLETED: "text-aci-green",
  AWAITING_DECISION: "text-aci-amber",
  STATUS_CHANGED: "text-aci-blue",
  NEW_CANDIDATE: "text-aci-gold",
  RED_FLAG_DETECTED: "text-aci-red",
};

export function NotificationBell({ notifications: initialNotifications }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors relative"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-aci-red text-white text-[9px] font-bold flex items-center justify-center rounded-full">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-10 w-[360px] bg-card border border-border shadow-xl z-50 max-h-[460px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[10px] text-aci-gold hover:text-aci-gold/80 font-medium uppercase tracking-wider transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <Bell className="w-6 h-6 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-xs text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const Icon = TYPE_ICONS[notif.type];
                const iconColor = TYPE_COLORS[notif.type];
                const content = (
                  <div
                    className={`flex items-start gap-3 px-4 py-3 border-b border-border hover:bg-accent/50 transition-colors cursor-pointer ${
                      !notif.read ? "bg-accent/30" : ""
                    }`}
                  >
                    <div className="mt-0.5">
                      <Icon className={`w-4 h-4 ${iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-semibold text-foreground">{notif.title}</p>
                        {!notif.read && (
                          <span className="w-1.5 h-1.5 bg-aci-blue rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                        {notif.message}
                      </p>
                      <p className="text-[9px] text-muted-foreground/60 mt-1 font-mono">
                        {formatRelativeDate(notif.timestamp)}
                      </p>
                    </div>
                  </div>
                );

                const href = notif.linkTo ?? (notif.candidateId ? `/candidates/${notif.candidateId}` : null);
                if (href) {
                  return (
                    <Link
                      key={notif.id}
                      href={href}
                      onClick={() => {
                        setIsOpen(false);
                        setNotifications((prev) =>
                          prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
                        );
                      }}
                    >
                      {content}
                    </Link>
                  );
                }
                return <div key={notif.id}>{content}</div>;
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
