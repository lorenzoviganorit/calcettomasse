-- Numero di maglia per giocatore, univoco all'interno della stessa squadra
-- (due squadre diverse possono avere entrambe un giocatore col numero 7, ad esempio).

ALTER TABLE giocatori ADD COLUMN numero_maglia INTEGER;

CREATE UNIQUE INDEX idx_giocatori_numero_squadra
ON giocatori (id_squadra, numero_maglia)
WHERE numero_maglia IS NOT NULL;

-- Assegna un numero casuale (1..N) ai giocatori già censiti che non ce l'hanno ancora
WITH numerati AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY id_squadra ORDER BY random()) AS n
  FROM giocatori
  WHERE numero_maglia IS NULL
)
UPDATE giocatori g
SET numero_maglia = numerati.n
FROM numerati
WHERE g.id = numerati.id;
