import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient.js";
import { normalizeGhanaPhone } from "../lib/sms.js";

// External/custom recipients who aren't part of the church member
// directory — deliberately a separate table (manual_contacts), not
// duplicated member data. See 0010_messaging_extended.sql.

export function useManualContacts({ search = "" } = {}) {
  return useQuery({
    queryKey: ["manual-contacts", search],
    queryFn: async () => {
      let query = supabase.from("manual_contacts").select("*").order("full_name");
      if (search) {
        query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,group_label.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

function friendlyError(error) {
  if (error.code === "23505") return new Error("A contact with this phone number already exists.");
  return error;
}

export function useCreateManualContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fullName, phone, email, groupLabel, notes }) => {
      const normalized = normalizeGhanaPhone(phone);
      if (!normalized) throw new Error("That doesn't look like a valid Ghanaian phone number.");
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("manual_contacts").insert({
        full_name: fullName,
        phone: normalized,
        email: email || null,
        group_label: groupLabel || null,
        notes: notes || null,
        created_by: userData?.user?.id ?? null,
      });
      if (error) throw friendlyError(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["manual-contacts"] }),
  });
}

// Bulk variant for CSV import — inserts everything in one request and
// lets the caller decide how to report per-row failures (a single insert
// call either succeeds entirely or fails entirely in Postgres, so the
// import UI pre-validates rows client-side before calling this rather
// than relying on partial-success semantics that don't exist here).
export function useBulkCreateManualContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contacts) => {
      const { data: userData } = await supabase.auth.getUser();
      const rows = contacts.map((c) => ({
        full_name: c.fullName,
        phone: c.phone,
        email: c.email || null,
        group_label: c.groupLabel || null,
        notes: c.notes || null,
        created_by: userData?.user?.id ?? null,
      }));
      const { error } = await supabase.from("manual_contacts").insert(rows);
      if (error) throw friendlyError(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["manual-contacts"] }),
  });
}

export function useUpdateManualContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fullName, phone, email, groupLabel, notes }) => {
      const normalized = normalizeGhanaPhone(phone);
      if (!normalized) throw new Error("That doesn't look like a valid Ghanaian phone number.");
      const { error } = await supabase
        .from("manual_contacts")
        .update({ full_name: fullName, phone: normalized, email: email || null, group_label: groupLabel || null, notes: notes || null })
        .eq("id", id);
      if (error) throw friendlyError(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["manual-contacts"] }),
  });
}

export function useDeleteManualContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("manual_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["manual-contacts"] }),
  });
}
