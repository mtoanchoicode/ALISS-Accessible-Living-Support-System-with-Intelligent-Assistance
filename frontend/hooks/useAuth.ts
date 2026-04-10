import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setIsChecking(false);
    });
  }, []);

  return { isAuthenticated, isChecking };
}