require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// GET todas las oficinas con acumulado
app.get('/api/oficinas', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.*,
        COALESCE(SUM(s.cobrado), 0) AS total_cobrado,
        COALESCE(SUM(s.generado), 0) AS total_generado,
        COALESCE(SUM(s.captaciones), 0) AS total_captaciones,
        COALESCE(SUM(s.cierres), 0) AS total_cierres,
        CASE WHEN o.objetivo_anual > 0 THEN ROUND(COALESCE(SUM(s.cobrado),0) / o.objetivo_anual * 100, 1) ELSE 0 END AS pct_cumplimiento
      FROM oficinas o
      LEFT JOIN seguimiento s ON s.oficina_id = o.id
      GROUP BY o.id ORDER BY total_cobrado DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET seguimiento trimestral de una oficina
app.get('/api/oficinas/:id/seguimiento', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM seguimiento WHERE oficina_id = $1 ORDER BY año, trimestre',
      [req.params.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST / PUT datos de seguimiento trimestral
app.post('/api/seguimiento', async (req, res) => {
  const { oficina_id, año, trimestre, cobrado, generado, captaciones, cierres, aaff_activos } = req.body;
  try {
    const { rows } = await pool.query(`
      INSERT INTO seguimiento (oficina_id, año, trimestre, cobrado, generado, captaciones, cierres, aaff_activos)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (oficina_id, año, trimestre)
      DO UPDATE SET cobrado=$4, generado=$5, captaciones=$6, cierres=$7, aaff_activos=$8, updated_at=NOW()
      RETURNING *
    `, [oficina_id, año, trimestre, cobrado, generado, captaciones, cierres, aaff_activos]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET resumen red completa
app.get('/api/resumen', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        SUM(o.objetivo_anual) AS objetivo_total,
        COALESCE(SUM(s.cobrado), 0) AS cobrado_total,
        COALESCE(SUM(s.generado), 0) AS generado_total,
        COALESCE(SUM(s.captaciones), 0) AS captaciones_total,
        COALESCE(SUM(s.cierres), 0) AS cierres_total,
        CASE WHEN SUM(o.objetivo_anual) > 0 THEN ROUND(COALESCE(SUM(s.cobrado),0) / SUM(o.objetivo_anual) * 100, 1) ELSE 0 END AS pct_cumplimiento
      FROM oficinas o LEFT JOIN seguimiento s ON s.oficina_id = o.id
    `);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log(`LAE Plataforma corriendo en puerto ${PORT}`));
