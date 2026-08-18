import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient.js";

// All profiles (church staff/accounts) — RLS (profiles_select_admins,
// 0001_foundation.sql) already restricts this to Super Admin/Pastor,
// matching "Only Super Admin and Pastor can create/assign roles". Used by
// the Admin module's role assignment and Audit Logs' actor-name lookup
// (audit_logs.actor_id -> auth.users, not directly embeddable via
// PostgREST since profiles' FK also targets auth.users, not each other —
// resolved client-side by id instead of a joined select).
export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpdateProfileRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role, ministryId }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ role, ministry_id: role === "ministry_leader" ? (ministryId || null) : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profiles"] }),
  });
}
