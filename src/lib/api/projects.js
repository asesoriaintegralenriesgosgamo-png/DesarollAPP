import { supabase } from "../supabase";

/**
 * Devuelve los proyectos visibles para el usuario actual con metadata mínima
 * (conteo de escenarios, miembros). RLS se encarga del filtrado.
 */
export async function listProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select(
      `
      id,
      name,
      description,
      owner_id,
      created_at,
      updated_at,
      scenarios:scenarios(count),
      members:project_members(role, user_id)
      `
    )
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data.map((p) => ({
    ...p,
    scenarios_count: p.scenarios?.[0]?.count ?? 0,
    members_count: p.members?.length ?? 0,
    raw_members: p.members ?? [],
  }));
}

export async function getProject(id) {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, owner_id, created_at, updated_at")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createProject({ name, description = null, ownerId }) {
  const { data, error } = await supabase
    .from("projects")
    .insert({ name, description, owner_id: ownerId })
    .select("id, name, description, owner_id, created_at, updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function updateProject(id, { name, description }) {
  const update = {};
  if (name !== undefined) update.name = name;
  if (description !== undefined) update.description = description;
  const { data, error } = await supabase
    .from("projects")
    .update(update)
    .eq("id", id)
    .select("id, name, description, owner_id, updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProject(id) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}
