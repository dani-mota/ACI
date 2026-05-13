"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Settings, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function UserMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="w-6 h-6 bg-aci-blue flex items-center justify-center text-[10px] font-semibold text-white">
          {user.name.split(" ").map(n => n[0]).join("")}
        </div>
        <span className="hidden md:block text-xs font-medium">{user.name}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-card border border-border shadow-lg py-1 z-50">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs font-medium text-foreground">{user.name}</p>
            <p className="text-[11px] text-muted-foreground">{user.email}</p>
            <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 bg-aci-blue/10 text-aci-blue font-mono font-medium tracking-wide uppercase">
              {user.role.replace("_", " ")}
            </span>
          </div>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            onClick={() => { setOpen(false); router.push("/profile"); }}
          >
            <User className="w-3.5 h-3.5" /> Profile
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            onClick={() => { setOpen(false); }}
          >
            <Settings className="w-3.5 h-3.5" /> Settings
          </button>
          <div className="border-t border-border my-1" />
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 transition-colors"
            onClick={async () => {
              setOpen(false);
              const supabase = createSupabaseBrowserClient();
              if (supabase) {
                await supabase.auth.signOut();
              }
              router.push("/login");
              router.refresh();
            }}
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
