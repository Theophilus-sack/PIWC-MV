import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient.js";

// The Reports page itself is mostly a dashboard over hooks that already
// exist (useMemberStats, useLastServiceAttendance, useCurrentMonthGiving,
// the Finance year hooks) — each already correctly scoped by its own
// table's RLS. This file only owns the one genuinely new piece:
// comparative_stats.

export function useComparativeStats() {
  return useQuery({
    queryKey: ["comparative-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("comparative_stats").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateComparativeStat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (row) => {
      const { error } = await supabase.from("comparative_stats").insert(row);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comparative-stats"] }),
  });
}

export function useDeleteComparativeStat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("comparative_stats").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comparative-stats"] }),
  });
}
