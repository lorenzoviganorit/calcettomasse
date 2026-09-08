-- Corregge le date delle partite scivolate a domenica invece che lunedì
-- (bug di conversione UTC in "Chiudi partita", ora risolto nel codice).
-- Tocca solo le righe sbagliate: chi è già di lunedì resta invariato.

UPDATE partite
SET data_partita = data_partita + INTERVAL '1 day'
WHERE EXTRACT(DOW FROM data_partita) = 0; -- 0 = domenica
