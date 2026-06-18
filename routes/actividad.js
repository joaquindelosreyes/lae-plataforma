const router = require('express').Router();
const pool = require('../db/pool');

// GET /api/actividad/resumen
router.get('/resumen', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    let where = '1=1';
    const p = [];
    if (desde) { where += ` AND fecha >= $${p.length+1}`; p.push(desde); }
    if (hasta) { where += ` AND fecha <= $${p.length+1}`; p.push(hasta); }

    const { rows } = await pool.query(`
      SELECT
        COUNT(*) AS total_visitas,
        COUNT(*) FILTER (WHERE tipo_seguimiento LIKE '1ª Visita%Venta%') AS visitas_venta,
        COUNT(*) FILTER (WHERE tipo_seguimiento LIKE '1ª Visita%Alquiler%') AS visitas_alquiler,
        COUNT(*) FILTER (WHERE tipo_seguimiento LIKE '%Evaluación%') AS visitas_evaluacion,
        COUNT(*) FILTER (WHERE tipo_seguimiento LIKE '%Adicional%') AS visitas_adicionales,
        COUNT(*) FILTER (WHERE tipo_seguimiento LIKE '%Cancelada%') AS visitas_canceladas,
        COUNT(DISTINCT comercial) AS comerciales_activos,
        COUNT(DISTINCT ref_propiedad) FILTER (WHERE ref_propiedad IS NOT NULL) AS propiedades_visitadas,
        ROUND(COUNT(*) FILTER (WHERE tipo_seguimiento LIKE '%Cancelada%') * 100.0 / NULLIF(COUNT(*),0), 1) AS ratio_cancelacion
      FROM actividad_comercial WHERE ${where}
    `, p);
    res.json({ success: true, data: rows[0] });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/actividad/por-comercial
router.get('/por-comercial', async (req, res) => {
  try {
    const { desde, hasta, oficina_id } = req.query;
    let where = '1=1';
    const p = [];
    if (desde) { where += ` AND fecha >= $${p.length+1}`; p.push(desde); }
    if (hasta) { where += ` AND fecha <= $${p.length+1}`; p.push(hasta); }
    if (oficina_id) { where += ` AND oficina_id = $${p.length+1}`; p.push(oficina_id); }

    const { rows } = await pool.query(`
      SELECT comercial,
        o.nombre AS oficina,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE tipo_seguimiento LIKE '1ª Visita%Venta%') AS venta,
        COUNT(*) FILTER (WHERE tipo_seguimiento LIKE '1ª Visita%Alquiler%') AS alquiler,
        COUNT(*) FILTER (WHERE tipo_seguimiento LIKE '%Adicional%') AS adicionales,
        COUNT(*) FILTER (WHERE tipo_seguimiento LIKE '%Cancelada%') AS canceladas,
        ROUND(COUNT(*) FILTER (WHERE tipo_seguimiento LIKE '%Cancelada%') * 100.0 / NULLIF(COUNT(*),0), 1) AS ratio_cancel
      FROM actividad_comercial a
      LEFT JOIN oficinas o ON o.id = a.oficina_id
      WHERE ${where} AND comercial IS NOT NULL
      GROUP BY comercial, o.nombre
      ORDER BY total DESC LIMIT 40
    `, p);
    res.json({ success: true, data: rows });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/actividad/por-tipo
router.get('/por-tipo', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    let where = '1=1';
    const p = [];
    if (desde) { where += ` AND fecha >= $${p.length+1}`; p.push(desde); }
    if (hasta) { where += ` AND fecha <= $${p.length+1}`; p.push(hasta); }

    const { rows } = await pool.query(`
      SELECT tipo_seguimiento, COUNT(*) AS total
      FROM actividad_comercial WHERE ${where} AND tipo_seguimiento IS NOT NULL
      GROUP BY tipo_seguimiento ORDER BY total DESC
    `, p);
    res.json({ success: true, data: rows });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/actividad/propiedades-activas
router.get('/propiedades-activas', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    let where = `ref_propiedad IS NOT NULL`;
    const p = [];
    if (desde) { where += ` AND fecha >= $${p.length+1}`; p.push(desde); }
    if (hasta) { where += ` AND fecha <= $${p.length+1}`; p.push(hasta); }

    const { rows } = await pool.query(`
      SELECT ref_propiedad AS ref,
        o.nombre AS oficina,
        COUNT(*) AS total_visitas,
        COUNT(*) FILTER (WHERE tipo_seguimiento LIKE '1ª Visita%') AS primeras_visitas,
        COUNT(*) FILTER (WHERE tipo_seguimiento LIKE '%Cancelada%') AS canceladas,
        MAX(fecha) AS ultima_visita
      FROM actividad_comercial a
      LEFT JOIN oficinas o ON o.id = a.oficina_id
      WHERE ${where}
      GROUP BY ref_propiedad, o.nombre
      ORDER BY total_visitas DESC LIMIT 30
    `, p);
    res.json({ success: true, data: rows });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/actividad/evolucion
router.get('/evolucion', async (req, res) => {
  try {
    const año = parseInt(req.query.año) || new Date().getFullYear();
    const { rows } = await pool.query(`
      SELECT EXTRACT(MONTH FROM fecha)::int AS mes,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE tipo_seguimiento LIKE '1ª Visita%Venta%') AS venta,
        COUNT(*) FILTER (WHERE tipo_seguimiento LIKE '1ª Visita%Alquiler%') AS alquiler,
        COUNT(*) FILTER (WHERE tipo_seguimiento LIKE '%Cancelada%') AS canceladas
      FROM actividad_comercial
      WHERE EXTRACT(YEAR FROM fecha) = $1 AND fecha IS NOT NULL
      GROUP BY mes ORDER BY mes
    `, [año]);
    res.json({ success: true, data: rows });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
