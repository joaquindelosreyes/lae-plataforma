const router = require('express').Router();
const pool = require('../db/pool');

// GET /api/aaff50 — listado completo con stats
router.get('/', async (req, res) => {
  try {
    const { oficina_id } = req.query;
    let where = `d.modalidad = '50-50'`;
    const params = [];
    if (oficina_id) { where += ` AND d.oficina_id = $1`; params.push(oficina_id); }

    const { rows } = await pool.query(`
      SELECT d.*,
        o.nombre AS oficina_nombre,
        COUNT(c.id) AS total_comunicaciones,
        MAX(c.fecha) AS ultima_comunicacion,
        COALESCE(SUM(c.vecinos_recibido), 0) AS total_vecinos_recibido,
        COALESCE(SUM(c.vecinos_interes), 0) AS total_vecinos_interes,
        CASE WHEN COALESCE(SUM(c.vecinos_recibido),0) > 0
          THEN ROUND(COALESCE(SUM(c.vecinos_interes),0) * 100.0 / SUM(c.vecinos_recibido), 1)
          ELSE 0 END AS tasa_interes,
        EXTRACT(DAY FROM NOW() - MAX(c.fecha))::int AS dias_ultimo_contacto
      FROM aaff_despachos d
      LEFT JOIN oficinas o ON o.id = d.oficina_id
      LEFT JOIN aaff_comunicaciones c ON c.aaff_id = d.id
      WHERE ${where}
      GROUP BY d.id, o.nombre
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
        SUM(comunidades_totales) AS total_comunidades,
        SUM(administrados) AS total_administrados,
        SUM(comunidades_compartidas) AS comunidades_compartidas,
        SUM(vecinos_compartidos) AS vecinos_compartidos,
        SUM(captaciones_cerradas) AS captaciones_totales,
        SUM(ventas_cerradas) AS ventas_totales,
        COUNT(*) FILTER (WHERE plan_mkt = true) AS con_plan_mkt
      FROM aaff_despachos WHERE modalidad = '50-50'
    `);

    const { rows: comRows } = await pool.query(`
      SELECT
        COUNT(*) AS total_comunicaciones,
        SUM(vecinos_recibido) AS vecinos_impactados,
        SUM(vecinos_interes) AS vecinos_interes,
        SUM(vecinos_rechazo) AS vecinos_rechazo,
        ROUND(SUM(vecinos_interes)*100.0/NULLIF(SUM(vecinos_recibido),0),1) AS tasa_interes
      FROM aaff_comunicaciones c
      JOIN aaff_despachos d ON d.id = c.aaff_id
      WHERE d.modalidad = '50-50'
    `);

    res.json({ success: true, data: { ...rows[0], ...comRows[0] } });
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

// GET /api/aaff50/por-medio
router.get('/stats/medios', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT medio, COUNT(*) AS total,
        SUM(vecinos_recibido) AS recibidos,
        SUM(vecinos_interes) AS interes,
        ROUND(SUM(vecinos_interes)*100.0/NULLIF(SUM(vecinos_recibido),0),1) AS tasa
      FROM aaff_comunicaciones
      WHERE medio IS NOT NULL AND medio NOT ILIKE '%no%envio%' AND medio != ''
      GROUP BY medio ORDER BY total DESC LIMIT 10
    `);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/aaff50/por-oficina
router.get('/stats/oficinas', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.nombre, COUNT(d.id) AS despachos,
        SUM(d.comunidades_compartidas) AS comunidades,
        SUM(d.vecinos_compartidos) AS vecinos,
        SUM(d.captaciones_cerradas) AS captaciones,
        SUM(d.ventas_cerradas) AS ventas
      FROM aaff_despachos d
      LEFT JOIN oficinas o ON o.id = d.oficina_id
      WHERE d.modalidad = '50-50'
      GROUP BY o.nombre ORDER BY despachos DESC
    `);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/aaff50/:id/comunicaciones — nueva comunicación
router.post('/:id/comunicaciones', async (req, res) => {
  try {
    const { fecha, tematica, medio, vecinos_recibido, vecinos_interes, vecinos_rechazo } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO aaff_comunicaciones(aaff_id,fecha,tematica,medio,vecinos_recibido,vecinos_interes,vecinos_rechazo) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [req.params.id, fecha, tematica, medio, vecinos_recibido||0, vecinos_interes||0, vecinos_rechazo||0]
    );
    // Actualizar última actividad
    await pool.query('UPDATE aaff_despachos SET ultima_actividad=NOW() WHERE id=$1', [req.params.id]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
