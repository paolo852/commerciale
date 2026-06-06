-- v29: allinea status=presentata per offerte con esito già impostato
-- Le offerte approvate/rifiutate devono avere status=presentata.
-- Imposta anche submitted_at se mancante (usa decided_at o deadline come fallback).
UPDATE offers
SET
  status      = 'presentata',
  submitted_at = COALESCE(submitted_at, decided_at, deadline)
WHERE outcome <> 'nessuno'
  AND status  = 'in_lavorazione';
