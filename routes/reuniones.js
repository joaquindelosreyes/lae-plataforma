const router = require('express').Router();
const Reunion = require('../models/Reunion');

// GET /api/reuniones?año=2026&mes=6
router.get('/', async (req, res) => {
  try {
    const año = parseInt(req.query.año) || new Date().getFullYear();
    const mes  = parseInt(req.query.mes)  || new Date().getMonth() + 1;
    const data = await Reunion.listarMes(año, mes);
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/reuniones/compromisos-abiertos
router.get('/compromisos-abiertos', async (req, res) => {
  try {
    const data = await Reunion.compromisosAbiertos();
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/reuniones/plantillas
router.get('/plantillas', async (req, res) => {
  try {
    const pool = require('../db/pool');
    const { rows } = await pool.query('SELECT * FROM plantillas_reunion ORDER BY id');
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// PUT /api/reuniones/plantillas/:id
router.put('/plantillas/:id', async (req, res) => {
  try {
    const pool = require('../db/pool');
    const { participantes, orden_dia } = req.body;
    const { rows } = await pool.query(
      'UPDATE plantillas_reunion SET participantes=$1, orden_dia=$2 WHERE id=$3 RETURNING *',
      [participantes, orden_dia, req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/reuniones/actas
router.get('/actas', async (req, res) => {
  try {
    const pool = require('../db/pool');
    const { rows } = await pool.query(`
      SELECT r.*, o.nombre AS oficina_nombre,
        COUNT(c.id) AS total_compromisos,
        COUNT(c.id) FILTER (WHERE c.completado = false) AS compromisos_abiertos
      FROM reuniones r
      LEFT JOIN oficinas o ON o.id = r.oficina_id
      LEFT JOIN compromisos c ON c.reunion_id = r.id
      GROUP BY r.id, o.nombre
      ORDER BY r.fecha DESC LIMIT 50
    `);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/reuniones/:id
router.get('/:id', async (req, res) => {
  try {
    const data = await Reunion.porId(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: 'No encontrada' });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/reuniones
router.post('/', async (req, res) => {
  try {
    const data = await Reunion.crear(req.body);
    res.status(201).json({ success: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/reuniones/:id/conclusiones
router.put('/:id/conclusiones', async (req, res) => {
  try {
    const data = await Reunion.actualizarConclusiones(req.params.id, req.body.conclusiones);
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/reuniones/:id
router.delete('/:id', async (req, res) => {
  try {
    await Reunion.eliminar(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/reuniones/:id/compromisos
router.post('/:id/compromisos', async (req, res) => {
  try {
    const data = await Reunion.crearCompromiso(req.params.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// PATCH /api/reuniones/compromisos/:id/toggle
router.patch('/compromisos/:id/toggle', async (req, res) => {
  try {
    const data = await Reunion.toggleCompromiso(req.params.id);
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/reuniones/compromisos/:id
router.delete('/compromisos/:id', async (req, res) => {
  try {
    await Reunion.eliminarCompromiso(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
