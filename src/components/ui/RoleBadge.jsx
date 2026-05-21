const STYLES = {
  owner: "bg-stone-900 text-white",
  editor: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  viewer: "bg-stone-100 text-stone-700 border border-stone-200",
};

const LABELS = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

export function RoleBadge({ role }) {
  if (!role) return null;
  return (
    <span
      className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${STYLES[role]}`}
    >
      {LABELS[role]}
    </span>
  );
}
