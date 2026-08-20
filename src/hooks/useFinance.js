import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient.js";

// net_tithes_performance and missions_offering_performance are identical
// in shape (year, month, assembly, budget_ghs, actual_ghs) — one factory
// instead of duplicating the same list/upsert pair twice. Fetches the
// whole year (both assemblies, 24 rows) in one query rather than one
// query per assembly — the monthly table for whichever assembly is
// selected AND the English/Twi/Total summary both derive from this same
// dataset, so there's one source of truth instead of two queries that
// could disagree.
function monthlyPerformanceHooks(table, queryKeyPrefix) {
  function useYearData(year) {
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
      mutationFn: async ({ year, month, assembly, budget_ghs, actual_ghs }) => {
        const { error } = await supabase
          .from(table)
          .upsert({ year, month, assembly, budget_ghs, actual_ghs }, { onConflict: "year,month,assembly" });
        if (error) throw error;
      },
      onSuccess: (_data, { year }) => queryClient.invalidateQueries({ queryKey: [queryKeyPrefix, year] }),
    });
  }

  return { useYearData, useUpsert };
}

export const { useYearData: useTithesYear, useUpsert: useUpsertTithesMonth } =
  monthlyPerformanceHooks("net_tithes_performance", "tithes-performance");

export const { useYearData: useMissionsYear, useUpsert: useUpsertMissionsMonth } =
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

// ---------- Request Form (tithe_and_mo — was "District Accounts") ----------
// Table name unchanged internally (0019_request_form.sql extends it
// additively rather than renaming) — only the user-facing shape/labels
// changed. entry_date/amount_ghs/notes are reused as Request
// Date/Amount/Notes; receiver_name/items_required/approved_by are new.

export function useRequestFormEntries() {
  return useQuery({
    queryKey: ["request-form-entries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tithe_and_mo").select("*").order("entry_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateRequestFormEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entry) => {
      const { error } = await supabase.from("tithe_and_mo").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["request-form-entries"] }),
  });
}

export function useUpdateRequestFormEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }) => {
      const { error } = await supabase.from("tithe_and_mo").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["request-form-entries"] }),
  });
}

export function useDeleteRequestFormEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("tithe_and_mo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["request-form-entries"] }),
  });
}

// ---------- Dashboard ----------

// Sum of this month's actual tithes + missions offering, across both
// assemblies. Only meaningful for roles with finance access — callers
// should gate on that via rbac before rendering the result, since a role
// without access will just get an RLS-filtered empty result (not an
// error).
export function useCurrentMonthGiving() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return useQuery({
    queryKey: ["current-month-giving", year, month],
    queryFn: async () => {
      const [tithes, missions] = await Promise.all([
        supabase.from("net_tithes_performance").select("actual_ghs").eq("year", year).eq("month", month),
        supabase.from("missions_offering_performance").select("actual_ghs").eq("year", year).eq("month", month),
      ]);
      if (tithes.error) throw tithes.error;
      if (missions.error) throw missions.error;
      const sum = (rows) => (rows ?? []).reduce((s, r) => s + Number(r.actual_ghs), 0);
      const total = sum(tithes.data) + sum(missions.data);
      const hasData = (tithes.data?.length ?? 0) > 0 || (missions.data?.length ?? 0) > 0;
      return { total, hasData };
    },
  });
}
