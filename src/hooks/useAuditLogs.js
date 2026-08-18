import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient.js";

// Read-only — audit_logs has no update/delete policy for any role,
// enforced at the schema level (see audit_logs.test.js's immutability
// checks) and reused by every phase's triggers via log_audit_event()
// rather than each phase inventing its own logging path.
export function useAuditLogs({ action = "", targetTable = "", from = "", to = "" } = {}) {
  return useQuery({
    queryKey: ["audit-logs", { action, targetTable, from, to }],
    queryFn: async () => {
      let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (action) query = query.ilike("action", `%${action}%`);
      if (targetTable) query = query.eq("target_table", targetTable);
      if (from) query = query.gte("created_at", from);
      if (to) query = query.lte("created_at", to);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}
