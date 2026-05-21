import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../lib/AuthContext";

export default function AuthCallback() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    // ¿Hay invitación pendiente guardada antes de autenticar?
    const pendingInvite = sessionStorage.getItem("pending_invite_token");
    if (user && pendingInvite) {
      sessionStorage.removeItem("pending_invite_token");
      navigate(`/invite/${pendingInvite}`, { replace: true });
      return;
    }

    if (user) {
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100">
      <div className="flex items-center gap-2 text-stone-600 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Confirmando…
      </div>
    </div>
  );
}
