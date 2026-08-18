import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient.js";
import { normalizeGhanaPhone, validateSendRequest } from "../lib/sms.js";

// ---------- Templates ----------

export function useSmsTemplates() {
  return useQuery({
    queryKey: ["sms-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sms_templates").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, body }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("sms_templates")
        .insert({ name, body, created_by: userData?.user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sms-templates"] }),
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("sms_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sms-templates"] }),
  });
}

// ---------- Logs (batches) ----------

export function useSmsBatches() {
  return useQuery({
    queryKey: ["sms-batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_batches")
        .select("*, ministries(name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Per-recipient breakdown for one batch — fetched on demand (log row
// expand), not joined into the list query above, so the Logs list stays
// one row per batch regardless of how many recipients it had.
export function useSmsBatchMessages(batchId) {
  return useQuery({
    queryKey: ["sms-batch-messages", batchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_messages")
        .select("*")
        .eq("batch_id", batchId)
        .order("recipient_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(batchId),
  });
}

export function useSmsBalance() {
  return useQuery({
    queryKey: ["sms-balance"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-sms", { body: { action: "balance" } });
      if (error) throw error;
      return data;
    },
    // The balance check hits the Edge Function over the network; a stale
    // number for a few minutes doesn't matter, but firing on every
    // Messages page render would (unnecessary function invocations).
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

// ---------- Send ----------

/**
 * recipients: [{ memberId, name, phone }]
 * scheduledAt: ISO string or null (null = send immediately)
 * ministryId: the batch's scope — null for a general/church-wide send
 * (only Secretary/Super Admin/Comms Media may do that; a Ministry Leader's
 * ministryId is enforced by RLS regardless of what's passed here).
 */
export function useSendSms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, recipients, ministryId = null, templateId = null, scheduledAt = null }) => {
      const validation = validateSendRequest({ body, recipients, scheduledAt });
      if (!validation.ok) throw new Error(validation.error);

      const { data: userData } = await supabase.auth.getUser();

      const { data: batch, error: batchError } = await supabase
        .from("sms_batches")
        .insert({
          body,
          template_id: templateId,
          ministry_id: ministryId,
          recipient_count: recipients.length,
          scheduled_at: scheduledAt,
          sent_by: userData?.user?.id ?? null,
        })
        .select()
        .single();
      if (batchError) throw batchError;

      const { error: messagesError } = await supabase.from("sms_messages").insert(
        recipients.map((r) => ({
          batch_id: batch.id,
          recipient_member_id: r.memberId ?? null,
          recipient_phone: normalizeGhanaPhone(r.phone) ?? r.phone,
          recipient_name: r.name ?? null,
        }))
      );
      if (messagesError) throw messagesError;

      // Scheduled-for-later batches stay queued — nothing dispatches them
      // yet (see the Edge Function's own comment on this gap). Send-now
      // batches get dispatched immediately via the Edge Function.
      if (!scheduledAt) {
        const { data: sendResult, error: sendError } = await supabase.functions.invoke("send-sms", {
          body: { batchId: batch.id },
        });
        if (sendError) throw sendError;
        return { batch, sendResult };
      }
      return { batch, scheduled: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms-batches"] });
    },
  });
}
