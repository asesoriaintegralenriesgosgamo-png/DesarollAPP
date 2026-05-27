import { supabase } from "../supabase";

const BUCKET = "accounts-documents";

const COLUMNS = `
  id, project_id, partner_id, account_id,
  fecha, monto, moneda, tipo, concepto,
  metodo, referencia, comprobante_storage_path, estado,
  created_by, created_at, updated_at
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

export async function listContributions(projectId) {
  const { data, error } = await supabase
    .from("partner_contributions")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createContribution({ projectId, userId, ...fields }) {
  const payload = sanitize(fields);
  const { data, error } = await supabase
    .from("partner_contributions")
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

export async function updateContribution(id, fields) {
  const payload = sanitize(fields);
  const { data, error } = await supabase
    .from("partner_contributions")
    .update(payload)
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteContribution(id) {
  const { error } = await supabase.from("partner_contributions").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadContributionReceipt({ projectId, contributionId, file }) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${projectId}/contributions/${contributionId}/${Date.now()}-${safeName}`;
  const { error: upError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upError) throw upError;
  return path;
}

export async function getContributionReceiptUrl(storagePath, expiresInSeconds = 60) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeStorageFile(storagePath) {
  if (!storagePath) return;
  await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
}
