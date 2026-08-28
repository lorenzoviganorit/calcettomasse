-- Serve per poter chiudere la partita (aggiornare risultato/stato)
-- e per creare automaticamente la partita successiva.

CREATE POLICY "Consenti update pubblico"
ON public.partite
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Consenti insert pubblico"
ON public.partite
FOR INSERT
TO public
WITH CHECK (true);
