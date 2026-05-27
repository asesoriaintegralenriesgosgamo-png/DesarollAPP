import { supabase } from "../supabase";

const COLUMNS = `
  id, project_id,
  nombre, tipo, rfc, email, telefono, contacto_nombre, notas,
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

export async function listPayees(projectId) {
  const { data, error } = await supabase
    .from("payees")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("nombre", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createPayee({ projectId, ...fields }) {
  const payload = sanitize(fields);
  const { data, error } = await supabase
    .from("payees")
    .insert({ project_id: projectId, ...payload })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function updatePayee(id, fields) {
  const payload = sanitize(fields);
  const { data, error } = await supabase
    .from("payees")
    .update(payload)
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function deletePayee(id) {
  const { error } = await supabase.from("payees").delete().eq("id", id);
  if (error) throw error;
}
