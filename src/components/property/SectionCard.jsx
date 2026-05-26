export function SectionCard({ title, icon: Icon, action, children }) {
  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-stone-100 bg-stone-50">
        {Icon && <Icon className="w-3.5 h-3.5 text-stone-700" strokeWidth={2} />}
        <h3 className="text-xs font-semibold text-stone-900 tracking-tight uppercase flex-1">
          {title}
        </h3>
        {action}
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}
