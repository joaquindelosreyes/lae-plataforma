const pool = require('../db/pool');

const AAFF = {

  async listar({ oficina_id, estado } = {}) {
    let where = ['1=1'];
    const params = [];
    let i = 1;
    if (oficina_id) { where.push(`d.oficina_id = $${i++}`); params.push(oficina_id); }
    if (estado)     { where.push(`d.estado = $${i++}`);     params.push(estado); }

    const { rows } = await pool.query(`
      SELECT d.*,
        o.nombre AS oficina_nombre,
        c.nombre AS consultor_nombre,
        -- Captaciones y cierres desde operaciones
        COUNT(op.id) FILTER (WHERE op.canal = 'aaff' AND op.estado != 'cancelada') AS total_captaciones,
        COUNT(op.id) FILTER (WHERE op.canal = 'aaff' AND op.estado = 'cobrada') AS total_cierres,
        COALESCE(SUM(op.honorarios_lae) FILTER (WHERE op.canal = 'aaff' AND op.estado = 'cobrada'), 0) AS honorarios_cierres,
        COALESCE(SUM(op.honorarios_lae) FILTER (WHERE op.canal = 'aaff' AND op.estado = 'pipeline'), 0) AS honorarios_pipeline,
        -- Días desde última actividad
        CASE WHEN d.ultima_actividad IS NOT NULL
          THEN EXTRACT(DAY FROM NOW() - d.ultima_actividad)::int
          ELSE NULL END AS dias_sin_actividad
      FROM aaff_despachos d
      LEFT JOIN oficinas o ON o.id = d.oficina_id
      LEFT JOIN consultores c ON c.id = d.consultor_responsable_id
      LEFT JOIN operaciones op ON op.aaff_id = d.id
      WHERE ${where.join(' AND ')}
      GROUP BY d.id, o.nombre, c.nombre
      ORDER BY d.estado, d.nombre
    `, params);
    return rows;
  },

  async resumen() {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE estado = 'activo') AS activos,
        COUNT(*) FILTER (WHERE estado = 'reactivar') AS reactivar,
        COUNT(*) FILTER (WHERE estado = 'rescindir') AS rescindir,
        ROUND(COUNT(*) FILTER (WHERE estado = 'activo') * 100.0 / NULLIF(COUNT(*), 0), 1) AS pct_activos
      FROM aaff_despachos
    `);
    return rows[0];
  },

  async crear(data) {
    const { rows } = await pool.query(`
      INSERT INTO aaff_despachos (
        nombre, oficina_id, consultor_responsable_id,
        estado, pct_comision, fecha_alta, ultima_actividad, observaciones
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [
      data.nombre, data.oficina_id || null, data.consultor_responsable_id || null,
      data.estado || 'activo', data.pct_comision || 10,
      data.fecha_alta || new Date().toISOString().split('T')[0],
      data.ultima_actividad || new Date().toISOString().split('T')[0],
      data.observaciones || null
    ]);
    return rows[0];
  },

  async actualizarEstado(id, estado, observaciones) {
    const { rows } = await pool.query(`
      UPDATE aaff_despachos
      SET estado = $1, observaciones = COALESCE($2, observaciones)
      WHERE id = $3 RETURNING *
    `, [estado, observaciones || null, id]);
    return rows[0];
  },

  async registrarContacto(id) {
    const { rows } = await pool.query(`
      UPDATE aaff_despachos SET ultima_actividad = NOW() WHERE id = $1 RETURNING *
    `, [id]);
    return rows[0];
  },

  async eliminar(id) {
    await pool.query('DELETE FROM aaff_despachos WHERE id = $1', [id]);
  }
};

module.exports = AAFF;
