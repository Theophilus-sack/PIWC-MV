import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient.js";

// Newest-added-first (created_at desc) — insertion order, not alphabetical
// — matching the Members list's default sort. groupByAssembly buckets by
// service without re-sorting, so this order carries through into each
// section.
export function usePresbyters() {
  return useQuery({
    queryKey: ["presbyters"],
    queryFn: async () => {
      const { data, error } = await supabase.from("presbyters").select("*").order("created_at", { ascending: false });
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
        .select("*, ministries(name, assembly)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
