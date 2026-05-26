import { useMemo, useState } from "react";
import { FileText, Trash2, Download, Loader2, Paperclip } from "lucide-react";
import { FileDropzone } from "../ui/FileDropzone";
import { Select, Input } from "../ui/Input";
import { useToast } from "../ui/Toast";
import { SectionCard } from "./SectionCard";
import {
  uploadDocument,
  deleteDocument,
  getDocumentSignedUrl,
} from "../../lib/api/properties";
import { fmtBytes, fmtRelative } from "../../lib/construction/dateUtils";

const CATEGORIAS = [
  { value: "escritura", label: "Escritura" },
  { value: "alineamiento", label: "Alineamiento" },
  { value: "plano", label: "Plano" },
  { value: "catastral", label: "Documento catastral" },
  { value: "predial", label: "Predial" },
  { value: "foto", label: "Foto" },
  { value: "otro", label: "Otro" },
];

const CATEGORIA_LABEL = Object.fromEntries(
  CATEGORIAS.map((c) => [c.value, c.label])
);

export function DocumentsList({
  propertyId,
  projectId,
  userId,
  documents,
  canEdit,
  onChange,
}) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [pendingCategoria, setPendingCategoria] = useState("otro");
  const [pendingDescripcion, setPendingDescripcion] = useState("");

  const grupos = useMemo(() => {
    const acc = new Map();
    for (const c of CATEGORIAS) acc.set(c.value, []);
    for (const d of documents) {
      const cat = d.categoria || "otro";
      if (!acc.has(cat)) acc.set(cat, []);
      acc.get(cat).push(d);
    }
    return acc;
  }, [documents]);

  const handleFiles = async (files) => {
    setUploading(true);
    try {
      const nuevos = [];
      for (const file of files) {
        const row = await uploadDocument({
          projectId,
          propertyId,
          file,
          userId,
          categoria: pendingCategoria,
          descripcion: pendingDescripcion.trim() || null,
        });
        nuevos.push(row);
      }
      onChange([...nuevos, ...documents]);
      setPendingDescripcion("");
      toast.success(
        files.length === 1 ? "Archivo subido" : `${files.length} archivos subidos`
      );
    } catch (err) {
      toast.error(err.message || "No se pudo subir el archivo");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc) => {
    setBusyId(doc.id);
    try {
      const url = await getDocumentSignedUrl(doc.storage_path, 120);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err.message || "No se pudo descargar");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (doc) => {
    setBusyId(doc.id);
    try {
      await deleteDocument({ id: doc.id, storagePath: doc.storage_path });
      onChange(documents.filter((d) => d.id !== doc.id));
      toast.success("Documento eliminado");
    } catch (err) {
      toast.error(err.message || "No se pudo eliminar");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SectionCard title="Documentos" icon={FileText}>
      {canEdit && (
        <div className="flex flex-col gap-2 pb-2 border-b border-stone-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Select
              label="Categoría para próxima subida"
              value={pendingCategoria}
              onChange={(e) => setPendingCategoria(e.target.value)}
            >
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
            <Input
              label="Descripción (opcional)"
              value={pendingDescripcion}
              onChange={(e) => setPendingDescripcion(e.target.value)}
              placeholder="p.ej. Escritura inscrita 2024"
            />
          </div>
          <FileDropzone
            onFiles={handleFiles}
            loading={uploading}
            maxSizeMB={25}
            hint="PDF, imágenes o planos · hasta 25 MB"
          />
        </div>
      )}

      {documents.length === 0 ? (
        <p className="text-xs text-stone-500 text-center py-3">
          Sin documentos registrados.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {[...grupos.entries()].map(([cat, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <h4 className="text-[10px] uppercase tracking-wider text-stone-500 font-medium mb-1">
                  {CATEGORIA_LABEL[cat] || cat}
                </h4>
                <ul className="flex flex-col gap-1">
                  {items.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-stone-100 hover:border-stone-200 hover:bg-stone-50"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-stone-900 truncate">{d.file_name}</div>
                        <div className="text-[10px] text-stone-500 tabular-nums">
                          {fmtBytes(d.size_bytes)} · {fmtRelative(d.created_at)}
                          {d.descripcion ? ` · ${d.descripcion}` : ""}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownload(d)}
                        disabled={busyId === d.id}
                        className="text-stone-500 hover:text-stone-900 p-1"
                        aria-label="Descargar"
                      >
                        {busyId === d.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => handleDelete(d)}
                          disabled={busyId === d.id}
                          className="text-stone-400 hover:text-rose-700 p-1"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
