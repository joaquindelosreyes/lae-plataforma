const router = require('express').Router();
const pool = require('../db/pool');

// GET /api/consultores
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, o.nombre AS oficina_nombre
      FROM consultores c
      LEFT JOIN oficinas o ON o.id = c.oficina_id
      WHERE c.activo = true
      ORDER BY o.nombre NULLS LAST,
        CASE c.puesto
          WHEN 'Director General' THEN 1
          WHEN 'Director Consultor' THEN 2
          WHEN 'Directora Consultora' THEN 2
          WHEN 'Consultor' THEN 3
          WHEN 'Consultora' THEN 3
          WHEN 'Coordinadora' THEN 4
          ELSE 5 END,
        c.nombre
    `);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/consultores
router.post('/', async (req, res) => {
  try {
    const { nombre, oficina_id, email } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO consultores (nombre, oficina_id, email) VALUES ($1,$2,$3) RETURNING *',
      [nombre, oficina_id, email || null]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/consultores/:id (baja lógica)
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('UPDATE consultores SET activo=false WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
