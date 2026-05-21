import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { useAuth } from "../lib/AuthContext";

const schema = z.object({ email: z.string().email("Correo inválido") });

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [sent, setSent] = useState("");
  const [submitError, setSubmitError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }) => {
    setSubmitError("");
    try {
      await resetPassword(email);
      setSent(email);
    } catch (err) {
      setSubmitError(err?.message || "No se pudo enviar el correo");
    }
  };

  if (sent) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center gap-3 py-6">
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center">
            <Mail className="w-5 h-5 text-stone-700" strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-semibold text-stone-900">Revisa tu correo</h1>
          <p className="text-sm text-stone-600 max-w-xs">
            Si <strong>{sent}</strong> tiene una cuenta, te enviamos un link para crear una nueva
            contraseña.
          </p>
          <Link to="/login" className="text-xs text-stone-700 hover:text-stone-900 mt-2">
            Volver a iniciar sesión
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Olvidé mi contraseña</h1>
      <p className="text-sm text-stone-600 mt-1">
        Te enviaremos un link para crear una nueva contraseña.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-3">
        <Input
          type="email"
          label="Correo"
          placeholder="tu@correo.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        {submitError && <p className="text-xs text-rose-700">{submitError}</p>}
        <Button type="submit" loading={isSubmitting} className="mt-1">
          Enviar link
        </Button>
      </form>
      <div className="mt-4 text-xs">
        <Link to="/login" className="text-stone-600 hover:text-stone-900">
          ← Volver
        </Link>
      </div>
    </AuthLayout>
  );
}
