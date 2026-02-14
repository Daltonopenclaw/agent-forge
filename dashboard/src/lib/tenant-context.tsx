"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import { getOrCreateTenant, Tenant } from "./api";

interface TenantContextType {
  tenant: Tenant | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  loading: true,
  error: null,
  refetch: async () => {},
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const { getToken, userId } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTenant = async () => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Not authenticated");
      }
      const t = await getOrCreateTenant(token, userId);
      setTenant(t);
    } catch (err) {
      console.error("Failed to get/create tenant:", err);
      setError(err instanceof Error ? err.message : "Failed to load workspace");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchTenant();
    }
  }, [userId]);

  return (
    <TenantContext.Provider value={{ tenant, loading, error, refetch: fetchTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
