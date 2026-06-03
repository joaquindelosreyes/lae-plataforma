-- Migración v2: añadir updated_at a captaciones si no existe
ALTER TABLE captaciones ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Ampliar ref en operaciones por si acaso
ALTER TABLE operaciones ALTER COLUMN ref TYPE VARCHAR(50);
ALTER TABLE captaciones ALTER COLUMN ref TYPE VARCHAR(50);
