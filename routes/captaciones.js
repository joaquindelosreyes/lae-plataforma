const router = require('express').Router();
const Captacion = require('../models/Captacion');

// GET /api/captaciones
router.get('/', async (req, res) => {
  try {
    const { oficina_id, mandato, tipologia, tipo_operacion, antiguedad, estado } = req.query;
    const data = await Captacion.listar({ oficina_id, mandato, tipologia, tipo_operacion, antiguedad, estado });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/captaciones/resumen
router.get('/resumen', async (req, res) => {
  try {
    const data = await Captacion.resumen();
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/captaciones/matriz
router.get('/matriz', async (req, res) => {
  try {
    const { desde, hasta, oficina_id } = req.query;
    const data = await Captacion.matriz({ desde, hasta, oficina_id });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/captaciones/por-oficina
router.get('/por-oficina', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const data = await Captacion.porOficina({ desde, hasta });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/captaciones/vivienda-excl-por-oficina
router.get('/vivienda-excl-por-oficina', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const data = await Captacion.porOficinaViviendaExcl({ desde, hasta });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/captaciones/evolucion?año=2026
router.get('/evolucion', async (req, res) => {
  try {
    const año = parseInt(req.query.año) || new Date().getFullYear();
    const data = await Captacion.evolucionMensual(año);
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/captaciones
router.post('/', async (req, res) => {
  try {
    const data = await Captacion.crear(req.body);
    res.status(201).json({ success: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// PATCH /api/captaciones/:id/estado
router.patch('/:id/estado', async (req, res) => {
  try {
    const data = await Captacion.actualizarEstado(req.params.id, req.body.estado);
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
