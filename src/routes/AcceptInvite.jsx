import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui/Button";
import { RoleBadge } from "../components/ui/RoleBadge";
import { useAuth } from "../lib/AuthContext";
import { acceptInvitation, previewInvitation } from "../lib/api/invitations";

export default function AcceptInvite() {
  const { token } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    previewInvitation(token)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    setError("");
    try {
      const { project_id } = await acceptInvitation(token);
      setSuccess(true);
      setTimeout(() => navigate(`/projects/${project_id}`), 1200);
    } catch (err) {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("expired")) setError("Esta invitación ya expiró.");
      else if (msg.includes("already_accepted"))
        setError("Esta invitación ya fue aceptada.");
      else if (msg.includes("email_mismatch"))
        setError("La invitación es para un correo distinto al de tu cuenta.");
      else if (msg.includes("not_found"))
        setError("Esta invitación no existe o fue revocada.");
      else setError(err?.message || "No se pudo aceptar la invitación.");
      setAccepting(false);
    }
  };

  const goAuth = (path) => {
    sessionStorage.setItem("pending_invite_token", token);
    navigate(path);
  };

  if (loading || previewLoading) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
          <p className="text-xs text-stone-500">Cargando invitación…</p>
        </div>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center gap-3 py-6">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-semibold text-stone-900">¡Listo!</h1>
          <p className="text-sm text-stone-600">Te uniste al proyecto. Redirigiendo…</p>
        </div>
      </AuthLayout>
    );
  }

  const projectName = preview?.project?.name;
  const role = preview?.role;
  const expired = preview && new Date(preview.expires_at) < new Date();
  const alreadyAccepted = preview?.accepted_at;

  return (
    <AuthLayout>
      <div className="flex flex-col items-center text-center gap-3 py-2">
        <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center">
          <Mail className="w-5 h-5 text-stone-700" strokeWidth={1.5} />
        </div>
        <h1 className="text-xl font-semibold text-stone-900">Invitación a un proyecto</h1>
        {projectName ? (
          <p className="text-sm text-stone-600">
            Te invitaron a colaborar en <strong>{projectName}</strong>
            {role && (
              <>
                {" "}
                como <RoleBadge role={role} />
              </>
            )}
            .
          </p>
        ) : (
          <p className="text-sm text-stone-600">
            Para ver los detalles, inicia sesión o crea una cuenta.
          </p>
        )}

        {expired && (
          <p className="text-xs text-rose-700 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            Esta invitación expiró.
          </p>
        )}
        {alreadyAccepted && (
          <p className="text-xs text-rose-700 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            Esta invitación ya fue aceptada.
          </p>
        )}
        {error && (
          <p className="text-xs text-rose-700 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {user ? (
          <Button onClick={handleAccept} loading={accepting} disabled={expired || alreadyAccepted}>
            Aceptar invitación
          </Button>
        ) : (
          <>
            <Button onClick={() => goAuth("/login")}>Iniciar sesión para aceptar</Button>
            <Button variant="ghost" onClick={() => goAuth("/signup")}>
              Crear cuenta
            </Button>
          </>
        )}
        <Link
          to="/dashboard"
          className="text-xs text-stone-500 hover:text-stone-900 text-center mt-2"
        >
          Ir al dashboard
        </Link>
      </div>
    </AuthLayout>
  );
}
