import React from 'react';
import { ArrowUpDown, Clock, Layers } from 'lucide-react';

export default function ControlsBar({ sortBy, setSortBy }) {
  return (
    <div className="flex items-center gap-2 mb-4 bg-neutral-900 p-2 rounded-lg border border-neutral-800 overflow-x-auto">
      <span className="text-sm text-neutral-400 ml-2 mr-2 whitespace-nowrap">Ordenar por:</span>
      <button
        onClick={() => setSortBy('date')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
          sortBy === 'date' ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
        }`}
      >
        <Clock className="w-4 h-4" /> Fecha
      </button>
      <button
        onClick={() => setSortBy('amount')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
          sortBy === 'amount' ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
        }`}
      >
        <ArrowUpDown className="w-4 h-4" /> Monto
      </button>
      <button
        onClick={() => setSortBy('concept')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
          sortBy === 'concept' ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
        }`}
      >
        <Layers className="w-4 h-4" /> Concepto
      </button>
    </div>
  );
}
