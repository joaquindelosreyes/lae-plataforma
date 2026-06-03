const router = require('express').Router();
const Gasto = require('../models/Gasto');

// GET /api/gastos
router.get('/', async (req, res) => {
  try {
    const { oficina_id, categoria, desde, hasta } = req.query;
    const data = await Gasto.listar({ oficina_id, categoria, desde, hasta });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/gastos/resumen
router.get('/resumen', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const data = await Gasto.resumen({ desde, hasta });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/gastos
router.post('/', async (req, res) => {
  try {
    const { oficina_ids, ...gastoData } = req.body;
    const data = await Gasto.crear(gastoData, oficina_ids || []);
    res.status(201).json({ success: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/gastos/:id
router.delete('/:id', async (req, res) => {
  try {
    await Gasto.eliminar(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
