import { supabase } from "../supabase";

const COLUMNS = `
  id, project_id,
  nombre, banco, numero_cuenta, clabe, moneda,
  saldo_inicial, fecha_apertura, tipo,
  activa, notas, position,
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

export async function listBankAccounts(projectId) {
  const { data, error } = await supabase
    .from("project_bank_accounts")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createBankAccount({ projectId, ...fields }) {
  const payload = sanitize(fields);
  const { data, error } = await supabase
    .from("project_bank_accounts")
    .insert({ project_id: projectId, ...payload })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function updateBankAccount(id, fields) {
  const payload = sanitize(fields);
  const { data, error } = await supabase
    .from("project_bank_accounts")
    .update(payload)
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBankAccount(id) {
  const { error } = await supabase.from("project_bank_accounts").delete().eq("id", id);
  if (error) throw error;
}
