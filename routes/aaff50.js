const router = require('express').Router();
const pool = require('../db/pool');

// Migración idempotente + índices para rendimiento
pool.query(`
  ALTER TABLE captaciones ADD COLUMN IF NOT EXISTS aaff_id INTEGER REFERENCES aaff_despachos(id);
  CREATE INDEX IF NOT EXISTS idx_captaciones_aaff_id ON captaciones(aaff_id);
  CREATE INDEX IF NOT EXISTS idx_operaciones_aaff_id  ON operaciones(aaff_id);
  CREATE INDEX IF NOT EXISTS idx_aaff_com_aaff_id     ON aaff_comunicaciones(aaff_id);
`).catch(() => {});

// ── GET /api/aaff50 ──────────────────────────────────
// Un solo JOIN con sub-agregaciones → sin N+1
router.get('/', async (req, res) => {
  try {
    const { oficina_id, responsable_id } = req.query;
    const params = [];
    let extra = '';
    if (oficina_id)     { params.push(oficina_id);     extra += ` AND d.oficina_id = $${params.length}`; }
    if (responsable_id) { params.push(responsable_id); extra += ` AND d.consultor_responsable_id = $${params.length}`; }

    const { rows } = await pool.query(`
      SELECT
        d.*,
        o.nombre    AS oficina_nombre,
        cons.nombre AS responsable_nombre,
        -- Comunicaciones (pre-agregado)
        COALESCE(com.total_coms, 0)           AS total_comunicaciones,
        com.ultima_fecha                       AS ultima_comunicacion,
        COALESCE(com.sum_recibido, 0)          AS total_vecinos_recibido,
        COALESCE(com.sum_interes,  0)          AS total_vecinos_interes,
        CASE WHEN COALESCE(com.sum_recibido, 0) > 0
          THEN ROUND(com.sum_interes * 100.0 / com.sum_recibido, 1)
          ELSE 0 END                           AS tasa_interes,
        EXTRACT(DAY FROM NOW() - com.ultima_fecha)::int AS dias_ultimo_contacto,
        -- Captaciones Inmovilla (pre-agregado)
        COALESCE(cap.captaciones_inmovilla, 0) AS captaciones_inmovilla,
        -- Operaciones Inmovilla (pre-agregado)
        COALESCE(op.cierres_inmovilla, 0)      AS cierres_inmovilla,
        COALESCE(op.generado, 0)               AS generado,
        COALESCE(op.cobrado,  0)               AS cobrado,
        COALESCE(op.comision_aaff, 0)          AS comision_aaff
      FROM aaff_despachos d
      LEFT JOIN oficinas    o    ON o.id    = d.oficina_id
      LEFT JOIN consultores cons ON cons.id = d.consultor_responsable_id
      -- Comunicaciones: una fila por despacho
      LEFT JOIN (
        SELECT aaff_id,
          COUNT(*)         AS total_coms,
          MAX(fecha)       AS ultima_fecha,
          SUM(vecinos_recibido) AS sum_recibido,
          SUM(vecinos_interes)  AS sum_interes
        FROM aaff_comunicaciones
        GROUP BY aaff_id
      ) com ON com.aaff_id = d.id
      -- Captaciones Inmovilla: una fila por despacho
      LEFT JOIN (
        SELECT aaff_id, COUNT(*) AS captaciones_inmovilla
        FROM captaciones
        WHERE aaff_id IS NOT NULL
        GROUP BY aaff_id
      ) cap ON cap.aaff_id = d.id
      -- Operaciones: una fila por despacho
      LEFT JOIN (
        SELECT aaff_id,
          COUNT(*) FILTER (WHERE estado = 'cobrada')                    AS cierres_inmovilla,
          COALESCE(SUM(honorarios_lae) FILTER (WHERE estado IN ('pipeline','cobrada')), 0) AS generado,
          COALESCE(SUM(honorarios_lae) FILTER (WHERE estado = 'cobrada'), 0)               AS cobrado,
          COALESCE(SUM(importe_aaff), 0)                                AS comision_aaff
        FROM operaciones
        WHERE aaff_id IS NOT NULL
        GROUP BY aaff_id
      ) op ON op.aaff_id = d.id
      WHERE d.modalidad = '50-50'${extra}
      ORDER BY d.ciudad, d.nombre
    `, params);

    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── GET /api/aaff50/resumen ──────────────────────────
router.get('/resumen', async (req, res) => {
  try {
    const [{ rows: r1 }, { rows: r2 }] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)                                    AS total_despachos,
          COUNT(*) FILTER (WHERE estado='activo')     AS activos,
          SUM(comunidades_totales)                    AS total_comunidades,
          SUM(administrados)                          AS total_administrados,
          SUM(comunidades_compartidas)                AS comunidades_compartidas,
          SUM(vecinos_compartidos)                    AS vecinos_compartidos,
          COUNT(*) FILTER (WHERE plan_mkt = true)     AS con_plan_mkt
        FROM aaff_despachos WHERE modalidad = '50-50'
      `),
      pool.query(`
        SELECT
          COUNT(*)                         AS total_comunicaciones,
          SUM(c.vecinos_recibido)          AS vecinos_impactados,
          SUM(c.vecinos_interes)           AS vecinos_interes,
          ROUND(SUM(c.vecinos_interes)*100.0/NULLIF(SUM(c.vecinos_recibido),0),1) AS tasa_interes,
          (SELECT COUNT(*) FROM captaciones WHERE aaff_id IN
            (SELECT id FROM aaff_despachos WHERE modalidad='50-50'))   AS captaciones_totales,
          (SELECT COUNT(*) FROM operaciones WHERE aaff_id IN
            (SELECT id FROM aaff_despachos WHERE modalidad='50-50') AND estado='cobrada') AS ventas_totales
        FROM aaff_comunicaciones c
        JOIN aaff_despachos d ON d.id = c.aaff_id AND d.modalidad = '50-50'
      `),
    ]);
    res.json({ success: true, data: { ...r1[0], ...r2[0] } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── GET /api/aaff50/:id/comunicaciones ───────────────
router.get('/:id/comunicaciones', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM aaff_comunicaciones WHERE aaff_id=$1 ORDER BY fecha DESC',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── GET /api/aaff50/stats/medios ─────────────────────
router.get('/stats/medios', async (req, res) => {
  try {
    const mediosEstandar = ['EMAIL', 'WHATSAPP', 'CORREO FÍSICO', 'LLAMADA'];
    const { rows } = await pool.query(`
      SELECT
        CASE WHEN medio = ANY($1) THEN medio ELSE 'Otros' END AS medio,
        COUNT(*)              AS total,
        SUM(vecinos_recibido) AS recibidos,
        SUM(vecinos_interes)  AS interes,
        ROUND(SUM(vecinos_interes)*100.0/NULLIF(SUM(vecinos_recibido),0),1) AS tasa
      FROM aaff_comunicaciones
      WHERE medio IS NOT NULL AND medio != ''
      GROUP BY CASE WHEN medio = ANY($1) THEN medio ELSE 'Otros' END
      ORDER BY total DESC
    `, [mediosEstandar]);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── GET /api/aaff50/stats/oficinas ───────────────────
router.get('/stats/oficinas', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        o.nombre,
        COUNT(d.id)                    AS despachos,
        SUM(d.comunidades_compartidas) AS comunidades,
        SUM(d.vecinos_compartidos)     AS vecinos,
        COALESCE(SUM(cap.cnt), 0)      AS captaciones,
        COALESCE(SUM(op.cnt),  0)      AS ventas
      FROM aaff_despachos d
      LEFT JOIN oficinas o ON o.id = d.oficina_id
      LEFT JOIN (
        SELECT aaff_id, COUNT(*) AS cnt FROM captaciones WHERE aaff_id IS NOT NULL GROUP BY aaff_id
      ) cap ON cap.aaff_id = d.id
      LEFT JOIN (
        SELECT aaff_id, COUNT(*) AS cnt FROM operaciones WHERE aaff_id IS NOT NULL AND estado='cobrada' GROUP BY aaff_id
      ) op ON op.aaff_id = d.id
      WHERE d.modalidad = '50-50'
      GROUP BY o.id, o.nombre
      ORDER BY despachos DESC
    `);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── GET /api/aaff50/filtros ──────────────────────────
router.get('/filtros', async (req, res) => {
  try {
    const [{ rows: ofs }, { rows: resps }] = await Promise.all([
      pool.query(`
        SELECT DISTINCT o.id, o.nombre FROM oficinas o
        JOIN aaff_despachos d ON d.oficina_id = o.id AND d.modalidad='50-50'
        ORDER BY o.nombre
      `),
      pool.query(`
        SELECT DISTINCT c.id, c.nombre FROM consultores c
        JOIN aaff_despachos d ON d.consultor_responsable_id = c.id AND d.modalidad='50-50'
        ORDER BY c.nombre
      `),
    ]);
    res.json({ success: true, data: { oficinas: ofs, responsables: resps } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── POST /api/aaff50/:id/comunicaciones ──────────────
router.post('/:id/comunicaciones', async (req, res) => {
  try {
    const { fecha, tematica, medio, vecinos_recibido, vecinos_interes, vecinos_rechazo } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO aaff_comunicaciones(aaff_id,fecha,tematica,medio,vecinos_recibido,vecinos_interes,vecinos_rechazo) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [req.params.id, fecha, tematica, medio, vecinos_recibido||0, vecinos_interes||0, vecinos_rechazo||0]
    );
    await pool.query('UPDATE aaff_despachos SET ultima_actividad=NOW() WHERE id=$1', [req.params.id]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
