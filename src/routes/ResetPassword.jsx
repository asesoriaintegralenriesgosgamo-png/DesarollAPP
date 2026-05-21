import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthLayout } from "../components/AuthLayout";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { useAuth } from "../lib/AuthContext";

const schema = z
  .object({
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

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ password }) => {
    setSubmitError("");
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (err) {
      setSubmitError(err?.message || "No se pudo actualizar la contraseña");
    }
  };

  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Nueva contraseña</h1>
      <p className="text-sm text-stone-600 mt-1">Define una nueva contraseña para tu cuenta.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-3">
        <Input
          type="password"
          label="Nueva contraseña"
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
        {done && (
          <p className="text-xs text-emerald-700">
            Contraseña actualizada. Te redirigimos…
          </p>
        )}
        <Button type="submit" loading={isSubmitting} disabled={done} className="mt-1">
          Actualizar contraseña
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
