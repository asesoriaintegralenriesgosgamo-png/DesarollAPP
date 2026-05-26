import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";

export function FileDropzone({
  onFiles,
  accept,
  multiple = true,
  maxSizeMB = 20,
  disabled = false,
  loading = false,
  hint,
  className = "",
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);

  const handleFiles = (fileList) => {
    setError(null);
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    const max = maxSizeMB * 1024 * 1024;
    const tooBig = files.find((f) => f.size > max);
    if (tooBig) {
      setError(`Archivo demasiado grande: ${tooBig.name} (máx ${maxSizeMB} MB)`);
      return;
    }
    onFiles?.(multiple ? files : [files[0]]);
  };

  return (
    <div className={className}>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`w-full flex flex-col items-center justify-center gap-1.5 px-4 py-6 border-2 border-dashed rounded-lg text-xs transition-colors ${
          disabled
            ? "border-stone-200 bg-stone-50 text-stone-400 cursor-not-allowed"
            : dragging
            ? "border-stone-900 bg-stone-50 text-stone-900"
            : "border-stone-300 bg-white text-stone-600 hover:border-stone-500 hover:bg-stone-50"
        }`}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
        ) : (
          <Upload className="w-5 h-5 text-stone-400" />
        )}
        <span className="font-medium text-stone-700">
          {loading ? "Subiendo…" : "Arrastra archivos o haz click"}
        </span>
        {hint && <span className="text-[11px] text-stone-500">{hint}</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && <p className="mt-1.5 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
