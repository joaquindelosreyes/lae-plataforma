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
app.use('/api/reuniones',   require('../routes/reuniones'));
app.use('/api/palancas',    require('../routes/palancas'));
app.use('/api/captaciones', require('../routes/captaciones'));
app.use('/api/import',      require('../routes/import'));

// Mantener compatibilidad con endpoints legacy del dashboard
const pool = require('../db/pool');

app.get('/api/resumen', async (req, res) => {
  try {
    const año   = parseInt(req.query.año) || new Date().getFullYear();
    const desde = req.query.desde || `${año}-01-01`;
    const hasta = req.query.hasta || `${año}-12-31`;
    const { rows } = await pool.query(`
      SELECT
        (SELECT SUM(objetivo_anual) FROM oficinas) AS objetivo_total,
        COALESCE(SUM(honorarios_lae) FILTER (WHERE estado='cobrada'), 0)  AS cobrado_total,
        COALESCE(SUM(honorarios_lae) FILTER (WHERE estado='pipeline'), 0) AS generado_total,
        COUNT(*) FILTER (WHERE estado='cobrada') AS cierres_total,
        (SELECT COUNT(*) FROM captaciones WHERE estado='activa') AS captaciones_total,
        CASE WHEN (SELECT SUM(objetivo_anual) FROM oficinas) > 0
          THEN ROUND(COALESCE(SUM(honorarios_lae) FILTER (WHERE estado='cobrada'),0) /
               (SELECT SUM(objetivo_anual) FROM oficinas) * 100, 1)
          ELSE 0 END AS pct_cumplimiento
      FROM operaciones
      WHERE fecha BETWEEN $1 AND $2
    `, [desde, hasta]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log(`LAE Plataforma · puerto ${PORT}`));
