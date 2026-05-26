import { useEffect, useState } from "react";
import { Building, Loader2, Plus } from "lucide-react";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../lib/AuthContext";
import {
  getPropertyByProject,
  createProperty,
  updateProperty,
  listOwners,
  listBoundaries,
  listDocuments,
} from "../../lib/api/properties";
import { PropertyForm } from "./PropertyForm";
import { OwnersList } from "./OwnersList";
import { BoundariesList } from "./BoundariesList";
import { DocumentsList } from "./DocumentsList";

export function PropertyTab({ projectId, canEdit }) {
  const { user } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [property, setProperty] = useState(null);
  const [owners, setOwners] = useState([]);
  const [boundaries, setBoundaries] = useState([]);
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    (async () => {
      try {
        const prop = await getPropertyByProject(projectId);
        if (cancelled) return;
        setProperty(prop);
        if (prop) {
          const [own, bnd, docs] = await Promise.all([
            listOwners(prop.id),
            listBoundaries(prop.id),
            listDocuments(prop.id),
          ]);
          if (cancelled) return;
          setOwners(own);
          setBoundaries(bnd);
          setDocuments(docs);
        } else {
          setOwners([]);
          setBoundaries([]);
          setDocuments([]);
        }
      } catch (err) {
        if (!cancelled) toast.error(err.message || "No se pudo cargar el predio");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, toast]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const row = await createProperty({ projectId, userId: user.id });
      setProperty(row);
      toast.success("Ficha del predio creada");
    } catch (err) {
      toast.error(err.message || "No se pudo crear la ficha");
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async (payload) => {
    if (!property) return;
    setSaving(true);
    try {
      const saved = await updateProperty(property.id, {
        ...payload,
        userId: user.id,
      });
      setProperty(saved);
      toast.success("Predio guardado");
    } catch (err) {
      toast.error(err.message || "No se pudo guardar");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
      </div>
    );
  }

  if (!property) {
    return (
      <EmptyState
        icon={Building}
        title="Sin ficha del predio"
        description="Registra los datos de la propiedad: ubicación, identificación catastral, propietarios, medidas, colindancias y documentos."
        action={
          canEdit && (
            <Button onClick={handleCreate} loading={creating}>
              <Plus className="w-4 h-4" />
              Registrar predio
            </Button>
          )
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PropertyForm
        initial={property}
        canEdit={canEdit}
        saving={saving}
        onSave={handleSave}
      />
      <OwnersList
        propertyId={property.id}
        projectId={projectId}
        owners={owners}
        canEdit={canEdit}
        onChange={setOwners}
      />
      <BoundariesList
        propertyId={property.id}
        projectId={projectId}
        boundaries={boundaries}
        canEdit={canEdit}
        onChange={setBoundaries}
      />
      <DocumentsList
        propertyId={property.id}
        projectId={projectId}
        userId={user.id}
        documents={documents}
        canEdit={canEdit}
        onChange={setDocuments}
      />
    </div>
  );
}
