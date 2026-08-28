-- Abilita lettura e scrittura sulla tabella voti_mvp (finora senza alcuna policy)

CREATE POLICY "Consenti select pubblico"
ON public.voti_mvp
FOR SELECT
TO public
USING (true);

CREATE POLICY "Consenti insert pubblico"
ON public.voti_mvp
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Consenti update pubblico"
ON public.voti_mvp
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);
