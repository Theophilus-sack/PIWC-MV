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

// Creates the auth.users row + assigns role/ministry in one step, via the
// invite-user Edge Function (the only place the service-role key is
// used — see that function's own comment). redirectTo is computed
// client-side from window.location so the function never has to guess
// this deployment's URL.
export function useInviteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, fullName, role, ministryId }) => {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email, fullName, role: role || null, ministryId: ministryId || null,
          redirectTo: `${window.location.origin}/set-password`,
        },
      });
      if (error) {
        // Non-2xx responses come back as a generic FunctionsHttpError —
        // the specific message ("Only Super Admin or Pastor can invite
        // users", a duplicate-email rejection, etc.) is in the response
        // body, reachable via error.context (the raw Response object).
        const body = await error.context?.json?.().catch(() => null);
        throw new Error(body?.error || error.message);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profiles"] }),
  });
}
