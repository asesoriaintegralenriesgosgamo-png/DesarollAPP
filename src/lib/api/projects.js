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
  // DEBUG temporal — quitar después de validar RLS
  const { data: { session } } = await supabase.auth.getSession();
  // Decodifica el payload del JWT (solo para diagnóstico, no se valida firma)
  let jwtPayload = null;
  try {
    const part = session?.access_token?.split(".")[1];
    if (part) jwtPayload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  } catch (e) {
    jwtPayload = { decode_error: String(e) };
  }
  // Pregunta al servidor qué ve
  const { data: serverView, error: dbgErr } = await supabase.rpc("debug_auth");
  // eslint-disable-next-line no-console
  console.log("[createProject] CLIENT:", {
    ownerId,
    session_user_id: session?.user?.id,
    jwt_sub: jwtPayload?.sub,
    jwt_aud: jwtPayload?.aud,
    jwt_role: jwtPayload?.role,
    jwt_iss: jwtPayload?.iss,
    jwt_exp_iso: jwtPayload?.exp ? new Date(jwtPayload.exp * 1000).toISOString() : null,
    now_iso: new Date().toISOString(),
  });
  // eslint-disable-next-line no-console
  console.log("[createProject] SERVER (debug_auth):", serverView, dbgErr);

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
