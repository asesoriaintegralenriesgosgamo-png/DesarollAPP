export function EmptyState({ icon: Icon, title, description, action = null }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 border-2 border-dashed border-stone-200 rounded-lg bg-stone-50">
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-white border border-stone-200 flex items-center justify-center mb-3">
          <Icon className="w-5 h-5 text-stone-500" strokeWidth={1.5} />
        </div>
      )}
      <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
      {description && (
        <p className="text-xs text-stone-600 mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
