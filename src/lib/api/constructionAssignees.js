import { supabase } from "../supabase";

export async function setAssignees({ taskId, userIds }) {
  // Reemplaza el set completo de asignados de una tarea.
  const { error: delError } = await supabase
    .from("construction_task_assignees")
    .delete()
    .eq("task_id", taskId);
  if (delError) throw delError;
  if (userIds.length === 0) return;
  const rows = userIds.map((uid) => ({ task_id: taskId, user_id: uid }));
  const { error: insError } = await supabase
    .from("construction_task_assignees")
    .insert(rows);
  if (insError) throw insError;
}

export async function addAssignee({ taskId, userId }) {
  const { error } = await supabase
    .from("construction_task_assignees")
    .insert({ task_id: taskId, user_id: userId });
  if (error && error.code !== "23505") throw error; // ignora duplicado
}

export async function removeAssignee({ taskId, userId }) {
  const { error } = await supabase
    .from("construction_task_assignees")
    .delete()
    .eq("task_id", taskId)
    .eq("user_id", userId);
  if (error) throw error;
}
