import { supabase } from "./supabase";

export async function listScenarios() {
  const { data, error } = await supabase
    .from("scenarios")
    .select("id, name, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getScenario(id) {
  const { data, error } = await supabase
    .from("scenarios")
    .select("id, name, data")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createScenario({ name, data, userId }) {
  const { data: row, error } = await supabase
    .from("scenarios")
    .insert({ name, data, user_id: userId })
    .select("id, name, created_at, updated_at")
    .single();
  if (error) throw error;
  return row;
}

export async function updateScenario(id, { name, data }) {
  const update = { updated_at: new Date().toISOString() };
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
