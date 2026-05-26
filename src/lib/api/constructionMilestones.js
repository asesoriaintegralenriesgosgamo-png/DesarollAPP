import { supabase } from "../supabase";

export async function listMilestones(projectId) {
  const { data, error } = await supabase
    .from("construction_milestones")
    .select("id, name, date, color, created_at")
    .eq("project_id", projectId)
    .order("date", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createMilestone({ projectId, name, date, color }) {
  const { data, error } = await supabase
    .from("construction_milestones")
    .insert({ project_id: projectId, name, date, color })
    .select("id, name, date, color, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function updateMilestone(id, patch) {
  const allowed = {};
  if (patch.name !== undefined) allowed.name = patch.name;
  if (patch.date !== undefined) allowed.date = patch.date;
  if (patch.color !== undefined) allowed.color = patch.color;
  const { data, error } = await supabase
    .from("construction_milestones")
    .update(allowed)
    .eq("id", id)
    .select("id, name, date, color, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMilestone(id) {
  const { error } = await supabase
    .from("construction_milestones")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
