CREATE TABLE IF NOT EXISTS oficinas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  objetivo_anual INTEGER NOT NULL DEFAULT 0,
  obj_1t INTEGER DEFAULT 0,
  obj_2t INTEGER DEFAULT 0,
  obj_3t INTEGER DEFAULT 0,
  obj_4t INTEGER DEFAULT 0,
  objetivo_aaff INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seguimiento (
  id SERIAL PRIMARY KEY,
  oficina_id INTEGER REFERENCES oficinas(id),
  año INTEGER NOT NULL,
  trimestre INTEGER NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
  cobrado NUMERIC(12,2) DEFAULT 0,
  generado NUMERIC(12,2) DEFAULT 0,
  captaciones INTEGER DEFAULT 0,
  cierres INTEGER DEFAULT 0,
  aaff_activos INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(oficina_id, año, trimestre)
);
