import { supabase } from "../supabase";

export async function listMembers(projectId) {
  // project_members.user_id es FK a auth.users (no a profiles), así que no
  // podemos hacer un join embebido por PostgREST. Hacemos dos queries.
  const { data: members, error: errMembers } = await supabase
    .from("project_members")
    .select("user_id, role, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (errMembers) throw errMembers;
  if (members.length === 0) return [];

  const userIds = members.map((m) => m.user_id);
  const { data: profiles, error: errProfiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);
  if (errProfiles) throw errProfiles;

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return members.map((m) => ({
    user_id: m.user_id,
    role: m.role,
    created_at: m.created_at,
    display_name: byId.get(m.user_id)?.display_name ?? null,
    avatar_url: byId.get(m.user_id)?.avatar_url ?? null,
  }));
}

export async function updateMemberRole({ projectId, userId, role }) {
  const { error } = await supabase
    .from("project_members")
    .update({ role })
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function removeMember({ projectId, userId }) {
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function getCurrentUserRole(projectId, userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.role ?? null;
}
