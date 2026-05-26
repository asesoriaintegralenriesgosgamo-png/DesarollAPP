import { useEffect, useState } from "react";
import { Send, Loader2, Trash2, Pencil, X, Check } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import {
  listComments,
  createComment,
  updateComment,
  deleteComment,
} from "../../lib/api/constructionComments";
import { fmtRelative } from "../../lib/construction/dateUtils";

export function TaskComments({ taskId, currentUserId, currentUserProfile }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listComments(taskId)
      .then((data) => { if (!cancelled) setItems(data); })
      .catch((err) => { if (!cancelled) toast.error(err.message || "No se pudieron cargar los comentarios"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [taskId, toast]);

  const handleSend = async (e) => {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const row = await createComment({ taskId, userId: currentUserId, body });
      setItems((prev) => [...prev, {
        ...row,
        display_name: currentUserProfile?.display_name ?? null,
        avatar_url: currentUserProfile?.avatar_url ?? null,
      }]);
      setDraft("");
    } catch (err) {
      toast.error(err.message || "No se pudo enviar");
    } finally {
      setSending(false);
    }
  };

  const handleEdit = async (id) => {
    const body = editDraft.trim();
    if (!body) { setEditingId(null); return; }
    try {
      const row = await updateComment(id, body);
      setItems((prev) => prev.map((c) => (c.id === id ? { ...c, body: row.body, updated_at: row.updated_at } : c)));
      setEditingId(null);
    } catch (err) {
      toast.error(err.message || "No se pudo editar");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteComment(id);
      setItems((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      toast.error(err.message || "No se pudo eliminar");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-4 h-4 text-stone-400 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-stone-500 text-center py-2">
          Sin comentarios. Inicia la conversación con el equipo.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((c) => {
            const isMine = c.user_id === currentUserId;
            const isEditing = editingId === c.id;
            return (
              <li key={c.id} className="flex items-start gap-2">
                <Avatar name={c.display_name} url={c.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="text-xs font-semibold text-stone-900 truncate">
                        {c.display_name || c.user_id.slice(0, 6)}
                      </span>
                      <span className="text-[10px] text-stone-400">{fmtRelative(c.created_at)}</span>
                      {c.updated_at && c.updated_at !== c.created_at && (
                        <span className="text-[10px] text-stone-400 italic">editado</span>
                      )}
                    </div>
                    {isMine && !isEditing && (
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => { setEditingId(c.id); setEditDraft(c.body); }}
                          className="text-stone-400 hover:text-stone-700 p-0.5"
                          aria-label="Editar"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="text-stone-400 hover:text-rose-700 p-0.5"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="mt-1 flex flex-col gap-1">
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={2}
                        className="w-full bg-stone-50 border border-stone-200 rounded-md p-2 text-sm focus:bg-white focus:border-stone-900 focus:outline-none"
                        autoFocus
                      />
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs text-stone-500 hover:text-stone-900 px-2 py-1 inline-flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Cancelar
                        </button>
                        <button
                          onClick={() => handleEdit(c.id)}
                          className="text-xs text-stone-900 font-medium hover:bg-stone-100 rounded px-2 py-1 inline-flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-stone-700 whitespace-pre-wrap break-words mt-0.5">
                      {c.body}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleSend} className="flex flex-col gap-1.5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSend(e);
          }}
          placeholder="Escribe un comentario… (⌘ + Enter para enviar)"
          rows={2}
          className="w-full bg-stone-50 border border-stone-200 rounded-md p-2 text-sm focus:bg-white focus:border-stone-900 focus:outline-none resize-y"
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" loading={sending} disabled={!draft.trim()}>
            <Send className="w-3.5 h-3.5" />
            Enviar
          </Button>
        </div>
      </form>
    </div>
  );
}
