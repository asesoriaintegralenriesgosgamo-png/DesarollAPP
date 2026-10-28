import { ArrowUpDown, Clock, AlignLeft } from 'lucide-react';

export default function ControlsBar({ sortBy, setSortBy }) {
  const options = [
    { id: 'date', label: 'Fecha', icon: Clock },
    { id: 'amount', label: 'Monto', icon: ArrowUpDown },
    { id: 'concept', label: 'Nombre', icon: AlignLeft }
  ];

  return (
    <div className="grid grid-cols-3 gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
      {options.map(opt => {
        const Icon = opt.icon;
        const active = sortBy === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setSortBy(opt.id)}
            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors ${
              active
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/80'
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
