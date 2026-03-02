"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AppUserRole } from "@/lib/rbac";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: AppUserRole;
  orgId: string;
}

interface AuthContextType {
  user: AuthUser;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({
  user,
  children,
}: {
  user: AuthUser;
  children: ReactNode;
}) {
  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
