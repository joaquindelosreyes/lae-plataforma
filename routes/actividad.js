const router = require('express').Router();
const pool = require('../db/pool');

// Filtros reutilizables por tipo de visita
const F = {
  primeraVenta:       `(tipo_seguimiento LIKE '1ª Visita%Venta%' OR tipo_seguimiento = '1ª Visita -> General')`,
  primeraAlquiler:    `tipo_seguimiento LIKE '1ª Visita%Alquiler%'`,
  primeraEval:        `tipo_seguimiento LIKE '1ª Visita%Evaluaci%'`,
  adicionalVenta:     `(tipo_seguimiento LIKE 'Visita Adicional%Venta%' OR tipo_seguimiento = 'Visita Adicional -> General')`,
  adicionalAlquiler:  `tipo_seguimiento LIKE 'Visita Adicional%Alquiler%'`,
  adicionalEval:      `(tipo_seguimiento LIKE 'Visita Adicional%Evaluaci%' OR tipo_seguimiento = 'Visita Adicional, Captación')`,
};
const F_EVAL      = `(${F.primeraEval} OR ${F.adicionalEval})`;
const F_PRIMERAS  = `(${F.primeraVenta} OR ${F.primeraAlquiler} OR ${F.primeraEval})`;
const F_ADICIONAL = `(${F.adicionalVenta} OR ${F.adicionalAlquiler} OR ${F.adicionalEval})`;
const F_TOTAL     = `(${F_PRIMERAS} OR ${F_ADICIONAL})`;

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
        COUNT(*) FILTER (WHERE ${F_TOTAL})     AS total_visitas,
        COUNT(*) FILTER (WHERE ${F_EVAL})      AS evaluacion,
        COUNT(*) FILTER (WHERE ${F_PRIMERAS})  AS primeras_visitas,
        COUNT(*) FILTER (WHERE ${F_ADICIONAL}) AS visitas_adicionales,
        COUNT(*) FILTER (WHERE tipo_seguimiento LIKE '%Cancel%') AS visitas_canceladas,
        COUNT(DISTINCT comercial) AS comerciales_activos
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
    if (desde)     { where += ` AND fecha >= $${p.length+1}`; p.push(desde); }
    if (hasta)     { where += ` AND fecha <= $${p.length+1}`; p.push(hasta); }
    if (oficina_id){ where += ` AND oficina_id = $${p.length+1}`; p.push(oficina_id); }

    const { rows } = await pool.query(`
      SELECT comercial,
        o.nombre AS oficina,
        COUNT(*) FILTER (WHERE ${F_TOTAL})          AS total,
        COUNT(*) FILTER (WHERE ${F.primeraVenta})   AS primera_venta,
        COUNT(*) FILTER (WHERE ${F.primeraAlquiler}) AS primera_alquiler,
        COUNT(*) FILTER (WHERE ${F.primeraEval})    AS primera_evaluacion,
        COUNT(*) FILTER (WHERE ${F.adicionalVenta}) AS adicional_venta,
        COUNT(*) FILTER (WHERE ${F.adicionalAlquiler}) AS adicional_alquiler,
        COUNT(*) FILTER (WHERE ${F.adicionalEval})  AS adicional_evaluacion
      FROM actividad_comercial a
      LEFT JOIN oficinas o ON o.id = a.oficina_id
      WHERE ${where} AND comercial IS NOT NULL
      GROUP BY comercial, o.nombre
      ORDER BY total DESC LIMIT 50
    `, p);
    res.json({ success: true, data: rows });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/actividad/por-tipo (agrupado y sin tipos excluidos)
router.get('/por-tipo', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    let where = '1=1';
    const p = [];
    if (desde) { where += ` AND fecha >= $${p.length+1}`; p.push(desde); }
    if (hasta) { where += ` AND fecha <= $${p.length+1}`; p.push(hasta); }

    const { rows } = await pool.query(`
      SELECT grupo AS tipo_seguimiento, SUM(cnt) AS total FROM (
        SELECT
          CASE
            WHEN ${F.primeraVenta}      THEN '1ª Visita Venta'
            WHEN ${F.primeraAlquiler}   THEN '1ª Visita Alquiler'
            WHEN ${F.primeraEval}       THEN '1ª Visita Evaluación'
            WHEN ${F.adicionalVenta}    THEN 'Visita Adicional Venta'
            WHEN ${F.adicionalAlquiler} THEN 'Visita Adicional Alquiler'
            WHEN ${F.adicionalEval}     THEN 'Visita Adicional Evaluación'
          END AS grupo,
          COUNT(*) AS cnt
        FROM actividad_comercial
        WHERE ${where} AND tipo_seguimiento IS NOT NULL
        GROUP BY 1
      ) t
      WHERE grupo IS NOT NULL
      GROUP BY grupo
      ORDER BY total DESC
    `, p);
    res.json({ success: true, data: rows });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/actividad/por-oficina
router.get('/por-oficina', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    let where = '1=1';
    const p = [];
    if (desde) { where += ` AND fecha >= $${p.length+1}`; p.push(desde); }
    if (hasta) { where += ` AND fecha <= $${p.length+1}`; p.push(hasta); }

    const { rows } = await pool.query(`
      SELECT o.nombre AS oficina,
        COUNT(*) FILTER (WHERE ${F_TOTAL})          AS total,
        COUNT(*) FILTER (WHERE ${F.primeraVenta})   AS primera_venta,
        COUNT(*) FILTER (WHERE ${F.primeraAlquiler}) AS primera_alquiler,
        COUNT(*) FILTER (WHERE ${F.primeraEval})    AS primera_evaluacion,
        COUNT(*) FILTER (WHERE ${F.adicionalVenta}) AS adicional_venta,
        COUNT(*) FILTER (WHERE ${F.adicionalAlquiler}) AS adicional_alquiler,
        COUNT(*) FILTER (WHERE ${F.adicionalEval})  AS adicional_evaluacion
      FROM actividad_comercial a
      LEFT JOIN oficinas o ON o.id = a.oficina_id
      WHERE ${where} AND o.nombre IS NOT NULL
      GROUP BY o.id, o.nombre
      ORDER BY total DESC
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
        COUNT(*) FILTER (WHERE ${F_TOTAL}) AS total,
        COUNT(*) FILTER (WHERE ${F.primeraVenta})   AS primera_venta,
        COUNT(*) FILTER (WHERE ${F.primeraAlquiler}) AS primera_alquiler,
        COUNT(*) FILTER (WHERE ${F_EVAL})            AS evaluacion
      FROM actividad_comercial
      WHERE EXTRACT(YEAR FROM fecha) = $1 AND fecha IS NOT NULL
      GROUP BY mes ORDER BY mes
    `, [año]);
    res.json({ success: true, data: rows });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
