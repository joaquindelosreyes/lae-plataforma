const pool = require('../db/pool');

const Reunion = {

  async listarMes(año, mes) {
    const { rows } = await pool.query(`
      SELECT r.*,
        o.nombre AS oficina_nombre,
        COUNT(c.id) AS total_compromisos,
        COUNT(c.id) FILTER (WHERE c.completado = false) AS compromisos_abiertos
      FROM reuniones r
      LEFT JOIN oficinas o ON o.id = r.oficina_id
      LEFT JOIN compromisos c ON c.reunion_id = r.id
      WHERE EXTRACT(YEAR FROM r.fecha) = $1 AND EXTRACT(MONTH FROM r.fecha) = $2
      GROUP BY r.id, o.nombre
      ORDER BY r.fecha
    `, [año, mes]);
    return rows;
  },

  async porId(id) {
    const { rows: reus } = await pool.query(`
      SELECT r.*, o.nombre AS oficina_nombre
      FROM reuniones r LEFT JOIN oficinas o ON o.id = r.oficina_id
      WHERE r.id = $1
    `, [id]);
    if (!reus[0]) return null;
    const { rows: comps } = await pool.query(
      'SELECT * FROM compromisos WHERE reunion_id = $1 ORDER BY completado, created_at',
      [id]
    );
    return { ...reus[0], compromisos: comps };
  },

  async crear(data) {
    const { rows } = await pool.query(`
      INSERT INTO reuniones (oficina_id, fecha, tipo, titulo, conclusiones)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [
      data.oficina_id || null,
      data.fecha,
      data.tipo || 'periodica',
      data.titulo || null,
      data.conclusiones || null
    ]);
    return rows[0];
  },

  async actualizarConclusiones(id, conclusiones) {
    const { rows } = await pool.query(
      'UPDATE reuniones SET conclusiones=$1 WHERE id=$2 RETURNING *',
      [conclusiones, id]
    );
    return rows[0];
  },

  async eliminar(id) {
    await pool.query('DELETE FROM reuniones WHERE id=$1', [id]);
  },

  // Compromisos
  async crearCompromiso(reunion_id, data) {
    const { rows } = await pool.query(`
      INSERT INTO compromisos (reunion_id, descripcion, responsable, plazo)
      VALUES ($1,$2,$3,$4) RETURNING *
    `, [reunion_id, data.descripcion, data.responsable || null, data.plazo || null]);
    return rows[0];
  },

  async toggleCompromiso(id) {
    const { rows } = await pool.query(
      'UPDATE compromisos SET completado = NOT completado WHERE id=$1 RETURNING *',
      [id]
    );
    return rows[0];
  },

  async eliminarCompromiso(id) {
    await pool.query('DELETE FROM compromisos WHERE id=$1', [id]);
  },

  async compromisosAbiertos() {
    const { rows } = await pool.query(`
      SELECT c.*, r.fecha AS reunion_fecha, o.nombre AS oficina_nombre
      FROM compromisos c
      JOIN reuniones r ON r.id = c.reunion_id
      LEFT JOIN oficinas o ON o.id = r.oficina_id
      WHERE c.completado = false
      ORDER BY c.plazo NULLS LAST, c.created_at
      LIMIT 20
    `);
    return rows;
  }
};

module.exports = Reunion;
