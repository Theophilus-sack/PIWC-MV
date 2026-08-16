import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient.js";

export function useMinistries() {
  return useQuery({
    queryKey: ["ministries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ministries").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Super Admin only (matches ministries_write RLS) — creating the ministry
// entity itself, not joining one's roster.
export function useCreateMinistry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, assembly }) => {
      const { data, error } = await supabase.from("ministries").insert({ name, assembly }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ministries"] }),
  });
}

// Members belonging to one ministry — used by Groups/Ministries (roster)
// and by the Ministry Leader's scoped views.
export function useMinistryRoster(ministryId) {
  return useQuery({
    queryKey: ["ministry-roster", ministryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ministry_members")
        .select("id, member_id, members(id, name, gender, contact, status)")
        .eq("ministry_id", ministryId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(ministryId),
  });
}

export function useAddMinistryMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ministryId, memberId }) => {
      const { error } = await supabase
        .from("ministry_members")
        .insert({ ministry_id: ministryId, member_id: memberId });
      if (error) throw error;
    },
    onSuccess: (_data, { ministryId }) => {
      queryClient.invalidateQueries({ queryKey: ["ministry-roster", ministryId] });
    },
  });
}

export function useRemoveMinistryMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ministryId }) => {
      const { error } = await supabase.from("ministry_members").delete().eq("id", id);
      if (error) throw error;
      return { ministryId };
    },
    onSuccess: ({ ministryId }) => {
      queryClient.invalidateQueries({ queryKey: ["ministry-roster", ministryId] });
    },
  });
}
