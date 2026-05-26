import { useEffect, useState } from "react";
import { Loader2, Trash2, Paperclip, Download } from "lucide-react";
import { FileDropzone } from "../ui/FileDropzone";
import { useToast } from "../ui/Toast";
import {
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  getAttachmentSignedUrl,
} from "../../lib/api/constructionAttachments";
import { fmtBytes, fmtRelative } from "../../lib/construction/dateUtils";

export function TaskAttachments({
  taskId,
  projectId,
  currentUserId,
  canEdit,
}) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listAttachments(taskId)
      .then((data) => { if (!cancelled) setItems(data); })
      .catch((err) => { if (!cancelled) toast.error(err.message || "No se pudieron cargar adjuntos"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [taskId, toast]);

  const handleFiles = async (files) => {
    setUploading(true);
    try {
      for (const file of files) {
        const row = await uploadAttachment({
          projectId,
          taskId,
          file,
          userId: currentUserId,
        });
        setItems((prev) => [row, ...prev]);
      }
      toast.success(files.length === 1 ? "Archivo subido" : `${files.length} archivos subidos`);
    } catch (err) {
      toast.error(err.message || "No se pudo subir el archivo");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (item) => {
    setBusyId(item.id);
    try {
      const url = await getAttachmentSignedUrl(item.storage_path, 120);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err.message || "No se pudo descargar");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item) => {
    setBusyId(item.id);
    try {
      await deleteAttachment({ id: item.id, storagePath: item.storage_path });
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (err) {
      toast.error(err.message || "No se pudo eliminar");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {canEdit && (
        <FileDropzone
          onFiles={handleFiles}
          loading={uploading}
          maxSizeMB={20}
          hint="Hasta 20 MB por archivo"
        />
      )}

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-4 h-4 text-stone-400 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-stone-500 text-center py-2">
          Sin archivos adjuntos.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-stone-100 hover:border-stone-200 hover:bg-stone-50"
            >
              <Paperclip className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-stone-900 truncate">{it.file_name}</div>
                <div className="text-[10px] text-stone-500 tabular-nums">
                  {fmtBytes(it.size_bytes)} · {fmtRelative(it.created_at)}
                </div>
              </div>
              <button
                onClick={() => handleDownload(it)}
                disabled={busyId === it.id}
                className="text-stone-500 hover:text-stone-900 p-1"
                aria-label="Descargar"
              >
                {busyId === it.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
              </button>
              {canEdit && (
                <button
                  onClick={() => handleDelete(it)}
                  disabled={busyId === it.id}
                  className="text-stone-400 hover:text-rose-700 p-1"
                  aria-label="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
