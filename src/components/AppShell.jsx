import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { UserMenu } from "./UserMenu";

export function AppShell({ breadcrumbs = [], actions = null, darkFullWidth = false, children }) {
  return (
    <div
      className={darkFullWidth ? "min-h-dvh bg-neutral-950 text-white" : "min-h-screen bg-stone-100"}
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <header
        className={
          darkFullWidth
            ? "sticky top-0 z-30 bg-neutral-950/95 backdrop-blur border-b border-neutral-800"
            : "sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-stone-200"
        }
      >
        <div
          className={`w-full mx-auto h-11 flex items-center justify-between gap-3 ${
            darkFullWidth ? "px-3 sm:px-5" : "px-4 md:px-8 h-12"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/dashboard"
              className={`flex items-center gap-1.5 shrink-0 ${
                darkFullWidth ? "text-white hover:text-blue-400" : "text-stone-900"
              }`}
            >
              <Building2 className="w-4 h-4" strokeWidth={2} />
              <span className="text-xs font-semibold uppercase tracking-widest">AnalisisDev</span>
            </Link>
            <div className={`h-4 w-px mx-1 hidden sm:block ${darkFullWidth ? "bg-neutral-800" : "bg-stone-300"}`} />
            <Link
              to="/expenses"
              className={`text-sm font-medium hidden sm:block ${
                darkFullWidth ? "text-neutral-300 hover:text-white" : "text-stone-600 hover:text-stone-900"
              }`}
            >
              Gastos
            </Link>
            {breadcrumbs.length > 0 && (
              <nav
                aria-label="breadcrumb"
                className={`flex items-center gap-1 min-w-0 text-xs overflow-hidden ${
                  darkFullWidth ? "text-neutral-400" : "text-stone-500"
                }`}
              >
                <span className={darkFullWidth ? "text-neutral-700" : "text-stone-300"}>/</span>
                {breadcrumbs.map((b, i) => (
                  <span key={i} className="flex items-center gap-1 min-w-0">
                    {b.to ? (
                      <Link
                        to={b.to}
                        className={`truncate ${darkFullWidth ? "hover:text-white" : "hover:text-stone-900"}`}
                      >
                        {b.label}
                      </Link>
                    ) : (
                      <span className={`font-medium truncate ${darkFullWidth ? "text-white" : "text-stone-900"}`}>
                        {b.label}
                      </span>
                    )}
                    {i < breadcrumbs.length - 1 && (
                      <span className={darkFullWidth ? "text-neutral-700" : "text-stone-300"}>/</span>
                    )}
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
      <main className={darkFullWidth ? "w-full px-2.5 sm:px-5 py-3" : "w-full mx-auto p-4 md:p-8"}>
        {children}
      </main>
    </div>
  );
}
