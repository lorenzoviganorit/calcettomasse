-- Rinomina le squadre mantenendo gli stessi ID: tutti i riferimenti esistenti
-- (giocatori, partite, prenotazioni) restano collegati correttamente.

UPDATE squadre SET nome = 'Real Madunin' WHERE nome = 'Zincadoria';
UPDATE squadre SET nome = 'Barcellotto' WHERE nome = 'QT8';
