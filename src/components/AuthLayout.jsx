import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";

export function AuthLayout({ children, hero }) {
  return (
    <div className="min-h-screen bg-stone-100 flex flex-col md:flex-row" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="inline-flex items-center gap-2 text-stone-900 mb-8">
            <Building2 className="w-5 h-5" strokeWidth={2} />
            <span className="text-xs font-semibold uppercase tracking-widest">AnalisisDev</span>
          </Link>
          {children}
        </div>
      </div>
      <div className="hidden md:flex flex-1 bg-gradient-to-br from-stone-200 via-stone-100 to-emerald-50 items-center justify-center p-12 border-l border-stone-200">
        <div className="max-w-md">
          {hero ?? (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-stone-500 font-medium mb-2">
                Análisis desarrollador inmobiliario
              </div>
              <h2 className="text-2xl font-semibold text-stone-900 tracking-tight mb-3">
                Modela proyectos, compara escenarios, invita a tu equipo.
              </h2>
              <p className="text-sm text-stone-600">
                Una plataforma para analizar inversión, utilidad y rendimiento de proyectos
                inmobiliarios con tu equipo.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
