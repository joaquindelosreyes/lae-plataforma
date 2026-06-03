const router = require('express').Router();
const pool = require('../db/pool');

// GET /api/oficinas
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.*,
        COALESCE(SUM(s.cobrado), 0) AS total_cobrado,
        COALESCE(SUM(s.generado), 0) AS total_generado,
        COALESCE(SUM(s.captaciones), 0) AS total_captaciones,
        COALESCE(SUM(s.cierres), 0) AS total_cierres,
        COALESCE(MAX(s.aaff_activos), 0) AS aaff_activos,
        CASE WHEN o.objetivo_anual > 0
          THEN ROUND(COALESCE(SUM(s.cobrado),0) / o.objetivo_anual * 100, 1)
          ELSE 0 END AS pct_cumplimiento
      FROM oficinas o
      LEFT JOIN seguimiento s ON s.oficina_id = o.id
      GROUP BY o.id ORDER BY total_cobrado DESC
    `);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/oficinas/resumen — totales red
router.get('/resumen', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        SUM(o.objetivo_anual) AS objetivo_total,
        COALESCE(SUM(s.cobrado), 0) AS cobrado_total,
        COALESCE(SUM(s.generado), 0) AS generado_total,
        COALESCE(SUM(s.captaciones), 0) AS captaciones_total,
        COALESCE(SUM(s.cierres), 0) AS cierres_total,
        COALESCE(SUM(s.aaff_activos), 0) AS aaff_activos_total,
        SUM(o.objetivo_aaff) AS aaff_objetivo_total,
        CASE WHEN SUM(o.objetivo_anual) > 0
          THEN ROUND(COALESCE(SUM(s.cobrado),0) / SUM(o.objetivo_anual) * 100, 1)
          ELSE 0 END AS pct_cumplimiento
      FROM oficinas o LEFT JOIN seguimiento s ON s.oficina_id = o.id
    `);
    res.json({ success: true, data: rows[0] });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/oficinas/:id/consultores
router.get('/:id/consultores', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM consultores WHERE oficina_id = $1 AND activo = true ORDER BY nombre',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
