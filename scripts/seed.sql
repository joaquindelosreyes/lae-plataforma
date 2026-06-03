-- Oficinas reales LAE HOMES 2026
INSERT INTO oficinas (nombre, objetivo_anual, obj_1t, obj_2t, obj_3t, obj_4t, objetivo_aaff) VALUES
  ('Alicante',      250000,  35000,  55000,  75000,  85000, 12),
  ('Barcelona',     250000,  50000,  50000,  60000,  90000,  8),
  ('Castellón',     125000,  18000,  35000,  27000,  45000,  6),
  ('Jaén',          134000,  22000,  32000,  35000,  45000,  6),
  ('Madrid',        300000,  75000,  70000,  70000,  85000, 10),
  ('Málaga',        250000,  35000,  80000,  60000,  75000, 15),
  ('Marbella',      375000,  85000,  90000,  90000, 110000,  8),
  ('San Sebastián', 375000,  80000, 110000,  75000, 110000,  6),
  ('Sevilla',       120000,  15000,  35000,  30000,  40000,  7),
  ('Valencia',      250000,  40000,  60000,  70000,  80000, 16)
ON CONFLICT DO NOTHING;

-- Directores de oficina (personas clave)
INSERT INTO consultores (nombre, oficina_id, activo) VALUES
  ('Jorge',    (SELECT id FROM oficinas WHERE nombre='Madrid'),        true),
  ('Yolanda',  (SELECT id FROM oficinas WHERE nombre='Marbella'),      true),
  ('Eduardo',  (SELECT id FROM oficinas WHERE nombre='San Sebastián'), true),
  ('Ana',      (SELECT id FROM oficinas WHERE nombre='Barcelona'),     true),
  ('Fernando', (SELECT id FROM oficinas WHERE nombre='Málaga'),        true),
  ('Miriam',   (SELECT id FROM oficinas WHERE nombre='Alicante'),      true),
  ('Marina',   (SELECT id FROM oficinas WHERE nombre='Jaén'),          true),
  ('Elena',    (SELECT id FROM oficinas WHERE nombre='Castellón'),     true),
  ('Joaquín',  (SELECT id FROM oficinas WHERE nombre='Valencia'),      true)
ON CONFLICT DO NOTHING;

-- Datos reales seguimiento 1T 2026
INSERT INTO seguimiento (oficina_id, año, trimestre, cobrado, generado, captaciones, cierres, aaff_activos)
SELECT o.id, 2026, 1, d.cobrado, d.generado, d.captaciones, d.cierres, d.aaff
FROM (VALUES
  ('Alicante',       71572,    43654, 24, 14,  4),
  ('Barcelona',      11790,     1340, 11,  3,  0),
  ('Castellón',      21082,    34145, 17,  8,  0),
  ('Jaén',            6600,    34600,  6,  1,  1),
  ('Madrid',        107885,    51221,  1,  2,  3),
  ('Málaga',         17085,    18950, 11,  4,  5),
  ('Marbella',       74900,    77060, 14,  6,  2),
  ('San Sebastián',  31030,   140740, 17, 48,  0),
  ('Sevilla',         3280,    15080,  7,  2,  2),
  ('Valencia',       11730,    75650,  6,  2,  7)
) AS d(nombre, cobrado, generado, captaciones, cierres, aaff)
JOIN oficinas o ON o.nombre = d.nombre
ON CONFLICT (oficina_id, año, trimestre) DO UPDATE
SET cobrado=EXCLUDED.cobrado, generado=EXCLUDED.generado,
    captaciones=EXCLUDED.captaciones, cierres=EXCLUDED.cierres, aaff_activos=EXCLUDED.aaff_activos;

-- Datos reales seguimiento 2T 2026
INSERT INTO seguimiento (oficina_id, año, trimestre, cobrado, generado, captaciones, cierres, aaff_activos)
SELECT o.id, 2026, 2, d.cobrado, d.generado, d.captaciones, d.cierres, d.aaff
FROM (VALUES
  ('Alicante',      15300,   7200,  8,  1,  6),
  ('Barcelona',      1400, 226260,  4,  1,  0),
  ('Castellón',     21050,    600,  2,  3,  1),
  ('Jaén',              0,      0,  1,  0,  3),
  ('Madrid',            0,      0,  0,  0,  5),
  ('Málaga',         2300,   2300,  4,  1,  6),
  ('Marbella',          0,      0,  1,  0,  5),
  ('San Sebastián', 38475,   3105,  3,  5,  0),
  ('Sevilla',           0,      0,  1,  0,  4),
  ('Valencia',       2650,   2650,  1,  2,  9)
) AS d(nombre, cobrado, generado, captaciones, cierres, aaff)
JOIN oficinas o ON o.nombre = d.nombre
ON CONFLICT (oficina_id, año, trimestre) DO UPDATE
SET cobrado=EXCLUDED.cobrado, generado=EXCLUDED.generado,
    captaciones=EXCLUDED.captaciones, cierres=EXCLUDED.cierres, aaff_activos=EXCLUDED.aaff_activos;
