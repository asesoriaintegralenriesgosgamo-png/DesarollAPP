import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { UserMenu } from "./UserMenu";

export function AppShell({ breadcrumbs = [], actions = null, children }) {
  return (
    <div className="min-h-screen bg-stone-100" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/dashboard" className="flex items-center gap-1.5 text-stone-900 shrink-0">
              <Building2 className="w-4 h-4" strokeWidth={2} />
              <span className="text-xs font-semibold uppercase tracking-widest">AnalisisDev</span>
            </Link>
            <div className="h-4 w-px bg-stone-300 mx-1 hidden sm:block" />
            <Link to="/expenses" className="text-sm font-medium text-stone-600 hover:text-stone-900 hidden sm:block">
              Gastos
            </Link>
            {breadcrumbs.length > 0 && (
              <nav aria-label="breadcrumb" className="flex items-center gap-1 min-w-0 text-xs text-stone-500 overflow-hidden">
                <span className="text-stone-300">/</span>
                {breadcrumbs.map((b, i) => (
                  <span key={i} className="flex items-center gap-1 min-w-0">
                    {b.to ? (
                      <Link to={b.to} className="hover:text-stone-900 truncate">
                        {b.label}
                      </Link>
                    ) : (
                      <span className="text-stone-900 font-medium truncate">{b.label}</span>
                    )}
                    {i < breadcrumbs.length - 1 && <span className="text-stone-300">/</span>}
                  </span>
                ))}
              </nav>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {actions}
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 md:p-8">{children}</main>
    </div>
  );
}
