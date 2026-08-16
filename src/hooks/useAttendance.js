import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient.js";

// ministryId: undefined/null -> general (Sunday) services; a uuid -> that
// ministry's own gatherings. Matches service_dates.ministry_id's meaning.
export function useServiceDates({ ministryId = null, limit = 20 } = {}) {
  return useQuery({
    queryKey: ["service-dates", ministryId],
    queryFn: async () => {
      let query = supabase.from("service_dates").select("*").order("service_date", { ascending: false }).limit(limit);
      query = ministryId ? query.eq("ministry_id", ministryId) : query.is("ministry_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateServiceDate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ serviceDate, name, ministryId = null }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("service_dates")
        .insert({ service_date: serviceDate, name, ministry_id: ministryId, created_by: userData?.user?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["service-dates", data.ministry_id] });
    },
  });
}

export function useAttendanceForService(serviceDateId) {
  return useQuery({
    queryKey: ["attendance", serviceDateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("member_id, present")
        .eq("service_date_id", serviceDateId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(serviceDateId),
  });
}

export function useMarkAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ serviceDateId, memberId, present }) => {
      const { error } = await supabase
        .from("attendance_records")
        .upsert(
          { service_date_id: serviceDateId, member_id: memberId, present },
          { onConflict: "service_date_id,member_id" }
        );
      if (error) throw error;
    },
    onSuccess: (_data, { serviceDateId }) => {
      queryClient.invalidateQueries({ queryKey: ["attendance", serviceDateId] });
    },
  });
}

// MemberDetail: one member's recent attendance history across services.
// Sorted client-side after fetch rather than via .order() on the embedded
// service_dates resource — that needs a supabase-js version-sensitive
// option name (foreignTable vs referencedTable), and the per-member row
// count here is small (bounded by total services, not total members), so
// it's not worth the fragility.
export function useMemberAttendance(memberId, limit = 8) {
  return useQuery({
    queryKey: ["member-attendance", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("present, service_dates(id, service_date, name)")
        .eq("member_id", memberId);
      if (error) throw error;
      return (data ?? [])
        .filter((r) => r.service_dates)
        .sort((a, b) => b.service_dates.service_date.localeCompare(a.service_dates.service_date))
        .slice(0, limit);
    },
    enabled: Boolean(memberId),
  });
}

// Dashboard: most recent general service + how many were marked present.
export function useLastServiceAttendance() {
  return useQuery({
    queryKey: ["last-service-attendance"],
    queryFn: async () => {
      const { data: services, error: serviceError } = await supabase
        .from("service_dates")
        .select("id, service_date, name")
        .is("ministry_id", null)
        .order("service_date", { ascending: false })
        .limit(2);
      if (serviceError) throw serviceError;
      if (!services?.length) return null;

      const [last, prev] = services;
      const countPresent = async (serviceDateId) => {
        const { count, error } = await supabase
          .from("attendance_records")
          .select("*", { count: "exact", head: true })
          .eq("service_date_id", serviceDateId)
          .eq("present", true);
        if (error) throw error;
        return count ?? 0;
      };

      const [lastCount, prevCount] = await Promise.all([
        countPresent(last.id),
        prev ? countPresent(prev.id) : Promise.resolve(null),
      ]);

      return { service: last, count: lastCount, delta: prevCount == null ? null : lastCount - prevCount };
    },
  });
}
