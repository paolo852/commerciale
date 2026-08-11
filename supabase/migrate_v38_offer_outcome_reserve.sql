-- v38: aggiunge il valore 'riserva' (reserve list) all'enum offer_outcome
-- Rappresenta un'offerta valutata ma non direttamente approvata, in attesa
-- che si liberino fondi. È un esito deciso ma non ancora confermato.
ALTER TYPE offer_outcome ADD VALUE IF NOT EXISTS 'riserva';
