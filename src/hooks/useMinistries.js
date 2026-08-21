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

// Super Admin only (ministries_write RLS) — renaming/re-categorising the
// ministry entity itself.
export function useUpdateMinistry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, assembly }) => {
      const { error } = await supabase.from("ministries").update({ name, assembly }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ministries"] }),
  });
}

// Super Admin only. Cascades to ministry_members and ministry_leadership
// (both FK ministry_id references ... on delete cascade) and nulls out
// service_dates.ministry_id (that FK has no cascade, matching that a
// past service's attendance record shouldn't vanish just because the
// ministry that held it was later deleted).
export function useDeleteMinistry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("ministries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ministries"] });
      queryClient.invalidateQueries({ queryKey: ["ministry-leadership"] });
    },
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
        .select("id, member_id, members(id, name, gender, contact, status, residence)")
        .eq("ministry_id", ministryId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(ministryId),
  });
}

// Reverse of useMinistryRoster — given a member, which ministries/
// departments they belong to (assembly='Both' entries are Departments,
// English/Twi entries are Ministries — same join table, just a different
// direction of lookup). Powers MemberDetail's Department/Ministry fields
// and EditMemberModal's picker.
export function useMemberMinistries(memberId) {
  return useQuery({
    queryKey: ["member-ministries", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ministry_members")
        .select("id, ministry_id, ministries(id, name, assembly)")
        .eq("member_id", memberId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(memberId),
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

// Join a member to several ministries at once — used by Add Member's
// multi-ministry picker. ministry_members has no cap on how many
// ministries a member belongs to (it's a plain many-to-many join table),
// so this was always possible at the data layer; only the old
// single-select UI restricted it to one.
export function useAddMinistryMemberships() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberId, ministryIds }) => {
      if (!ministryIds.length) return;
      const { error } = await supabase
        .from("ministry_members")
        .insert(ministryIds.map((ministryId) => ({ ministry_id: ministryId, member_id: memberId })));
      if (error) throw error;
    },
    onSuccess: (_data, { memberId, ministryIds }) => {
      for (const ministryId of ministryIds) {
        queryClient.invalidateQueries({ queryKey: ["ministry-roster", ministryId] });
      }
      queryClient.invalidateQueries({ queryKey: ["member-ministries", memberId] });
    },
  });
}

export function useRemoveMinistryMember() {
  const queryClient = useQueryClient();
  return useMutation({
    // memberId is optional — existing callers (Groups/Ministries roster)
    // don't pass it and behave exactly as before; EditMemberModal's
    // Department/Ministry picker does, so its own cache refreshes too.
    mutationFn: async ({ id, ministryId, memberId }) => {
      const { error } = await supabase.from("ministry_members").delete().eq("id", id);
      if (error) throw error;
      return { ministryId, memberId };
    },
    onSuccess: ({ ministryId, memberId }) => {
      queryClient.invalidateQueries({ queryKey: ["ministry-roster", ministryId] });
      if (memberId) queryClient.invalidateQueries({ queryKey: ["member-ministries", memberId] });
    },
  });
}

// ---------- Ministry activity log (Phase 6, extends Groups/Ministries) ----------

export function useMinistryActivities(ministryId) {
  return useQuery({
    queryKey: ["ministry-activities", ministryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ministry_activities")
        .select("*")
        .eq("ministry_id", ministryId)
        .order("activity_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(ministryId),
  });
}

export function useCreateMinistryActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (activity) => {
      const { error } = await supabase.from("ministry_activities").insert(activity);
      if (error) throw error;
    },
    onSuccess: (_data, { ministry_id }) => {
      queryClient.invalidateQueries({ queryKey: ["ministry-activities", ministry_id] });
    },
  });
}

export function useDeleteMinistryActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.from("ministry_activities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, { ministryId }) => {
      queryClient.invalidateQueries({ queryKey: ["ministry-activities", ministryId] });
    },
  });
}
