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
// gender/residence are additive, optional filters (added for the
// Messages recipient picker's Gender/Location filters) — every existing
// caller that doesn't pass them behaves exactly as before.
export function useMembers({ page = 0, pageSize = 20, search = "", ministryId = "", assembly = "", gender = "", residence = "", sort = "recent" } = {}) {
  return useQuery({
    queryKey: ["members", { page, pageSize, search, ministryId, assembly, gender, residence, sort }],
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
      if (gender) {
        query = query.eq("gender", gender);
      }
      if (residence) {
        query = query.ilike("residence", `%${residence}%`);
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

// Lightweight, unfiltered — CSV import's duplicate-detection set. members
// has no unique constraint on contact (unlike manual_contacts.phone), so
// this is a client-side pre-check rather than something the DB enforces.
export function useAllMemberContacts() {
  return useQuery({
    queryKey: ["members", "all-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("id, contact").not("contact", "is", null);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Bulk variant for CSV import — one insert per batch, same shape as
// useBulkCreateManualContacts. Each row may carry a ministryIds array
// (resolved client-side in lib/importTargets.js from the free-text
// "ministry" and "department" columns — a member can hold one or more of
// each, both via the same ministry_members join table); insert() with
// .select() returns rows in the same order they were given, so the
// ministry_members rows can be built by matching index rather than a
// second round-trip per member.
export function useBulkCreateMembers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (members) => {
      const rows = members.map(({ ministryIds, ...m }) => m);
      const { data, error } = await supabase.from("members").insert(rows).select("id");
      if (error) throw error;

      const ministryRows = members.flatMap((m, i) =>
        (m.ministryIds ?? []).map((ministryId) => ({ ministry_id: ministryId, member_id: data[i].id }))
      );
      if (ministryRows.length) {
        const { error: mmError } = await supabase.from("ministry_members").insert(ministryRows);
        if (mmError) throw mmError;
      }
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] }),
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

// Bulk selection delete (MembersList's Select/Select all toolbar) — one
// request for however many ids are selected, rather than one per row.
// The on_member_delete audit trigger still fires once per row even
// inside this single multi-row DELETE, same as any other bulk statement.
export function useBulkDeleteMembers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids) => {
      const { error } = await supabase.from("members").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] }),
  });
}
