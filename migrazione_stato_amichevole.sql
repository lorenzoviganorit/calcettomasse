-- Aggiunge "amichevole" e "annullata" tra gli stati possibili di una partita.
-- Le partite amichevoli e annullate restano fuori dalle statistiche: la query dello storico
-- filtra già solo stato IN (giocata, conclusa), quindi non serve altro nel codice.

ALTER TABLE partite DROP CONSTRAINT partite_stato_check;

ALTER TABLE partite ADD CONSTRAINT partite_stato_check
CHECK (stato IN ('aperta', 'chiusa', 'giocata', 'conclusa', 'amichevole', 'annullata'));
