import { supabase } from "../supabase";

const COLUMNS = `
  id, project_id, from_partner_id, to_partner_id,
  fecha, tipo, monto, moneda, porcentaje_transferido,
  concepto, referencia,
  created_by, created_at
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

export async function listTransfers(projectId) {
  const { data, error } = await supabase
    .from("partner_transfers")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createTransfer({ projectId, userId, ...fields }) {
  const payload = sanitize(fields);
  const { data, error } = await supabase
    .from("partner_transfers")
    .insert({
      project_id: projectId,
      created_by: userId,
      ...payload,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function updateTransfer(id, fields) {
  const payload = sanitize(fields);
  const { data, error } = await supabase
    .from("partner_transfers")
    .update(payload)
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTransfer(id) {
  const { error } = await supabase.from("partner_transfers").delete().eq("id", id);
  if (error) throw error;
}
