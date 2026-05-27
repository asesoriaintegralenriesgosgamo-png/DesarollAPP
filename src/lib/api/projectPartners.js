import { supabase } from "../supabase";

const PARTNER_COLUMNS = `
  id, project_id, linked_user_id,
  nombre, tipo_persona, rfc, curp,
  identificacion_tipo, identificacion_numero,
  email, telefono, domicilio_fiscal,
  rol_en_proyecto, porcentaje_contractual, monto_comprometido, moneda,
  color, activo, notas, position,
  created_by, updated_by, created_at, updated_at
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

export async function listPartners(projectId) {
  const { data, error } = await supabase
    .from("project_partners")
    .select(PARTNER_COLUMNS)
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createPartner({ projectId, userId, ...fields }) {
  const payload = sanitize(fields);
  const { data, error } = await supabase
    .from("project_partners")
    .insert({
      project_id: projectId,
      created_by: userId,
      updated_by: userId,
      ...payload,
    })
    .select(PARTNER_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function updatePartner(id, { userId, ...fields }) {
  const payload = sanitize(fields);
  const { data, error } = await supabase
    .from("project_partners")
    .update({ ...payload, updated_by: userId ?? null })
    .eq("id", id)
    .select(PARTNER_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function deletePartner(id) {
  const { error } = await supabase.from("project_partners").delete().eq("id", id);
  if (error) throw error;
}
