-- RLS su storage.objects per il bucket CMS (creato in dashboard: cms-storage-mananero)
-- Prerequisito: tabella public.profiles + funzione public.has_role (migrazione gamestore_v1)

-- Lettura pubblica (siti anonimi possono caricare le immagini via URL pubblico del bucket)
DROP POLICY IF EXISTS "cms_storage_mananero_select_public" ON storage.objects;
CREATE POLICY "cms_storage_mananero_select_public"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'cms-storage-mananero');

-- Upload / aggiornamento / eliminazione solo staff e admin
DROP POLICY IF EXISTS "cms_storage_mananero_insert_staff" ON storage.objects;
CREATE POLICY "cms_storage_mananero_insert_staff"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cms-storage-mananero'
    AND public.has_role('staff'::public.app_role)
  );

DROP POLICY IF EXISTS "cms_storage_mananero_update_staff" ON storage.objects;
CREATE POLICY "cms_storage_mananero_update_staff"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cms-storage-mananero'
    AND public.has_role('staff'::public.app_role)
  )
  WITH CHECK (
    bucket_id = 'cms-storage-mananero'
    AND public.has_role('staff'::public.app_role)
  );

DROP POLICY IF EXISTS "cms_storage_mananero_delete_staff" ON storage.objects;
CREATE POLICY "cms_storage_mananero_delete_staff"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'cms-storage-mananero'
    AND public.has_role('staff'::public.app_role)
  );
