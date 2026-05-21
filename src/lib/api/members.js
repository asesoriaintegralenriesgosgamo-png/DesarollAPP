import { supabase } from "../supabase";

export async function listMembers(projectId) {
  const { data, error } = await supabase
    .from("project_members")
    .select(
      `
      user_id,
      role,
      created_at,
      profile:profiles!project_members_user_id_fkey(id, display_name, avatar_url)
      `
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((m) => ({
    user_id: m.user_id,
    role: m.role,
    created_at: m.created_at,
    display_name: m.profile?.display_name ?? null,
    avatar_url: m.profile?.avatar_url ?? null,
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
