import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient.js";

// Pastor-exclusive — see 0011_sermon_notes.sql. RLS already scopes every
// query here to pastor_id = auth.uid(), so there's no separate "my notes
// only" filter needed client-side; a Pastor querying this table can only
// ever get their own rows back regardless of what's asked for.

export function useSermonNotes() {
  return useQuery({
    queryKey: ["sermon-notes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sermon_notes").select("*").order("sermon_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSermonNote(id) {
  return useQuery({
    queryKey: ["sermon-note", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sermon_notes").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateSermonNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ title, scriptureRef, sermonDate, content, status = "draft" }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("sermon_notes")
        .insert({
          pastor_id: userData?.user?.id,
          title, scripture_ref: scriptureRef || null, sermon_date: sermonDate, content: content ?? "", status,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sermon-notes"] }),
  });
}

export function useUpdateSermonNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title, scriptureRef, sermonDate, content, status }) => {
      const { error } = await supabase
        .from("sermon_notes")
        .update({ title, scripture_ref: scriptureRef || null, sermon_date: sermonDate, content, status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["sermon-notes"] });
      queryClient.invalidateQueries({ queryKey: ["sermon-note", id] });
    },
  });
}

export function useDeleteSermonNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("sermon_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sermon-notes"] }),
  });
}
