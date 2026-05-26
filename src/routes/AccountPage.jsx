import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Avatar } from "../components/ui/Avatar";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabase";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

const profileSchema = z.object({
  firstName: z.string().min(1, "Requerido").max(60, "Máximo 60 caracteres"),
  lastName: z.string().min(1, "Requerido").max(60, "Máximo 60 caracteres"),
  birthDate: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
      "Fecha inválida"
    ),
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
  const fileInputRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    values: {
      firstName: profile?.first_name || "",
      lastName: profile?.last_name || "",
      birthDate: profile?.birth_date || "",
    },
  });

  // Recargar valores cuando el profile entra/cambia (auth async).
  useEffect(() => {
    if (!profile) return;
    profileForm.reset({
      firstName: profile.first_name || "",
      lastName: profile.last_name || "",
      birthDate: profile.birth_date || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.first_name, profile?.last_name, profile?.birth_date]);

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
  });

  const watchedFirstName = useWatch({
    control: profileForm.control,
    name: "firstName",
  });
  const watchedLastName = useWatch({
    control: profileForm.control,
    name: "lastName",
  });
  const previewFirst = (watchedFirstName || "Nombre").trim();
  const previewInitial = watchedLastName?.trim()
    ? ` ${watchedLastName.trim()[0].toUpperCase()}.`
    : "";

  const onSaveProfile = async ({ firstName, lastName, birthDate }) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          birth_date: birthDate ? birthDate : null,
        })
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

  const onAvatarPick = () => {
    fileInputRef.current?.click();
  };

  const onAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error("Formato no soportado. Usa JPG, PNG o WEBP.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("La imagen debe pesar menos de 2 MB.");
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, {
          contentType: file.type,
          upsert: true,
          cacheControl: "3600",
        });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = data.publicUrl;
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);
      if (profileError) throw profileError;

      await refreshProfile();
      toast.success("Foto actualizada");
    } catch (err) {
      toast.error(err.message || "No se pudo subir la foto");
    } finally {
      setUploadingAvatar(false);
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
        <div className="flex items-center gap-4 mb-5">
          <div className="relative">
            <Avatar
              name={profile?.display_name}
              email={user.email}
              url={profile?.avatar_url}
              size="lg"
            />
            <button
              type="button"
              onClick={onAvatarPick}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-stone-900 text-white flex items-center justify-center hover:bg-stone-700 disabled:opacity-50"
              title="Cambiar foto"
              aria-label="Cambiar foto de perfil"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onAvatarChange}
            />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-stone-900 truncate">
              {profile?.display_name || user.email}
            </div>
            <div className="text-xs text-stone-500 truncate">{user.email}</div>
            {uploadingAvatar && (
              <div className="text-[11px] text-stone-500 mt-1">Subiendo foto…</div>
            )}
          </div>
        </div>

        <form
          onSubmit={profileForm.handleSubmit(onSaveProfile)}
          className="flex flex-col gap-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Nombre(s)"
              autoComplete="given-name"
              error={profileForm.formState.errors.firstName?.message}
              {...profileForm.register("firstName")}
            />
            <Input
              label="Apellido(s)"
              autoComplete="family-name"
              error={profileForm.formState.errors.lastName?.message}
              {...profileForm.register("lastName")}
            />
          </div>
          <Input
            type="date"
            label="Fecha de nacimiento"
            hint="Opcional"
            error={profileForm.formState.errors.birthDate?.message}
            {...profileForm.register("birthDate")}
          />
          <p className="text-[11px] text-stone-500">
            Al compartir proyectos los demás verán tu nombre como{" "}
            <span className="font-medium text-stone-700">
              &quot;{previewFirst}
              {previewInitial}&quot;
            </span>
          </p>
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
