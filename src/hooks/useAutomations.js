import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient.js";

// Automation *definitions* only — see 0010_messaging_extended.sql's
// comment on message_automations. Create/edit/pause/resume/delete are
// fully real and persist normally; nothing dispatches these on a
// schedule yet (needs a pg_cron job, a later piece).

export function useAutomations() {
  return useQuery({
    queryKey: ["message-automations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_automations")
        .select("*, sms_templates(name), ministries(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, triggerType, triggerConfig, templateId, ministryId }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("message_automations").insert({
        name,
        trigger_type: triggerType,
        trigger_config: triggerConfig ?? {},
        template_id: templateId || null,
        ministry_id: ministryId || null,
        created_by: userData?.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["message-automations"] }),
  });
}

export function useUpdateAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }) => {
      const { error } = await supabase.from("message_automations").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["message-automations"] }),
  });
}

export function useDeleteAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("message_automations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["message-automations"] }),
  });
}
