import { supabase } from "../supabase";

export async function listCategories(projectId) {
  const { data, error } = await supabase
    .from("construction_categories")
    .select("id, name, color, position, created_at, updated_at")
    .eq("project_id", projectId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createCategory({ projectId, name, color, position = 0 }) {
  const { data, error } = await supabase
    .from("construction_categories")
    .insert({ project_id: projectId, name, color, position })
    .select("id, name, color, position, created_at, updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function updateCategory(id, patch) {
  const allowed = {};
  if (patch.name !== undefined) allowed.name = patch.name;
  if (patch.color !== undefined) allowed.color = patch.color;
  if (patch.position !== undefined) allowed.position = patch.position;
  const { data, error } = await supabase
    .from("construction_categories")
    .update(allowed)
    .eq("id", id)
    .select("id, name, color, position, created_at, updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCategory(id) {
  const { error } = await supabase
    .from("construction_categories")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function reorderCategories(orderedIds) {
  // Optimistic-friendly bulk reorder: update each row's position.
  // Tamaño esperado pequeño (<20 categorías por proyecto).
  const updates = orderedIds.map((id, idx) =>
    supabase.from("construction_categories").update({ position: idx }).eq("id", id)
  );
  const results = await Promise.all(updates);
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) throw firstError;
}
