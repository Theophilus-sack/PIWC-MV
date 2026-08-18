import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient.js";
import { normalizeGhanaPhone, validateSendRequest, applyTemplateVariables, splitName } from "../lib/sms.js";

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
    mutationFn: async ({ name, body, category = null, description = null }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("sms_templates")
        .insert({ name, body, category, description, created_by: userData?.user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sms-templates"] }),
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, body, category = null, description = null }) => {
      const { error } = await supabase
        .from("sms_templates")
        .update({ name, body, category, description })
        .eq("id", id);
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

// Batches still queued with a future/past-due scheduled_at — the
// Scheduled tab. Distinct from useSmsBatches (Logs, everything) so the
// filtering happens in the query, not by scanning the full log client-side.
export function useScheduledBatches() {
  return useQuery({
    queryKey: ["sms-batches-scheduled"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_batches")
        .select("*, ministries(name)")
        .not("scheduled_at", "is", null)
        .eq("status", "queued")
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCancelScheduledBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (batchId) => {
      const { error } = await supabase.from("sms_batches").delete().eq("id", batchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms-batches-scheduled"] });
      queryClient.invalidateQueries({ queryKey: ["sms-batches"] });
    },
  });
}

// Sent/failed/delivered counts for one batch — real aggregation over
// sms_messages.status. "delivered" will read 0 until an Arkesel delivery-
// report webhook exists (not built yet); sent/failed are accurate today.
export function useSmsBatchDeliverySummary(batchId) {
  return useQuery({
    queryKey: ["sms-batch-delivery-summary", batchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sms_messages").select("status").eq("batch_id", batchId);
      if (error) throw error;
      const summary = { total: data?.length ?? 0, queued: 0, sent: 0, delivered: 0, failed: 0 };
      for (const row of data ?? []) {
        if (row.status in summary) summary[row.status]++;
      }
      return summary;
    },
    enabled: Boolean(batchId),
  });
}

// Read-only Sender ID / provider-mode display — see the Edge Function's
// {action:"config"} branch for why this is never a client-editable field.
export function useSmsConfig() {
  return useQuery({
    queryKey: ["sms-config"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-sms", { body: { action: "config" } });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
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
 * recipients: [{ memberId, name, phone, ministry, isManual }] — `ministry`
 * (name string) and `isManual` are optional; both only affect
 * personalization / the informational recipient_source column, never RLS.
 * scheduledAt: ISO string or null (null = send immediately)
 * ministryId: the batch's scope — null for a general/church-wide send
 * (only Secretary/Super Admin/Comms Media may do that; a Ministry Leader's
 * ministryId is enforced by RLS regardless of what's passed here).
 * personalize: when true, resolves {{first_name}}/etc. per recipient into
 * sms_messages.resolved_body before insert; the Edge Function sends each
 * recipient their own resolved text instead of the shared batch body.
 */
export function useSendSms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, recipients, ministryId = null, templateId = null, scheduledAt = null, personalize = false }) => {
      const validation = validateSendRequest({ body, recipients, scheduledAt });
      if (!validation.ok) throw new Error(validation.error);

      const { data: userData } = await supabase.auth.getUser();

      const hasMember = recipients.some((r) => !r.isManual);
      const hasManual = recipients.some((r) => r.isManual);
      const recipientSource = hasMember && hasManual ? "mixed" : hasManual ? "manual" : "members";

      const { data: batch, error: batchError } = await supabase
        .from("sms_batches")
        .insert({
          body,
          template_id: templateId,
          ministry_id: ministryId,
          recipient_count: recipients.length,
          scheduled_at: scheduledAt,
          sent_by: userData?.user?.id ?? null,
          recipient_source: recipientSource,
        })
        .select()
        .single();
      if (batchError) throw batchError;

      const { error: messagesError } = await supabase.from("sms_messages").insert(
        recipients.map((r) => {
          const normalizedPhone = normalizeGhanaPhone(r.phone) ?? r.phone;
          const { firstName, lastName } = splitName(r.name);
          return {
            batch_id: batch.id,
            recipient_member_id: r.isManual ? null : (r.memberId ?? null),
            recipient_phone: normalizedPhone,
            recipient_name: r.name ?? null,
            resolved_body: personalize
              ? applyTemplateVariables(body, { firstName, lastName, fullName: r.name ?? "", phone: normalizedPhone, ministry: r.ministry ?? "" })
              : null,
          };
        })
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
