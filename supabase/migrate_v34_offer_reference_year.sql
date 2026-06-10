-- v34: anno di riferimento per le previsioni di fatturato
-- Aggiunge il campo reference_year alle offerte.
-- Se impostato, l'offerta viene conteggiata nell'anno indicato
-- invece dell'anno della deadline.
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS reference_year INTEGER;
