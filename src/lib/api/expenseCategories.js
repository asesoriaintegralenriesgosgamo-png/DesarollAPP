import { supabase } from "../supabase";

const COLUMNS = `
  id, project_id, parent_id,
  nombre, color, presupuesto_inicial, moneda, position,
  created_at, updated_at
`;

function sanitize(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === "" || v === undefined) {
      out[k] = null;
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function listCategories(projectId) {
  const { data, error } = await supabase
    .from("expense_categories")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createCategory({ projectId, ...fields }) {
  const payload = sanitize(fields);
  const { data, error } = await supabase
    .from("expense_categories")
    .insert({ project_id: projectId, ...payload })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function updateCategory(id, fields) {
  const payload = sanitize(fields);
  const { data, error } = await supabase
    .from("expense_categories")
    .update(payload)
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCategory(id) {
  const { error } = await supabase.from("expense_categories").delete().eq("id", id);
  if (error) throw error;
}
