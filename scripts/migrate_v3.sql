-- Migración v3: vincular captaciones con aaff_despachos
ALTER TABLE captaciones ADD COLUMN IF NOT EXISTS aaff_id INTEGER REFERENCES aaff_despachos(id);
