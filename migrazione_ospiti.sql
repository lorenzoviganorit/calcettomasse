-- Permette prenotazioni "ospite": una presenza senza un vero account in giocatori.
-- Una riga di giocatori_partite ora rappresenta O un giocatore censito (id_giocatore)
-- O un ospite occasionale (nome_ospite), mai entrambi o nessuno dei due.

ALTER TABLE giocatori_partite ALTER COLUMN id_giocatore DROP NOT NULL;
ALTER TABLE giocatori_partite ADD COLUMN nome_ospite VARCHAR(100);

ALTER TABLE giocatori_partite ADD CONSTRAINT chk_identita_prenotazione CHECK (
  (id_giocatore IS NOT NULL AND nome_ospite IS NULL) OR
  (id_giocatore IS NULL AND nome_ospite IS NOT NULL)
);

-- Serve anche per poter cancellare del tutto le righe ospite (invece di annullarle soltanto)
CREATE POLICY "Consenti delete pubblico"
ON public.giocatori_partite
FOR DELETE
TO public
USING (true);
