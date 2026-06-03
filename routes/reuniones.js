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
