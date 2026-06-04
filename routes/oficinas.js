const router = require('express').Router();
const pool = require('../db/pool');

// Detecta qué columna de objetivo usar según el rango de fechas
function detectarObjetivoCol(desde, hasta) {
  if (!desde || !hasta) return 'objetivo_anual';
  const d = desde.slice(0, 10), h = hasta.slice(0, 10);
  if (d === '2026-01-01' && h === '2026-03-31') return 'obj_1t';
  if (d === '2025-01-01' && h === '2025-03-31') return 'obj_1t';
  if (d.slice(5) === '01-01' && h.slice(5) === '03-31') return 'obj_1t';
  if (d.slice(5) === '04-01' && h.slice(5) === '06-30') return 'obj_2t';
  if (d.slice(5) === '07-01' && h.slice(5) === '09-30') return 'obj_3t';
  if (d.slice(5) === '10-01' && h.slice(5) === '12-31') return 'obj_4t';
  // Mes individual → usar objetivo del trimestre correspondiente
  const mes = parseInt(d.slice(5, 7));
  if (mes <= 3)  return 'obj_1t';
  if (mes <= 6)  return 'obj_2t';
  if (mes <= 9)  return 'obj_3t';
  return 'obj_4t';
}

// GET /api/oficinas?año=2026&desde=2026-01-01&hasta=2026-06-30
router.get('/', async (req, res) => {
  try {
    const año   = parseInt(req.query.año) || new Date().getFullYear();
    const desde = req.query.desde || `${año}-01-01`;
    const hasta = req.query.hasta || `${año}-12-31`;

    // Determinar si es año completo o período parcial
    const esAnoCompleto = desde.slice(5) === '01-01' && hasta.slice(5) === '12-31';
    const objCol = esAnoCompleto ? 'objetivo_anual' : detectarObjetivoCol(desde, hasta);

    const { rows } = await pool.query(`
      SELECT o.*,
        COALESCE(ops.cobrado, 0)     AS total_cobrado,
        COALESCE(ops.generado, 0)    AS total_generado,
        COALESCE(ops.cierres, 0)     AS total_cierres,
        COALESCE(cap.total, 0)       AS total_captaciones,
        COALESCE(aaff.activos, 0)    AS aaff_activos,
        o.${objCol}                  AS objetivo_periodo,
        CASE WHEN o.${objCol} > 0
          THEN ROUND(COALESCE(ops.cobrado,0) / o.${objCol} * 100, 1)
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
