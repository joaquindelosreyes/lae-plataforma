const router = require('express').Router();
const pool   = require('../db/pool');

// Crear tabla si no existe
pool.query(`
  CREATE TABLE IF NOT EXISTS snapshots_mensuales (
    id                    SERIAL PRIMARY KEY,
    fecha                 DATE NOT NULL UNIQUE,
    cap_activas           INTEGER DEFAULT 0,
    cap_exclusivas        INTEGER DEFAULT 0,
    cap_nota_encargo      INTEGER DEFAULT 0,
    cap_viviendas_excl    INTEGER DEFAULT 0,
    valor_cartera         NUMERIC(15,2) DEFAULT 0,
    honorarios_potenciales NUMERIC(15,2) DEFAULT 0,
    ops_pipeline_count    INTEGER DEFAULT 0,
    ops_pipeline_lae      NUMERIC(15,2) DEFAULT 0,
    ops_arras_count       INTEGER DEFAULT 0,
    ops_arras_lae         NUMERIC(15,2) DEFAULT 0,
    created_at            TIMESTAMP DEFAULT NOW()
  )
`).catch(() => {});

async function generarSnapshot(fecha) {
  const fechaStr = typeof fecha === 'string' ? fecha : fecha.toISOString().slice(0, 10);
  const [cap, ops] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado='activa')                                    AS cap_activas,
        COUNT(*) FILTER (WHERE estado='activa' AND mandato='exclusiva')             AS cap_exclusivas,
        COUNT(*) FILTER (WHERE estado='activa' AND mandato='nota_encargo')          AS cap_nota_encargo,
        COUNT(*) FILTER (WHERE estado='activa' AND mandato='exclusiva'
                               AND tipologia='vivienda')                            AS cap_viviendas_excl,
        COALESCE(SUM(precio_captacion)      FILTER (WHERE estado='activa'), 0)      AS valor_cartera,
        COALESCE(SUM(honorarios_potenciales) FILTER (WHERE estado='activa'), 0)     AS honorarios_potenciales
      FROM captaciones
    `),
    pool.query(`
      SELECT
        COUNT(*)                                     FILTER (WHERE estado='pipeline')            AS ops_pipeline_count,
        COALESCE(SUM(honorarios_lae)                 FILTER (WHERE estado='pipeline'), 0)        AS ops_pipeline_lae,
        COUNT(*)                                     FILTER (WHERE estado='pendiente_escritura') AS ops_arras_count,
        COALESCE(SUM(honorarios_lae)                 FILTER (WHERE estado='pendiente_escritura'), 0) AS ops_arras_lae
      FROM operaciones
    `),
  ]);

  const c = cap.rows[0];
  const o = ops.rows[0];

  await pool.query(`
    INSERT INTO snapshots_mensuales
      (fecha, cap_activas, cap_exclusivas, cap_nota_encargo, cap_viviendas_excl,
       valor_cartera, honorarios_potenciales,
       ops_pipeline_count, ops_pipeline_lae, ops_arras_count, ops_arras_lae)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (fecha) DO UPDATE SET
      cap_activas=$2, cap_exclusivas=$3, cap_nota_encargo=$4, cap_viviendas_excl=$5,
      valor_cartera=$6, honorarios_potenciales=$7,
      ops_pipeline_count=$8, ops_pipeline_lae=$9, ops_arras_count=$10, ops_arras_lae=$11,
      created_at=NOW()
  `, [
    fechaStr,
    parseInt(c.cap_activas)        || 0,
    parseInt(c.cap_exclusivas)     || 0,
    parseInt(c.cap_nota_encargo)   || 0,
    parseInt(c.cap_viviendas_excl) || 0,
    parseFloat(c.valor_cartera)            || 0,
    parseFloat(c.honorarios_potenciales)   || 0,
    parseInt(o.ops_pipeline_count) || 0,
    parseFloat(o.ops_pipeline_lae) || 0,
    parseInt(o.ops_arras_count)    || 0,
    parseFloat(o.ops_arras_lae)    || 0,
  ]);

  return fechaStr;
}

module.exports = { router, generarSnapshot };

// GET /api/snapshots
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM snapshots_mensuales ORDER BY fecha DESC LIMIT 36'
    );
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/snapshots/generar  (fecha opcional en body, default = hoy)
router.post('/generar', async (req, res) => {
  try {
    const fecha = req.body.fecha || new Date().toISOString().slice(0, 10);
    const fechaGuardada = await generarSnapshot(fecha);
    res.json({ success: true, fecha: fechaGuardada });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});
