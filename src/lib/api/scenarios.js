import { supabase } from "../supabase";

export async function listScenarios(projectId) {
  const { data, error } = await supabase
    .from("scenarios")
    .select("id, name, data, created_at, updated_at, created_by")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getScenario(id) {
  const { data, error } = await supabase
    .from("scenarios")
    .select("id, project_id, name, data, created_at, updated_at, created_by")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createScenario({ projectId, name, data, createdBy }) {
  const { data: row, error } = await supabase
    .from("scenarios")
    .insert({ project_id: projectId, name, data, created_by: createdBy })
    .select("id, name, created_at, updated_at")
    .single();
  if (error) throw error;
  return row;
}

export async function updateScenario(id, { name, data }) {
  const update = {};
  if (name !== undefined) update.name = name;
  if (data !== undefined) update.data = data;
  const { data: row, error } = await supabase
    .from("scenarios")
    .update(update)
    .eq("id", id)
    .select("id, name, updated_at")
    .single();
  if (error) throw error;
  return row;
}

export async function deleteScenario(id) {
  const { error } = await supabase.from("scenarios").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateScenario(id, newName) {
  const original = await getScenario(id);
  return createScenario({
    projectId: original.project_id,
    name: newName || `${original.name} (copia)`,
    data: original.data,
    createdBy: original.created_by,
  });
}
