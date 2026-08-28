-- Richieste di reset PIN: un giocatore che ha dimenticato il PIN ne chiede uno nuovo,
-- un admin lo vede come notifica e ne genera uno nuovo da inviare a mano (es. WhatsApp).

CREATE TABLE richieste_pin (
    id           SERIAL PRIMARY KEY,
    id_giocatore INTEGER NOT NULL REFERENCES giocatori(id),
    creato_il    TIMESTAMP NOT NULL DEFAULT NOW(),
    stato        VARCHAR(10) NOT NULL DEFAULT 'aperta' CHECK (stato IN ('aperta', 'gestita'))
);

ALTER TABLE richieste_pin ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consenti select pubblico" ON public.richieste_pin FOR SELECT TO public USING (true);
CREATE POLICY "Consenti insert pubblico" ON public.richieste_pin FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Consenti update pubblico" ON public.richieste_pin FOR UPDATE TO public USING (true) WITH CHECK (true);
