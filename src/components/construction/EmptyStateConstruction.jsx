import { Hammer, Sparkles, Plus } from "lucide-react";
import { Button } from "../ui/Button";

export function EmptyStateConstruction({ canEdit, onSeed, onCreateEmpty }) {
  return (
    <div className="border border-dashed border-stone-300 rounded-lg p-8 md:p-12 bg-stone-50/60">
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-white border border-stone-200 flex items-center justify-center">
          <Hammer className="w-5 h-5 text-stone-700" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-stone-900">
            Comienza tu calendario de obra
          </h3>
          <p className="text-sm text-stone-600 mt-1.5 leading-relaxed">
            Crea las fases del proyecto y agrega tareas con fechas planeadas para hacer
            seguimiento del avance real vs lo planeado y coordinar al equipo.
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
            <Button onClick={onSeed}>
              <Sparkles className="w-3.5 h-3.5" />
              Empezar con plantilla
            </Button>
            <Button variant="ghost" onClick={onCreateEmpty}>
              <Plus className="w-3.5 h-3.5" />
              Crear desde cero
            </Button>
          </div>
        )}
        {canEdit && (
          <p className="text-[11px] text-stone-500 leading-relaxed mt-1">
            La plantilla siembra 7 fases típicas: Preliminares, Cimentación,
            Estructura, Albañilería, Instalaciones, Acabados y Entrega.
          </p>
        )}
      </div>
    </div>
  );
}
