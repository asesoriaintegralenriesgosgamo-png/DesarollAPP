import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { Avatar } from "./ui/Avatar";

export function UserMenu() {
  const { user, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  if (!user) return null;
  const label = profile?.display_name || user.email;

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm text-stone-700 hover:text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 rounded p-1"
      >
        <Avatar name={profile?.display_name} email={user.email} url={profile?.avatar_url} size="sm" />
        <span className="hidden sm:block max-w-[140px] truncate text-xs">{label}</span>
        <ChevronDown className="w-3.5 h-3.5 text-stone-500" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-white border border-stone-200 rounded-md shadow-lg py-1 z-40">
          <div className="px-3 py-2 border-b border-stone-100">
            <div className="text-xs font-semibold text-stone-900 truncate">{label}</div>
            <div className="text-[10px] text-stone-500 truncate">{user.email}</div>
          </div>
          <Link
            to="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-stone-700 hover:bg-stone-50"
          >
            <User className="w-3.5 h-3.5" /> Mi cuenta
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-stone-700 hover:bg-stone-50"
          >
            <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
