import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthLayout } from "../components/AuthLayout";
import { GoogleButton } from "../components/GoogleButton";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { useAuth } from "../lib/AuthContext";

const schema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(1, "Contraseña requerida"),
});

export default function Login() {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [submitError, setSubmitError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const redirect = params.get("redirect") || "/dashboard";

  const onSubmit = async (values) => {
    setSubmitError("");
    try {
      await signIn(values);
      navigate(decodeURIComponent(redirect));
    } catch (err) {
      setSubmitError(err?.message || "No se pudo iniciar sesión");
    }
  };

  const onGoogle = async () => {
    setGoogleLoading(true);
    setSubmitError("");
    try {
      await signInWithGoogle();
    } catch (err) {
      setSubmitError(err?.message || "Error con Google");
      setGoogleLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Iniciar sesión</h1>
      <p className="text-sm text-stone-600 mt-1">Entra a tus proyectos.</p>

      <div className="mt-6 flex flex-col gap-3">
        <GoogleButton onClick={onGoogle} loading={googleLoading} />
        <div className="flex items-center gap-2 my-1">
          <div className="flex-1 h-px bg-stone-200" />
          <span className="text-[10px] uppercase tracking-widest text-stone-400">o</span>
          <div className="flex-1 h-px bg-stone-200" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <Input
            type="email"
            label="Correo"
            placeholder="tu@correo.com"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            type="password"
            label="Contraseña"
            placeholder="••••••••"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />
          {submitError && <p className="text-xs text-rose-700">{submitError}</p>}
          <Button type="submit" loading={isSubmitting} className="mt-1">
            Iniciar sesión
          </Button>
        </form>

        <div className="flex justify-between mt-2 text-xs">
          <Link to="/forgot-password" className="text-stone-600 hover:text-stone-900">
            ¿Olvidaste tu contraseña?
          </Link>
          <Link to="/signup" className="text-stone-900 font-medium hover:underline">
            Crear cuenta
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
