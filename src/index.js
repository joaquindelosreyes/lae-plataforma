require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Rutas API
app.use('/api/oficinas',    require('../routes/oficinas'));
app.use('/api/operaciones', require('../routes/operaciones'));
app.use('/api/consultores', require('../routes/consultores'));
app.use('/api/gastos',      require('../routes/gastos'));
app.use('/api/aaff',        require('../routes/aaff'));

// Mantener compatibilidad con endpoints legacy del dashboard
const pool = require('../db/pool');

app.get('/api/resumen', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        SUM(o.objetivo_anual) AS objetivo_total,
        COALESCE(SUM(s.cobrado), 0) AS cobrado_total,
        COALESCE(SUM(s.generado), 0) AS generado_total,
        COALESCE(SUM(s.captaciones), 0) AS captaciones_total,
        COALESCE(SUM(s.cierres), 0) AS cierres_total,
        CASE WHEN SUM(o.objetivo_anual) > 0
          THEN ROUND(COALESCE(SUM(s.cobrado),0) / SUM(o.objetivo_anual) * 100, 1)
          ELSE 0 END AS pct_cumplimiento
      FROM oficinas o LEFT JOIN seguimiento s ON s.oficina_id = o.id
    `);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log(`LAE Plataforma · puerto ${PORT}`));
