const router = require('express').Router();
const pool = require('../db/pool');

// GET /api/oficinas?año=2026&desde=2026-01-01&hasta=2026-06-30
router.get('/', async (req, res) => {
  try {
    const año   = parseInt(req.query.año) || new Date().getFullYear();
    const desde = req.query.desde || `${año}-01-01`;
    const hasta = req.query.hasta || `${año}-12-31`;
    const { rows } = await pool.query(`
      SELECT o.*,
        COALESCE(ops.cobrado, 0)     AS total_cobrado,
        COALESCE(ops.generado, 0)    AS total_generado,
        COALESCE(ops.cierres, 0)     AS total_cierres,
        COALESCE(cap.total, 0)       AS total_captaciones,
        COALESCE(aaff.activos, 0)    AS aaff_activos,
        CASE WHEN o.objetivo_anual > 0
          THEN ROUND(COALESCE(ops.cobrado,0) / o.objetivo_anual * 100, 1)
          ELSE 0 END AS pct_cumplimiento
      FROM oficinas o
      LEFT JOIN (
        SELECT oficina_id,
          SUM(honorarios_lae) FILTER (WHERE estado='cobrada')  AS cobrado,
          SUM(honorarios_lae) FILTER (WHERE estado='pipeline') AS generado,
          COUNT(*) FILTER (WHERE estado='cobrada')             AS cierres
        FROM operaciones WHERE fecha BETWEEN $1 AND $2
        GROUP BY oficina_id
      ) ops ON ops.oficina_id = o.id
      LEFT JOIN (
        SELECT oficina_id, COUNT(*) AS total FROM captaciones WHERE estado='activa' GROUP BY oficina_id
      ) cap ON cap.oficina_id = o.id
      LEFT JOIN (
        SELECT oficina_id, COUNT(*) AS activos FROM aaff_despachos WHERE estado='activo' GROUP BY oficina_id
      ) aaff ON aaff.oficina_id = o.id
      ORDER BY total_cobrado DESC
    `, [desde, hasta]);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/oficinas/resumen?año=2026
router.get('/resumen', async (req, res) => {
  try {
    const año = parseInt(req.query.año) || new Date().getFullYear();
    const { rows } = await pool.query(`
      SELECT
        SUM(o.objetivo_anual)  AS objetivo_total,
        COALESCE(SUM(op.honorarios_lae) FILTER (WHERE op.estado='cobrada'), 0)  AS cobrado_total,
        COALESCE(SUM(op.honorarios_lae) FILTER (WHERE op.estado='pipeline'), 0) AS generado_total,
        COUNT(op.id) FILTER (WHERE op.estado='cobrada')  AS cierres_total,
        (SELECT COUNT(*) FROM captaciones WHERE estado='activa') AS captaciones_total,
        (SELECT COUNT(*) FROM aaff_despachos WHERE estado='activo') AS aaff_activos_total,
        SUM(o.objetivo_aaff)   AS aaff_objetivo_total,
        CASE WHEN SUM(o.objetivo_anual) > 0
          THEN ROUND(COALESCE(SUM(op.honorarios_lae) FILTER (WHERE op.estado='cobrada'),0) / SUM(o.objetivo_anual) * 100, 1)
          ELSE 0 END AS pct_cumplimiento
      FROM oficinas o
      LEFT JOIN operaciones op ON op.oficina_id = o.id
        AND EXTRACT(YEAR FROM op.fecha) = $1
    `, [año]);
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
