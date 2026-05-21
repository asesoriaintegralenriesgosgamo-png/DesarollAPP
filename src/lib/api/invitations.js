import { supabase } from "../supabase";

export async function listInvitations(projectId) {
  const { data, error } = await supabase
    .from("invitations")
    .select("id, email, token, role, expires_at, accepted_at, created_at, invited_by")
    .eq("project_id", projectId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createEmailInvitation({ projectId, email, role, invitedBy }) {
  const { data, error } = await supabase
    .from("invitations")
    .insert({ project_id: projectId, email, role, invited_by: invitedBy })
    .select("id, email, token, role, expires_at, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function createLinkInvitation({ projectId, role, invitedBy }) {
  // email = null marca la invitación como tipo link (reutilizable hasta expirar)
  const { data, error } = await supabase
    .from("invitations")
    .insert({ project_id: projectId, email: null, role, invited_by: invitedBy })
    .select("id, token, role, expires_at, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function revokeInvitation(id) {
  const { error } = await supabase.from("invitations").delete().eq("id", id);
  if (error) throw error;
}

export async function acceptInvitation(token) {
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) throw error;
  // RPC retorna SETOF (project_id, role); supabase-js lo entrega como array.
  if (!data || data.length === 0) throw new Error("invitation_not_found");
  return data[0];
}

/**
 * Detalle público mínimo de una invitación por token (para mostrar antes de aceptar).
 * Nota: por RLS, solo miembros del proyecto pueden hacer SELECT. Para el flujo de
 * aceptación previa al login no podemos leer la invitación; mostramos un texto
 * genérico en /invite/:token y validamos al aceptar.
 */
export async function previewInvitation(token) {
  // Intento best-effort. Si el usuario no es miembro aún devuelve null y la UI
  // muestra "Te invitaron a un proyecto" sin nombre.
  const { data } = await supabase
    .from("invitations")
    .select("id, role, expires_at, accepted_at, project:projects(id, name)")
    .eq("token", token)
    .maybeSingle();
  return data ?? null;
}
