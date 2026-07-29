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

  async compromisosAbiertos({ desde, hasta, oficina_id } = {}) {
    let where = ['c.completado = false'];
    const params = [];
    if (desde)      { where.push(`r.fecha >= $${params.length+1}`);     params.push(desde); }
    if (hasta)      { where.push(`r.fecha <= $${params.length+1}`);     params.push(hasta); }
    if (oficina_id) { where.push(`r.oficina_id = $${params.length+1}`); params.push(oficina_id); }
    const { rows } = await pool.query(`
      SELECT c.*, r.fecha AS reunion_fecha, r.id AS reunion_id_real,
             o.nombre AS oficina_nombre, o.id AS oficina_id
      FROM compromisos c
      JOIN reuniones r ON r.id = c.reunion_id
      LEFT JOIN oficinas o ON o.id = r.oficina_id
      WHERE ${where.join(' AND ')}
      ORDER BY o.nombre NULLS LAST, c.plazo NULLS LAST, c.created_at
      LIMIT 200
    `, params);
    return rows;
  },

  async dossierOficina(reunion_id) {
    const { rows: r } = await pool.query(`
      SELECT r.*, o.nombre AS oficina_nombre, o.objetivo_anual
      FROM reuniones r LEFT JOIN oficinas o ON o.id = r.oficina_id
      WHERE r.id = $1
    `, [reunion_id]);
    if (!r[0] || !r[0].oficina_id) return null;
    const reunion = r[0];
    const oid = reunion.oficina_id;
    const año = new Date(reunion.fecha).getFullYear();

    const [cap, ops, aaff, prevReu] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) AS total,
          COUNT(*) FILTER (WHERE mandato='exclusiva') AS exclusivas,
          COALESCE(SUM(honorarios_potenciales) FILTER (WHERE mandato='exclusiva'), 0) AS hon_pot_excl
        FROM captaciones WHERE oficina_id=$1 AND estado='activa'
      `, [oid]),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE estado='pipeline')            AS pipeline_count,
          COALESCE(SUM(honorarios_lae) FILTER (WHERE estado='pipeline'), 0)            AS pipeline_lae,
          COUNT(*) FILTER (WHERE estado='pendiente_escritura') AS arras_count,
          COALESCE(SUM(honorarios_lae) FILTER (WHERE estado='pendiente_escritura'), 0) AS arras_lae,
          COALESCE(SUM(honorarios_lae) FILTER (WHERE estado='cobrada' AND EXTRACT(YEAR FROM fecha)=$2), 0) AS cobrado_año
        FROM operaciones WHERE oficina_id=$1
      `, [oid, año]),
      pool.query(`SELECT COUNT(*) AS total FROM aaff_despachos WHERE oficina_id=$1 AND estado='activo'`, [oid]),
      pool.query(`
        SELECT r.id, r.fecha, r.conclusiones, r.tipo,
          COALESCE(json_agg(json_build_object(
            'descripcion', c.descripcion, 'responsable', c.responsable,
            'completado', c.completado, 'plazo', c.plazo
          ) ORDER BY c.completado, c.created_at) FILTER (WHERE c.id IS NOT NULL), '[]') AS compromisos
        FROM reuniones r
        LEFT JOIN compromisos c ON c.reunion_id = r.id
        WHERE r.oficina_id=$1 AND r.id != $2 AND r.fecha < $3
        GROUP BY r.id ORDER BY r.fecha DESC LIMIT 1
      `, [oid, reunion_id, reunion.fecha]),
    ]);

    return {
      oficina_nombre:  reunion.oficina_nombre,
      objetivo_anual:  parseFloat(reunion.objetivo_anual) || 0,
      captaciones:     cap.rows[0],
      operaciones:     ops.rows[0],
      aaff_activos:    parseInt(aaff.rows[0]?.total) || 0,
      reunion_anterior: prevReu.rows[0] || null,
    };
  }
};

module.exports = Reunion;
