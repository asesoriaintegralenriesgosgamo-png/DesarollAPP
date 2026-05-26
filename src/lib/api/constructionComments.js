import { supabase } from "../supabase";

export async function listComments(taskId) {
  const { data: comments, error } = await supabase
    .from("construction_task_comments")
    .select("id, task_id, user_id, body, created_at, updated_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (comments.length === 0) return [];

  const userIds = Array.from(new Set(comments.map((c) => c.user_id)));
  const { data: profiles, error: errProfiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);
  if (errProfiles) throw errProfiles;

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return comments.map((c) => ({
    ...c,
    display_name: byId.get(c.user_id)?.display_name ?? null,
    avatar_url: byId.get(c.user_id)?.avatar_url ?? null,
  }));
}

export async function createComment({ taskId, userId, body }) {
  const { data, error } = await supabase
    .from("construction_task_comments")
    .insert({ task_id: taskId, user_id: userId, body })
    .select("id, task_id, user_id, body, created_at, updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function updateComment(id, body) {
  const { data, error } = await supabase
    .from("construction_task_comments")
    .update({ body })
    .eq("id", id)
    .select("id, body, updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteComment(id) {
  const { error } = await supabase
    .from("construction_task_comments")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
