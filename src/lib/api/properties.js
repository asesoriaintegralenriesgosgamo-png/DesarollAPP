import { supabase } from "../supabase";

const BUCKET = "property-documents";

const PROPERTY_COLUMNS = `
  id, project_id,
  calle, numero_exterior, numero_interior, colonia, codigo_postal,
  municipio, estado, pais, entre_calles, referencias,
  ubicacion_url, latitud, longitud, plus_code,
  clave_catastral, cuenta_predial, numero_oficial,
  alineamiento_folio, alineamiento_fecha,
  folio_real, numero_predio,
  escritura_numero, escritura_fecha, escritura_notario_nombre,
  escritura_notario_numero, escritura_libro, escritura_volumen,
  rpp_inscripcion, rpp_fecha,
  superficie_terreno_m2, superficie_construccion_m2,
  frente_m, fondo_m, forma_terreno, topografia,
  uso_suelo, zonificacion, altura_maxima_m, niveles_maximos,
  cos, cus, densidad, restricciones,
  servicio_agua, servicio_drenaje, servicio_electricidad, servicio_gas_natural,
  servicio_alumbrado, pavimentacion, banquetas, vigilancia,
  cuenta_agua, cuenta_cfe, cuenta_gas,
  precio_adquisicion, moneda, fecha_adquisicion,
  gravamenes, adeudos_predial, adeudos_agua, litigios,
  notas,
  created_by, updated_by, created_at, updated_at
`;

// ---------- properties (1:1 con project) -----------------------------------

export async function getPropertyByProject(projectId) {
  const { data, error } = await supabase
    .from("properties")
    .select(PROPERTY_COLUMNS)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createProperty({ projectId, userId, ...fields }) {
  const payload = sanitizePropertyFields(fields);
  const { data, error } = await supabase
    .from("properties")
    .insert({
      project_id: projectId,
      created_by: userId,
      updated_by: userId,
      ...payload,
    })
    .select(PROPERTY_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProperty(id, { userId, ...fields }) {
  const payload = sanitizePropertyFields(fields);
  const { data, error } = await supabase
    .from("properties")
    .update({ ...payload, updated_by: userId ?? null })
    .eq("id", id)
    .select(PROPERTY_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProperty(id) {
  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) throw error;
}

// Convierte strings vacíos a null para columnas opcionales (Postgres rechaza
// "" en columnas numeric/date).
function sanitizePropertyFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === "" || v === undefined) {
      out[k] = null;
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ---------- property_owners -------------------------------------------------

const OWNER_COLUMNS = `
  id, property_id, project_id, nombre, tipo_persona,
  rfc, curp, identificacion_tipo, identificacion_numero,
  porcentaje, email, telefono, domicilio_fiscal, notas,
  position, created_at, updated_at
`;

export async function listOwners(propertyId) {
  const { data, error } = await supabase
    .from("property_owners")
    .select(OWNER_COLUMNS)
    .eq("property_id", propertyId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createOwner({ propertyId, projectId, ...fields }) {
  const payload = sanitizePropertyFields(fields);
  const { data, error } = await supabase
    .from("property_owners")
    .insert({ property_id: propertyId, project_id: projectId, ...payload })
    .select(OWNER_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function updateOwner(id, fields) {
  const payload = sanitizePropertyFields(fields);
  const { data, error } = await supabase
    .from("property_owners")
    .update(payload)
    .eq("id", id)
    .select(OWNER_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteOwner(id) {
  const { error } = await supabase.from("property_owners").delete().eq("id", id);
  if (error) throw error;
}

// ---------- property_boundaries ---------------------------------------------

const BOUNDARY_COLUMNS = `
  id, property_id, project_id, direccion, medida_m,
  tipo_vecino, descripcion, position, created_at, updated_at
`;

export async function listBoundaries(propertyId) {
  const { data, error } = await supabase
    .from("property_boundaries")
    .select(BOUNDARY_COLUMNS)
    .eq("property_id", propertyId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createBoundary({ propertyId, projectId, ...fields }) {
  const payload = sanitizePropertyFields(fields);
  const { data, error } = await supabase
    .from("property_boundaries")
    .insert({ property_id: propertyId, project_id: projectId, ...payload })
    .select(BOUNDARY_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function updateBoundary(id, fields) {
  const payload = sanitizePropertyFields(fields);
  const { data, error } = await supabase
    .from("property_boundaries")
    .update(payload)
    .eq("id", id)
    .select(BOUNDARY_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBoundary(id) {
  const { error } = await supabase.from("property_boundaries").delete().eq("id", id);
  if (error) throw error;
}

// ---------- property_documents ----------------------------------------------

const DOCUMENT_COLUMNS = `
  id, property_id, project_id, uploaded_by, storage_path,
  file_name, content_type, size_bytes, categoria, descripcion, created_at
`;

export async function listDocuments(propertyId) {
  const { data, error } = await supabase
    .from("property_documents")
    .select(DOCUMENT_COLUMNS)
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function uploadDocument({
  projectId,
  propertyId,
  file,
  userId,
  categoria = "otro",
  descripcion = null,
}) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${projectId}/${propertyId}/${Date.now()}-${safeName}`;

  const { error: upError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upError) throw upError;

  const { data, error } = await supabase
    .from("property_documents")
    .insert({
      property_id: propertyId,
      project_id: projectId,
      uploaded_by: userId,
      storage_path: path,
      file_name: file.name,
      content_type: file.type || null,
      size_bytes: file.size,
      categoria,
      descripcion,
    })
    .select(DOCUMENT_COLUMNS)
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw error;
  }
  return data;
}

export async function getDocumentSignedUrl(storagePath, expiresInSeconds = 60) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteDocument({ id, storagePath }) {
  const { error: dbError } = await supabase
    .from("property_documents")
    .delete()
    .eq("id", id);
  if (dbError) throw dbError;
  await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
}
