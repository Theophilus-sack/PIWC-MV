import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient.js";

const SORTS = {
  recent: { column: "date_joined", ascending: false },
  name: { column: "name", ascending: true },
};

// Server-side paginated/filtered/sorted — the original prototype's Members
// screen loaded the whole array into a useState and filtered client-side,
// which doesn't hold up at the workbook's real scale (~2000 rows). Every
// filter here becomes a WHERE clause instead of an Array.filter.
export function useMembers({ page = 0, pageSize = 20, search = "", ministryId = "", assembly = "", sort = "recent" } = {}) {
  return useQuery({
    queryKey: ["members", { page, pageSize, search, ministryId, assembly, sort }],
    queryFn: async () => {
      let query = supabase
        .from("members")
        .select(ministryId ? "*, ministry_members!inner(ministry_id)" : "*", { count: "exact" });

      if (search) {
        query = query.or(`name.ilike.%${search}%,contact.ilike.%${search}%`);
      }
      if (ministryId) {
        query = query.eq("ministry_members.ministry_id", ministryId);
      }
      if (assembly) {
        query = query.eq("preferred_assembly", assembly);
      }

      const { column, ascending } = SORTS[sort] ?? SORTS.recent;
      query = query.order(column, { ascending });

      const from = page * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0 };
    },
    placeholderData: keepPreviousData,
  });
}

// Dashboard: total members + how many joined since the 1st of this month.
export function useMemberStats() {
  return useQuery({
    queryKey: ["member-stats"],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const startOfMonthStr = startOfMonth.toISOString().slice(0, 10);

      const [{ count: total, error: totalError }, { count: newThisMonth, error: newError }] = await Promise.all([
        supabase.from("members").select("*", { count: "exact", head: true }),
        supabase.from("members").select("*", { count: "exact", head: true }).gte("date_joined", startOfMonthStr),
      ]);
      if (totalError) throw totalError;
      if (newError) throw newError;
      return { total: total ?? 0, newThisMonth: newThisMonth ?? 0 };
    },
  });
}

export function useMember(id) {
  return useQuery({
    queryKey: ["member", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (member) => {
      const { data, error } = await supabase.from("members").insert(member).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] }),
  });
}

export function useUpdateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }) => {
      const { data, error } = await supabase.from("members").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["member", data.id] });
    },
  });
}

export function useDeleteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] }),
  });
}
