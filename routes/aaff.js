const router = require('express').Router();
const AAFF = require('../models/AAFF');

// GET /api/aaff
router.get('/', async (req, res) => {
  try {
    const { oficina_id, estado } = req.query;
    const data = await AAFF.listar({ oficina_id, estado });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/aaff/resumen
router.get('/resumen', async (req, res) => {
  try {
    const data = await AAFF.resumen();
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/aaff — nuevo despacho
router.post('/', async (req, res) => {
  try {
    const data = await AAFF.crear(req.body);
    res.status(201).json({ success: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// PATCH /api/aaff/:id/estado
router.patch('/:id/estado', async (req, res) => {
  try {
    const { estado, observaciones } = req.body;
    const data = await AAFF.actualizarEstado(req.params.id, estado, observaciones);
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// PATCH /api/aaff/:id/contacto — registrar último contacto
router.patch('/:id/contacto', async (req, res) => {
  try {
    const data = await AAFF.registrarContacto(req.params.id);
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/aaff/:id
router.delete('/:id', async (req, res) => {
  try {
    await AAFF.eliminar(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
