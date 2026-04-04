/** Bucket Storage per asset CMS (allineato a Supabase Dashboard). */
export const CMS_STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_CMS_STORAGE_BUCKET ?? "cms-storage-mananero";

const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";

/**
 * URL pubblico per un oggetto nel bucket CMS.
 * Richiede bucket impostato come "public" in Supabase Storage.
 */
export function cmsStoragePublicUrl(objectPath: string): string | null {
  const path = objectPath.replace(/^\/+/, "");
  if (!base || !path) return null;
  return `${base}/storage/v1/object/public/${CMS_STORAGE_BUCKET}/${path}`;
}
