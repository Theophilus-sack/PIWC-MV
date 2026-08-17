import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient.js";

// net_tithes_performance and missions_offering_performance are identical
// in shape (year, month, budget_ghs, actual_ghs) — one factory instead of
// duplicating the same list/upsert pair twice.
function monthlyPerformanceHooks(table, queryKeyPrefix) {
  function useList(year) {
    return useQuery({
      queryKey: [queryKeyPrefix, year],
      queryFn: async () => {
        const { data, error } = await supabase.from(table).select("*").eq("year", year).order("month");
        if (error) throw error;
        return data ?? [];
      },
    });
  }

  function useUpsert() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({ year, month, budget_ghs, actual_ghs }) => {
        const { error } = await supabase
          .from(table)
          .upsert({ year, month, budget_ghs, actual_ghs }, { onConflict: "year,month" });
        if (error) throw error;
      },
      onSuccess: (_data, { year }) => queryClient.invalidateQueries({ queryKey: [queryKeyPrefix, year] }),
    });
  }

  return { useList, useUpsert };
}

export const { useList: useTithesPerformance, useUpsert: useUpsertTithesMonth } =
  monthlyPerformanceHooks("net_tithes_performance", "tithes-performance");

export const { useList: useMissionsPerformance, useUpsert: useUpsertMissionsMonth } =
  monthlyPerformanceHooks("missions_offering_performance", "missions-performance");

// ---------- Designated funds ----------

export function useDesignatedFunds() {
  return useQuery({
    queryKey: ["designated-funds"],
    queryFn: async () => {
      const { data, error } = await supabase.from("designated_funds").select("*").order("fund_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateDesignatedFund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fund) => {
      const { error } = await supabase.from("designated_funds").insert(fund);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["designated-funds"] }),
  });
}

export function useUpdateDesignatedFund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }) => {
      const { error } = await supabase.from("designated_funds").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["designated-funds"] }),
  });
}

export function useDeleteDesignatedFund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("designated_funds").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["designated-funds"] }),
  });
}

// ---------- District accounts (tithe_and_mo — placeholder shape) ----------

export function useDistrictAccounts() {
  return useQuery({
    queryKey: ["district-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tithe_and_mo").select("*").order("entry_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateDistrictAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entry) => {
      const { error } = await supabase.from("tithe_and_mo").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["district-accounts"] }),
  });
}

export function useDeleteDistrictAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("tithe_and_mo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["district-accounts"] }),
  });
}

// ---------- Dashboard ----------

// Sum of this month's actual tithes + missions offering. Only meaningful
// for roles with finance access — callers should gate on that via rbac
// before rendering the result, since a role without access will just get
// an RLS-filtered empty result (not an error).
export function useCurrentMonthGiving() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return useQuery({
    queryKey: ["current-month-giving", year, month],
    queryFn: async () => {
      const [tithes, missions] = await Promise.all([
        supabase.from("net_tithes_performance").select("actual_ghs").eq("year", year).eq("month", month).maybeSingle(),
        supabase.from("missions_offering_performance").select("actual_ghs").eq("year", year).eq("month", month).maybeSingle(),
      ]);
      if (tithes.error) throw tithes.error;
      if (missions.error) throw missions.error;
      const total = (tithes.data?.actual_ghs ?? 0) + (missions.data?.actual_ghs ?? 0);
      return { total, hasData: Boolean(tithes.data || missions.data) };
    },
  });
}
