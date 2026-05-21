import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Avatar } from "../components/ui/Avatar";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabase";

const profileSchema = z.object({
  displayName: z.string().min(2, "Nombre muy corto"),
});

const passwordSchema = z
  .object({
    password: z.string().min(8, "Mínimo 8 caracteres").regex(/\d/, "Debe incluir un número"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Las contraseñas no coinciden",
  });

export default function AccountPage() {
  const { user, profile, refreshProfile, updatePassword } = useAuth();
  const toast = useToast();
  const [profileName, setProfileName] = useState(profile?.display_name || "");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (profile?.display_name) setProfileName(profile.display_name);
  }, [profile]);

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    values: { displayName: profileName },
  });

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
  });

  const onSaveProfile = async ({ displayName }) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Perfil actualizado");
    } catch (err) {
      toast.error(err.message || "No se pudo actualizar");
    }
  };

  const onChangePassword = async ({ password }) => {
    try {
      await updatePassword(password);
      passwordForm.reset();
      toast.success("Contraseña actualizada");
    } catch (err) {
      toast.error(err.message || "No se pudo actualizar la contraseña");
    }
  };

  const breadcrumbs = [{ label: "Mi cuenta" }];
  const hasPassword = user?.identities?.some((i) => i.provider === "email");

  return (
    <AppShell breadcrumbs={breadcrumbs}>
      <h1 className="text-2xl md:text-3xl font-semibold text-stone-900 tracking-tight mb-6">
        Mi cuenta
      </h1>

      <section className="bg-white border border-stone-200 rounded-lg p-4 mb-6 max-w-xl">
        <div className="flex items-center gap-3 mb-4">
          <Avatar
            name={profile?.display_name}
            email={user.email}
            url={profile?.avatar_url}
            size="lg"
          />
          <div>
            <div className="text-sm font-semibold text-stone-900">
              {profile?.display_name || user.email}
            </div>
            <div className="text-xs text-stone-500">{user.email}</div>
          </div>
        </div>

        <form
          onSubmit={profileForm.handleSubmit(onSaveProfile)}
          className="flex flex-col gap-3"
        >
          <Input
            label="Nombre"
            error={profileForm.formState.errors.displayName?.message}
            {...profileForm.register("displayName")}
          />
          <div className="flex justify-end">
            <Button type="submit" loading={profileForm.formState.isSubmitting}>
              Guardar
            </Button>
          </div>
        </form>
      </section>

      {hasPassword && (
        <section className="bg-white border border-stone-200 rounded-lg p-4 max-w-xl">
          <h2 className="text-sm font-semibold text-stone-900 mb-3">Cambiar contraseña</h2>
          <form
            onSubmit={passwordForm.handleSubmit(onChangePassword)}
            className="flex flex-col gap-3"
          >
            <Input
              type="password"
              label="Nueva contraseña"
              autoComplete="new-password"
              error={passwordForm.formState.errors.password?.message}
              {...passwordForm.register("password")}
            />
            <Input
              type="password"
              label="Confirmar contraseña"
              autoComplete="new-password"
              error={passwordForm.formState.errors.confirm?.message}
              {...passwordForm.register("confirm")}
            />
            <div className="flex justify-end">
              <Button type="submit" loading={passwordForm.formState.isSubmitting}>
                Actualizar contraseña
              </Button>
            </div>
          </form>
        </section>
      )}
    </AppShell>
  );
}
