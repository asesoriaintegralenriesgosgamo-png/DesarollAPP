import { supabase } from "../supabase";

const BUCKET = "construction-attachments";

export async function listAttachments(taskId) {
  const { data, error } = await supabase
    .from("construction_task_attachments")
    .select("id, task_id, uploaded_by, storage_path, file_name, content_type, size_bytes, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function uploadAttachment({ projectId, taskId, file, userId }) {
  // Path: <project_id>/<task_id>/<timestamp>-<safeName>
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${projectId}/${taskId}/${Date.now()}-${safeName}`;

  const { error: upError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upError) throw upError;

  const { data, error } = await supabase
    .from("construction_task_attachments")
    .insert({
      task_id: taskId,
      uploaded_by: userId,
      storage_path: path,
      file_name: file.name,
      content_type: file.type || null,
      size_bytes: file.size,
    })
    .select("id, task_id, uploaded_by, storage_path, file_name, content_type, size_bytes, created_at")
    .single();
  if (error) {
    // best-effort cleanup if metadata insert fails
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw error;
  }
  return data;
}

export async function getAttachmentSignedUrl(storagePath, expiresInSeconds = 60) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteAttachment({ id, storagePath }) {
  const { error: dbError } = await supabase
    .from("construction_task_attachments")
    .delete()
    .eq("id", id);
  if (dbError) throw dbError;
  await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
}
