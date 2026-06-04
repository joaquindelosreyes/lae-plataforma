const router = require('express').Router();
const Demanda = require('../models/Demanda');

router.get('/resumen', async (req, res) => {
  try {
    const { oficina_id, desde, hasta } = req.query;
    const data = await Demanda.resumen({ oficina_id, desde, hasta });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/por-oficina', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const data = await Demanda.porOficina({ desde, hasta });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/por-canal', async (req, res) => {
  try {
    const { oficina_id, desde, hasta } = req.query;
    const data = await Demanda.porCanal({ oficina_id, desde, hasta });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/por-consultor', async (req, res) => {
  try {
    const { oficina_id, desde, hasta } = req.query;
    const data = await Demanda.porConsultor({ oficina_id, desde, hasta });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/evolucion', async (req, res) => {
  try {
    const año = parseInt(req.query.año) || new Date().getFullYear();
    const data = await Demanda.evolucionMensual(año);
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
