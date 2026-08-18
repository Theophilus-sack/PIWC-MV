// Sends (or simulates sending, in mock mode) a previously-created
// sms_batch's queued messages. The client's flow is: insert an sms_batches
// row + its sms_messages rows (status 'queued') directly via the normal
// Supabase client — those inserts are already RLS-gated exactly like any
// other table — then invoke this function with { batchId } to actually
// dispatch them.
//
// This function is deliberately thin on authority: it forwards the
// caller's own JWT to the Supabase client instead of using a service-role
// key, so it can only ever touch a batch the calling user's RLS policies
// already let them see (see sms_batches_select/sms_messages_select in
// 0009_messaging.sql). A Ministry Leader invoking this for another
// ministry's batch gets the same "no rows" result the RLS policy would
// give a direct query — there's no elevated path here to bypass that.
//
// Scheduled batches (scheduled_at in the future) are inserted as normal
// but this function refuses to send them until that time arrives — see
// the guard below. Actually dispatching a batch once its scheduled_at
// arrives needs something to call this function at that time (a
// pg_cron job hitting a "send all due batches" variant, or an external
// scheduler); that trigger isn't wired up yet, which is a known gap for a
// later pass, not an oversight — the schema and this function are ready
// for it.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getProvider } from "./provider.ts";
import { normalizeGhanaPhone } from "./phone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const payload = await req.json();

    if (payload.action === "balance") {
      const balance = await getProvider().getBalance();
      return json(balance);
    }

    const { batchId } = payload;
    if (!batchId) return json({ error: "batchId is required" }, 400);

    const { data: batch, error: batchError } = await supabase
      .from("sms_batches")
      .select("id, body, status, scheduled_at")
      .eq("id", batchId)
      .single();
    if (batchError || !batch) return json({ error: "Batch not found or not accessible" }, 404);

    if (batch.status !== "queued") {
      return json({ error: `Batch is already ${batch.status}, refusing to re-send` }, 409);
    }
    if (batch.scheduled_at && new Date(batch.scheduled_at).getTime() > Date.now()) {
      return json({ error: "Batch is scheduled for the future — not due yet" }, 409);
    }

    const { data: messages, error: messagesError } = await supabase
      .from("sms_messages")
      .select("id, recipient_phone")
      .eq("batch_id", batchId)
      .eq("status", "queued");
    if (messagesError) return json({ error: messagesError.message }, 500);
    if (!messages?.length) return json({ error: "No queued messages on this batch" }, 409);

    await supabase.from("sms_batches").update({ status: "sending" }).eq("id", batchId);

    const phoneByNormalized = new Map(
      messages.map((m) => [normalizeGhanaPhone(m.recipient_phone) ?? m.recipient_phone, m])
    );
    const provider = getProvider();
    const results = await provider.send([...phoneByNormalized.keys()], batch.body);

    const now = new Date().toISOString();
    let sentCount = 0;
    let failedCount = 0;

    await Promise.all(
      results.map(async (result) => {
        const message = phoneByNormalized.get(result.phone);
        if (!message) return;
        if (result.status === "sent") sentCount++; else failedCount++;
        await supabase
          .from("sms_messages")
          .update({
            status: result.status,
            provider_message_id: result.providerMessageId ?? null,
            error_message: result.errorMessage ?? null,
            sent_at: now,
          })
          .eq("id", message.id);
      })
    );

    const finalStatus = failedCount === 0 ? "sent" : sentCount === 0 ? "failed" : "partially_failed";
    await supabase.from("sms_batches").update({ status: finalStatus, sent_at: now }).eq("id", batchId);

    return json({ batchId, status: finalStatus, sentCount, failedCount });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
