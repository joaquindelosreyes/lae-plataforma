const router = require('express').Router();
const pool = require('../db/pool');

// Ejecutar migración v3 al arrancar (idempotente)
pool.query(`ALTER TABLE captaciones ADD COLUMN IF NOT EXISTS aaff_id INTEGER REFERENCES aaff_despachos(id)`)
  .catch(() => {});

// GET /api/aaff50 — listado completo con stats
router.get('/', async (req, res) => {
  try {
    const { oficina_id, responsable_id } = req.query;
    let where = `d.modalidad = '50-50'`;
    const params = [];
    let i = 1;
    if (oficina_id)     { where += ` AND d.oficina_id = $${i++}`;                  params.push(oficina_id); }
    if (responsable_id) { where += ` AND d.consultor_responsable_id = $${i++}`;    params.push(responsable_id); }

    const { rows } = await pool.query(`
      SELECT d.*,
        o.nombre  AS oficina_nombre,
        cons.nombre AS responsable_nombre,
        COUNT(com.id) AS total_comunicaciones,
        MAX(com.fecha) AS ultima_comunicacion,
        COALESCE(SUM(com.vecinos_recibido), 0) AS total_vecinos_recibido,
        COALESCE(SUM(com.vecinos_interes),  0) AS total_vecinos_interes,
        CASE WHEN COALESCE(SUM(com.vecinos_recibido),0) > 0
          THEN ROUND(COALESCE(SUM(com.vecinos_interes),0) * 100.0 / SUM(com.vecinos_recibido), 1)
          ELSE 0 END AS tasa_interes,
        EXTRACT(DAY FROM NOW() - MAX(com.fecha))::int AS dias_ultimo_contacto,
        -- Captaciones Inmovilla (via captaciones.aaff_id)
        (SELECT COUNT(*) FROM captaciones cap WHERE cap.aaff_id = d.id) AS captaciones_inmovilla,
        -- Cierres/financiero desde operaciones (via operaciones.aaff_id)
        (SELECT COUNT(*) FROM operaciones op WHERE op.aaff_id = d.id AND op.estado = 'cobrada') AS cierres_inmovilla,
        (SELECT COALESCE(SUM(op.honorarios_lae),0) FROM operaciones op WHERE op.aaff_id = d.id AND op.estado IN ('pipeline','cobrada')) AS generado,
        (SELECT COALESCE(SUM(op.honorarios_lae),0) FROM operaciones op WHERE op.aaff_id = d.id AND op.estado = 'cobrada') AS cobrado,
        (SELECT COALESCE(SUM(op.importe_aaff),0)   FROM operaciones op WHERE op.aaff_id = d.id) AS comision_aaff
      FROM aaff_despachos d
      LEFT JOIN oficinas     o    ON o.id   = d.oficina_id
      LEFT JOIN consultores  cons ON cons.id = d.consultor_responsable_id
      LEFT JOIN aaff_comunicaciones com ON com.aaff_id = d.id
      WHERE ${where}
      GROUP BY d.id, o.nombre, cons.nombre
      ORDER BY d.ciudad, d.nombre
    `, params);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/aaff50/resumen
router.get('/resumen', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) AS total_despachos,
        COUNT(*) FILTER (WHERE estado='activo') AS activos,
        SUM(comunidades_totales)   AS total_comunidades,
        SUM(administrados)         AS total_administrados,
        SUM(comunidades_compartidas) AS comunidades_compartidas,
        SUM(vecinos_compartidos)   AS vecinos_compartidos,
        COUNT(*) FILTER (WHERE plan_mkt = true) AS con_plan_mkt
      FROM aaff_despachos WHERE modalidad = '50-50'
    `);

    const { rows: comRows } = await pool.query(`
      SELECT
        COUNT(*)              AS total_comunicaciones,
        SUM(vecinos_recibido) AS vecinos_impactados,
        SUM(vecinos_interes)  AS vecinos_interes,
        SUM(vecinos_rechazo)  AS vecinos_rechazo,
        ROUND(SUM(vecinos_interes)*100.0/NULLIF(SUM(vecinos_recibido),0),1) AS tasa_interes
      FROM aaff_comunicaciones c
      JOIN aaff_despachos d ON d.id = c.aaff_id
      WHERE d.modalidad = '50-50'
    `);

    // Captaciones y cierres desde tablas de Inmovilla
    const { rows: inmRows } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM captaciones WHERE aaff_id IN
          (SELECT id FROM aaff_despachos WHERE modalidad='50-50')) AS captaciones_totales,
        (SELECT COUNT(*) FROM operaciones WHERE aaff_id IN
          (SELECT id FROM aaff_despachos WHERE modalidad='50-50') AND estado='cobrada') AS ventas_totales,
        (SELECT COALESCE(SUM(honorarios_lae),0) FROM operaciones WHERE aaff_id IN
          (SELECT id FROM aaff_despachos WHERE modalidad='50-50') AND estado IN ('pipeline','cobrada')) AS generado_total,
        (SELECT COALESCE(SUM(honorarios_lae),0) FROM operaciones WHERE aaff_id IN
          (SELECT id FROM aaff_despachos WHERE modalidad='50-50') AND estado='cobrada') AS cobrado_total
    `);

    res.json({ success: true, data: { ...rows[0], ...comRows[0], ...inmRows[0] } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/aaff50/:id/comunicaciones
router.get('/:id/comunicaciones', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM aaff_comunicaciones WHERE aaff_id=$1 ORDER BY fecha DESC',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/aaff50/stats/medios — agrupa como "Otros" los medios no estándar
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

// GET /api/aaff50/stats/oficinas
router.get('/stats/oficinas', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.nombre,
        COUNT(d.id) AS despachos,
        SUM(d.comunidades_compartidas) AS comunidades,
        SUM(d.vecinos_compartidos) AS vecinos,
        (SELECT COUNT(*) FROM captaciones c WHERE c.aaff_id IN
          (SELECT id FROM aaff_despachos WHERE oficina_id = o.id AND modalidad='50-50')) AS captaciones,
        (SELECT COUNT(*) FROM operaciones op WHERE op.aaff_id IN
          (SELECT id FROM aaff_despachos WHERE oficina_id = o.id AND modalidad='50-50') AND op.estado='cobrada') AS ventas
      FROM aaff_despachos d
      LEFT JOIN oficinas o ON o.id = d.oficina_id
      WHERE d.modalidad = '50-50'
      GROUP BY o.id, o.nombre ORDER BY despachos DESC
    `);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/aaff50/filtros — oficinas y responsables disponibles
router.get('/filtros', async (req, res) => {
  try {
    const { rows: ofs } = await pool.query(`
      SELECT DISTINCT o.id, o.nombre FROM oficinas o
      JOIN aaff_despachos d ON d.oficina_id = o.id AND d.modalidad='50-50'
      ORDER BY o.nombre
    `);
    const { rows: resps } = await pool.query(`
      SELECT DISTINCT c.id, c.nombre FROM consultores c
      JOIN aaff_despachos d ON d.consultor_responsable_id = c.id AND d.modalidad='50-50'
      ORDER BY c.nombre
    `);
    res.json({ success: true, data: { oficinas: ofs, responsables: resps } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/aaff50/:id/comunicaciones
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
