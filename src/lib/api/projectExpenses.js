import { supabase } from "../supabase";

const BUCKET = "accounts-documents";

const COLUMNS = `
  id, project_id, payee_id, category_id, account_id, construction_task_id,
  fecha, monto, moneda, concepto, metodo, referencia, estado,
  factura_uuid, factura_folio, factura_storage_path, comprobante_storage_path,
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

export async function listExpenses(projectId) {
  const { data, error } = await supabase
    .from("project_expenses")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listExpensesByTask(taskId) {
  const { data, error } = await supabase
    .from("project_expenses")
    .select(COLUMNS)
    .eq("construction_task_id", taskId)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createExpense({ projectId, userId, ...fields }) {
  const payload = sanitize(fields);
  const { data, error } = await supabase
    .from("project_expenses")
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

export async function updateExpense(id, fields) {
  const payload = sanitize(fields);
  const { data, error } = await supabase
    .from("project_expenses")
    .update(payload)
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteExpense(id) {
  const { error } = await supabase.from("project_expenses").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadExpenseFile({ projectId, expenseId, file, kind = "comprobante" }) {
  // kind: 'comprobante' | 'factura'
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const folder = kind === "factura" ? "invoices" : "expenses";
  const path = `${projectId}/${folder}/${expenseId}/${Date.now()}-${safeName}`;
  const { error: upError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upError) throw upError;
  return path;
}

export async function getExpenseFileUrl(storagePath, expiresInSeconds = 60) {
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
