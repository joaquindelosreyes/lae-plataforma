const router = require('express').Router();
const Operacion = require('../models/Operacion');

// GET /api/operaciones — listado con filtros
router.get('/', async (req, res) => {
  try {
    const { oficina_id, estado, canal, desde, hasta, limit, offset } = req.query;
    const data = await Operacion.listar({ oficina_id, estado, canal, desde, hasta, limit, offset });
    res.json({ success: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/operaciones/resumen — KPIs
router.get('/resumen', async (req, res) => {
  try {
    const { oficina_id, desde, hasta } = req.query;
    const data = await Operacion.resumen({ oficina_id, desde, hasta });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/operaciones/por-oficina — tabla semáforo
router.get('/por-oficina', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const data = await Operacion.porOficina({ desde, hasta });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/operaciones/:id
router.get('/:id', async (req, res) => {
  try {
    const data = await Operacion.porId(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: 'No encontrada' });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/operaciones — nueva formalización
router.post('/', async (req, res) => {
  try {
    const data = await Operacion.crear(req.body);
    res.status(201).json({ success: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/operaciones/:id — actualizar
router.put('/:id', async (req, res) => {
  try {
    const data = await Operacion.actualizar(req.params.id, req.body);
    if (!data) return res.status(404).json({ success: false, error: 'No encontrada' });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PATCH /api/operaciones/:id/estado — cambiar estado rápido
router.patch('/:id/estado', async (req, res) => {
  try {
    const { estado, fecha_cobro } = req.body;
    const data = await Operacion.actualizar(req.params.id, { estado, fecha_cobro });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/operaciones/:id
router.delete('/:id', async (req, res) => {
  try {
    await Operacion.eliminar(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
