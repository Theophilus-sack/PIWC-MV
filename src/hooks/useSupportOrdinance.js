import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient.js";

// Five tables, identical list/create/update/delete shape — one factory
// instead of duplicating the same pair five times, same pattern as
// useFinance.js's monthlyPerformanceHooks().
function simpleCrudHooks(table, queryKey, orderBy) {
  function useList() {
    return useQuery({
      queryKey: [queryKey],
      queryFn: async () => {
        const { data, error } = await supabase.from(table).select("*").order(orderBy, { ascending: false });
        if (error) throw error;
        return data ?? [];
      },
    });
  }
  function useCreate() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (row) => {
        const { error } = await supabase.from(table).insert(row);
        if (error) throw error;
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
    });
  }
  function useUpdate() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({ id, ...patch }) => {
        const { error } = await supabase.from(table).update(patch).eq("id", id);
        if (error) throw error;
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
    });
  }
  function useDelete() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id) => {
        const { error } = await supabase.from(table).delete().eq("id", id);
        if (error) throw error;
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
    });
  }
  return { useList, useCreate, useUpdate, useDelete };
}

export const {
  useList: useLifeEvents, useCreate: useCreateLifeEvent, useUpdate: useUpdateLifeEvent, useDelete: useDeleteLifeEvent,
} = simpleCrudHooks("life_events", "life-events", "event_date");

export const {
  useList: useMemberSupport, useCreate: useCreateMemberSupport, useUpdate: useUpdateMemberSupport, useDelete: useDeleteMemberSupport,
} = simpleCrudHooks("member_support", "member-support", "support_date");

export const {
  useList: useSoulsWon, useCreate: useCreateSoulWon, useUpdate: useUpdateSoulWon, useDelete: useDeleteSoulWon,
} = simpleCrudHooks("souls_won", "souls-won", "event_date");

export const {
  useList: useWaterBaptisms, useCreate: useCreateWaterBaptism, useUpdate: useUpdateWaterBaptism, useDelete: useDeleteWaterBaptism,
} = simpleCrudHooks("water_baptisms", "water-baptisms", "baptism_date");

export const {
  useList: useHolySpiritBaptisms, useCreate: useCreateHolySpiritBaptism, useUpdate: useUpdateHolySpiritBaptism, useDelete: useDeleteHolySpiritBaptism,
} = simpleCrudHooks("holy_spirit_baptisms", "holy-spirit-baptisms", "baptism_date");
