import { supabase } from "../supabase";

const BUCKET = "accounts-documents";

const COLUMNS = `
  id, project_id, partner_id,
  tipo, nombre, descripcion, fecha_firma, fecha_vencimiento,
  storage_path, file_name, content_type, size_bytes,
  uploaded_by, created_at
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

export async function listContracts(projectId) {
  const { data, error } = await supabase
    .from("partner_contracts")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listContractsByPartner(partnerId) {
  const { data, error } = await supabase
    .from("partner_contracts")
    .select(COLUMNS)
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function uploadContract({
  projectId,
  partnerId,
  file,
  userId,
  tipo = "asociacion",
  nombre,
  descripcion = null,
  fechaFirma = null,
  fechaVencimiento = null,
}) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${projectId}/contracts/${partnerId ?? "general"}/${Date.now()}-${safeName}`;
  const { error: upError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upError) throw upError;

  const payload = sanitize({
    project_id: projectId,
    partner_id: partnerId,
    uploaded_by: userId,
    tipo,
    nombre: nombre || file.name,
    descripcion,
    fecha_firma: fechaFirma,
    fecha_vencimiento: fechaVencimiento,
    storage_path: path,
    file_name: file.name,
    content_type: file.type || null,
    size_bytes: file.size,
  });

  const { data, error } = await supabase
    .from("partner_contracts")
    .insert(payload)
    .select(COLUMNS)
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw error;
  }
  return data;
}

export async function updateContract(id, fields) {
  const payload = sanitize(fields);
  const { data, error } = await supabase
    .from("partner_contracts")
    .update(payload)
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function getContractSignedUrl(storagePath, expiresInSeconds = 60) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteContract({ id, storagePath }) {
  const { error } = await supabase.from("partner_contracts").delete().eq("id", id);
  if (error) throw error;
  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
  }
}
