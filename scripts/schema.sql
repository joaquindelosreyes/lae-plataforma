-- LAE HOMES — Schema completo v2
-- Ejecutar: psql $DATABASE_URL -f scripts/schema.sql

-- Oficinas
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

-- Consultores
CREATE TABLE IF NOT EXISTS consultores (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  oficina_id INTEGER REFERENCES oficinas(id),
  email VARCHAR(150),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Operaciones (ingresos inmobiliarios)
CREATE TABLE IF NOT EXISTS operaciones (
  id SERIAL PRIMARY KEY,
  ref VARCHAR(30) UNIQUE,
  fecha DATE NOT NULL,
  tipo_ingreso VARCHAR(20) NOT NULL DEFAULT 'inmobiliaria', -- inmobiliaria | atipico
  tipo_operacion VARCHAR(20),                               -- cv | alquiler | traspaso | alq_opcion_compra
  tipo_atipico VARCHAR(50),                                 -- asesoria | valoracion | otro

  oficina_id INTEGER REFERENCES oficinas(id),
  direccion TEXT,
  municipio VARCHAR(100),

  -- Intervinientes
  consultor_captador_id INTEGER REFERENCES consultores(id),
  pct_captador NUMERIC(5,2) DEFAULT 0,
  consultor_vendedor_id INTEGER REFERENCES consultores(id),
  pct_vendedor NUMERIC(5,2) DEFAULT 0,

  -- Económicos
  precio_inmueble NUMERIC(14,2) DEFAULT 0,
  pct_comision NUMERIC(5,2) DEFAULT 5,
  comision_bruta NUMERIC(12,2) DEFAULT 0,
  honorarios_lae NUMERIC(12,2) DEFAULT 0,    -- neto después split

  -- Canal
  canal VARCHAR(30) DEFAULT 'directa',       -- directa | aaff | prescriptor | compartida
  compartida BOOLEAN DEFAULT FALSE,
  agencia_externa VARCHAR(150),
  split_pct NUMERIC(5,2) DEFAULT 50,

  -- AAFF / Prescriptor
  aaff_id INTEGER,
  pct_aaff NUMERIC(5,2) DEFAULT 0,
  importe_aaff NUMERIC(12,2) DEFAULT 0,

  -- Estado
  estado VARCHAR(30) DEFAULT 'pipeline',     -- pipeline | pendiente_escritura | cobrada | cancelada
  fecha_cobro DATE,

  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Captaciones
CREATE TABLE IF NOT EXISTS captaciones (
  id SERIAL PRIMARY KEY,
  ref VARCHAR(30) UNIQUE,
  fecha_captacion DATE NOT NULL,
  direccion TEXT,
  municipio VARCHAR(100),
  provincia VARCHAR(100),

  oficina_id INTEGER REFERENCES oficinas(id),
  consultor_id INTEGER REFERENCES consultores(id),

  mandato VARCHAR(20) DEFAULT 'exclusiva',   -- exclusiva | nota_encargo
  tipologia VARCHAR(30) DEFAULT 'vivienda',  -- vivienda | solar | local | garaje | trastero | oficina | nave | finca | obra_nueva
  tipo_operacion VARCHAR(10) DEFAULT 'cv',   -- cv | alquiler

  precio_captacion NUMERIC(14,2) DEFAULT 0,
  pct_honorarios NUMERIC(5,2) DEFAULT 5,
  honorarios_potenciales NUMERIC(12,2) DEFAULT 0,

  superficie NUMERIC(8,2),
  estado_inmueble VARCHAR(50),
  canal_captacion VARCHAR(30),

  duracion_mandato INTEGER DEFAULT 6,        -- meses
  fecha_vencimiento DATE,

  estado VARCHAR(20) DEFAULT 'activa',       -- activa | vendida | retirada | bloqueada
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gastos
CREATE TABLE IF NOT EXISTS gastos (
  id SERIAL PRIMARY KEY,
  concepto VARCHAR(200) NOT NULL,
  categoria VARCHAR(50),
  fecha DATE NOT NULL,
  periodicidad VARCHAR(20) DEFAULT 'puntual', -- puntual | mensual | trimestral | anual
  base_imponible NUMERIC(12,2) DEFAULT 0,
  tipo_impuesto_desc VARCHAR(20) DEFAULT 'IVA 21%',
  pct_impuesto NUMERIC(5,2) DEFAULT 21,
  total NUMERIC(12,2) DEFAULT 0,
  fecha_vencimiento_contrato DATE,
  alerta_renovacion BOOLEAN DEFAULT FALSE,
  nota TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gastos_oficinas (
  gasto_id INTEGER REFERENCES gastos(id) ON DELETE CASCADE,
  oficina_id INTEGER REFERENCES oficinas(id),
  PRIMARY KEY (gasto_id, oficina_id)
);

-- AAFF Despachos
CREATE TABLE IF NOT EXISTS aaff_despachos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  oficina_id INTEGER REFERENCES oficinas(id),
  consultor_responsable_id INTEGER REFERENCES consultores(id),
  estado VARCHAR(20) DEFAULT 'activo',       -- activo | reactivar | rescindir
  pct_comision NUMERIC(5,2) DEFAULT 10,
  fecha_alta DATE,
  ultima_actividad DATE,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reuniones y compromisos
CREATE TABLE IF NOT EXISTS reuniones (
  id SERIAL PRIMARY KEY,
  oficina_id INTEGER REFERENCES oficinas(id),
  fecha DATE NOT NULL,
  tipo VARCHAR(20) DEFAULT 'periodica',      -- periodica | extraordinaria | urgente
  titulo VARCHAR(200),
  conclusiones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compromisos (
  id SERIAL PRIMARY KEY,
  reunion_id INTEGER REFERENCES reuniones(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  responsable VARCHAR(100),
  plazo DATE,
  completado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seguimiento trimestral (para dashboard)
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_operaciones_fecha ON operaciones(fecha);
CREATE INDEX IF NOT EXISTS idx_operaciones_oficina ON operaciones(oficina_id);
CREATE INDEX IF NOT EXISTS idx_operaciones_estado ON operaciones(estado);
CREATE INDEX IF NOT EXISTS idx_captaciones_oficina ON captaciones(oficina_id);
CREATE INDEX IF NOT EXISTS idx_captaciones_mandato ON captaciones(mandato);
