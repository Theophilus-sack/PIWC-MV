import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient.js";

// Postgres error codes surfaced by migration 0025's constraints:
// 23505 = unique_violation (duplicate presbyter/portfolio assignment),
// 23503 = foreign_key_violation (member_id doesn't reference a real row —
// shouldn't happen via the UI's MemberPicker, but the FK is the actual
// enforcement, not the picker). A raw "duplicate key value violates
// constraint ..." isn't something to show someone filling in a form.
export function friendlyLeadershipError(err, { duplicateMessage }) {
  if (err?.code === "23505") return duplicateMessage;
  if (err?.code === "23503") return "That member no longer exists — please search and select again.";
  return err?.message || "Couldn't save this record.";
}

// Joins the linked member (when member_id is set) so the UI can prefer
// the live members.name/contact over the legacy snapshot columns — see
// migration 0025's header comment for why both still exist side by side.
// Only the fields the roster actually displays are selected, not the
// full members row. Newest-added-first (created_at desc) — insertion
// order, not alphabetical — matching the Members list's default sort.
// groupByAssembly buckets by service without re-sorting, so this order
// carries through into each section.
export function usePresbyters() {
  return useQuery({
    queryKey: ["presbyters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("presbyters")
        .select("id, name, contact, assembly, portfolio, member_id, created_at, members(id, name, contact, gender, status)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreatePresbyter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (presbyter) => {
      const { error } = await supabase.from("presbyters").insert(presbyter);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["presbyters"] }),
  });
}

export function useUpdatePresbyter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }) => {
      const { error } = await supabase.from("presbyters").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["presbyters"] }),
  });
}

export function useDeletePresbyter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("presbyters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["presbyters"] }),
  });
}

export function useCreateMinistryLeader() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entry) => {
      const { error } = await supabase.from("ministry_leadership").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ministry-leadership"] }),
  });
}

export function useUpdateMinistryLeader() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }) => {
      const { error } = await supabase.from("ministry_leadership").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ministry-leadership"] }),
  });
}

export function useDeleteMinistryLeader() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("ministry_leadership").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ministry-leadership"] }),
  });
}

// Newest-added-first (created_at desc), same as usePresbyters above.
export function useMinistryLeadership() {
  return useQuery({
    queryKey: ["ministry-leadership"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ministry_leadership")
        .select("*, ministries(name, assembly), members(id, name, contact, gender, status)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
