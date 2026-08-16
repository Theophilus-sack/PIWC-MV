import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient.js";

export function usePresbyters() {
  return useQuery({
    queryKey: ["presbyters"],
    queryFn: async () => {
      const { data, error } = await supabase.from("presbyters").select("*").order("name");
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

export function useMinistryLeadership() {
  return useQuery({
    queryKey: ["ministry-leadership"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ministry_leadership")
        .select("*, ministries(name, assembly)")
        .order("leader_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}
