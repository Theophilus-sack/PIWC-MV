import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient.js";

// Same generic CRUD factory as useSupportOrdinance.js — five tables here too,
// same list/create/update/delete shape. ministry_id scoping (where a
// table has it) is just a normal column on the row the caller passes in;
// RLS (0013_events.sql) is what actually enforces who can set it to what.
function simpleCrudHooks(table, queryKey, orderBy) {
  function useList() {
    return useQuery({
      queryKey: [queryKey],
      queryFn: async () => {
        const { data, error } = await supabase.from(table).select("*, ministries(name)").order(orderBy, { ascending: false });
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

// minutes/convention_attendance have no ministry_id column — a plain
// select("*") avoids requesting a join PostgREST can't resolve.
function simpleCrudHooksNoMinistry(table, queryKey, orderBy) {
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
  const { useCreate, useUpdate, useDelete } = simpleCrudHooks(table, queryKey, orderBy);
  return { useList, useCreate, useUpdate, useDelete };
}

export const {
  useList: useEvents, useCreate: useCreateEvent, useUpdate: useUpdateEvent, useDelete: useDeleteEvent,
} = simpleCrudHooks("events", "events", "event_date");

export const {
  useList: useActivities, useCreate: useCreateActivity, useUpdate: useUpdateActivity, useDelete: useDeleteActivity,
} = simpleCrudHooks("activities", "activities", "activity_date");

export const {
  useList: useOtherActivities, useCreate: useCreateOtherActivity, useUpdate: useUpdateOtherActivity, useDelete: useDeleteOtherActivity,
} = simpleCrudHooks("other_activities", "other-activities", "activity_date");

export const {
  useList: useMinutes, useCreate: useCreateMinutes, useUpdate: useUpdateMinutes, useDelete: useDeleteMinutes,
} = simpleCrudHooksNoMinistry("minutes", "minutes", "meeting_date");

export const {
  useList: useConventionAttendance, useCreate: useCreateConventionAttendance,
  useUpdate: useUpdateConventionAttendance, useDelete: useDeleteConventionAttendance,
} = simpleCrudHooksNoMinistry("convention_attendance", "convention-attendance", "year");
