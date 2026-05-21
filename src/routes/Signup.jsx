import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { GoogleButton } from "../components/GoogleButton";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { useAuth } from "../lib/AuthContext";

const schema = z
  .object({
    displayName: z.string().min(2, "Nombre muy corto"),
    email: z.string().email("Correo inválido"),
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/\d/, "Debe incluir al menos un número"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Las contraseñas no coinciden",
  });

export default function Signup() {
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState("");
  const [emailSentTo, setEmailSentTo] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (values) => {
    setSubmitError("");
    try {
      const result = await signUp(values);
      // Si confirmación de email está activada, no hay sesión todavía.
      if (!result.session) {
        setEmailSentTo(values.email);
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setSubmitError(err?.message || "No se pudo crear la cuenta");
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

  if (emailSentTo) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center gap-3 py-6">
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center">
            <Mail className="w-5 h-5 text-stone-700" strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-semibold text-stone-900">Revisa tu correo</h1>
          <p className="text-sm text-stone-600 max-w-xs">
            Te enviamos un link de confirmación a <strong>{emailSentTo}</strong>. Ábrelo para
            terminar de crear tu cuenta.
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
      <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Crear cuenta</h1>
      <p className="text-sm text-stone-600 mt-1">Empieza gratis. Sin tarjeta.</p>

      <div className="mt-6 flex flex-col gap-3">
        <GoogleButton onClick={onGoogle} loading={googleLoading} label="Continuar con Google" />
        <div className="flex items-center gap-2 my-1">
          <div className="flex-1 h-px bg-stone-200" />
          <span className="text-[10px] uppercase tracking-widest text-stone-400">o</span>
          <div className="flex-1 h-px bg-stone-200" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <Input
            label="Nombre"
            placeholder="Tu nombre"
            autoComplete="name"
            error={errors.displayName?.message}
            {...register("displayName")}
          />
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
            placeholder="Mínimo 8 caracteres, incluye un número"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <Input
            type="password"
            label="Confirmar contraseña"
            placeholder="••••••••"
            autoComplete="new-password"
            error={errors.confirm?.message}
            {...register("confirm")}
          />
          {submitError && <p className="text-xs text-rose-700">{submitError}</p>}
          <Button type="submit" loading={isSubmitting} className="mt-1">
            Crear cuenta
          </Button>
        </form>

        <p className="text-xs text-stone-600 mt-2 text-center">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="text-stone-900 font-medium hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
