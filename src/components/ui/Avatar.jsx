function initialsFor(nameOrEmail = "?") {
  const cleaned = nameOrEmail.trim();
  if (!cleaned) return "?";
  if (cleaned.includes("@")) return cleaned[0].toUpperCase();
  const parts = cleaned.split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

const SIZES = {
  xs: "w-5 h-5 text-[9px]",
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-xs",
  lg: "w-12 h-12 text-sm",
};

export function Avatar({ name, email, url, size = "md", className = "" }) {
  const label = name || email || "?";
  const initials = initialsFor(label);

  if (url) {
    return (
      <img
        src={url}
        alt={label}
        className={`${SIZES[size]} rounded-full object-cover bg-stone-200 ${className}`}
      />
    );
  }

  return (
    <div
      title={label}
      className={`${SIZES[size]} rounded-full bg-stone-200 text-stone-700 flex items-center justify-center font-semibold uppercase ${className}`}
    >
      {initials}
    </div>
  );
}

export function AvatarStack({ members = [], max = 3, size = "sm" }) {
  const visible = members.slice(0, max);
  const extra = Math.max(0, members.length - max);
  return (
    <div className="flex -space-x-1.5">
      {visible.map((m) => (
        <Avatar
          key={m.user_id || m.id || m.email}
          name={m.display_name}
          email={m.email}
          url={m.avatar_url}
          size={size}
          className="ring-2 ring-white"
        />
      ))}
      {extra > 0 && (
        <div
          className={`${
            size === "xs" ? "w-5 h-5 text-[9px]" : "w-6 h-6 text-[10px]"
          } rounded-full bg-stone-100 text-stone-600 flex items-center justify-center font-semibold ring-2 ring-white`}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}
