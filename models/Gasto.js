const pool = require('../db/pool');

const Gasto = {

  async listar({ oficina_id, categoria, desde, hasta } = {}) {
    let where = ['1=1'];
    const params = [];
    let i = 1;
    if (categoria) { where.push(`g.categoria = $${i++}`); params.push(categoria); }
    if (desde)     { where.push(`g.fecha >= $${i++}`);    params.push(desde); }
    if (hasta)     { where.push(`g.fecha <= $${i++}`);    params.push(hasta); }
    if (oficina_id) {
      where.push(`EXISTS (SELECT 1 FROM gastos_oficinas go WHERE go.gasto_id = g.id AND go.oficina_id = $${i++})`);
      params.push(oficina_id);
    }

    const { rows } = await pool.query(`
      SELECT g.*,
        COALESCE(
          string_agg(DISTINCT o.nombre, ', ' ORDER BY o.nombre),
          'Central'
        ) AS oficinas
      FROM gastos g
      LEFT JOIN gastos_oficinas go ON go.gasto_id = g.id
      LEFT JOIN oficinas o ON o.id = go.oficina_id
      WHERE ${where.join(' AND ')}
      GROUP BY g.id
      ORDER BY g.fecha DESC
    `, params);
    return rows;
  },

  async resumen({ desde, hasta } = {}) {
    let where = ['1=1'];
    const params = [];
    let i = 1;
    if (desde) { where.push(`fecha >= $${i++}`); params.push(desde); }
    if (hasta) { where.push(`fecha <= $${i++}`); params.push(hasta); }

    const { rows } = await pool.query(`
      SELECT
        COALESCE(SUM(total), 0) AS total_gastos,
        COALESCE(SUM(total) FILTER (WHERE periodicidad != 'puntual'), 0) AS gastos_periodicos,
        COALESCE(SUM(total) FILTER (WHERE periodicidad = 'puntual'), 0) AS gastos_variables,
        COUNT(*) AS num_gastos,
        COUNT(*) FILTER (WHERE fecha_vencimiento_contrato IS NOT NULL AND fecha_vencimiento_contrato <= NOW() + INTERVAL '60 days') AS vencimientos_proximos
      FROM gastos WHERE ${where.join(' AND ')}
    `, params);
    return rows[0];
  },

  async crear(data, oficina_ids = []) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const base = parseFloat(data.base_imponible) || 0;
      const pct  = parseFloat(data.pct_impuesto) || 0;
      const total = base + base * pct / 100;

      const { rows } = await client.query(`
        INSERT INTO gastos (
          concepto, categoria, fecha, periodicidad,
          base_imponible, tipo_impuesto_desc, pct_impuesto, total,
          fecha_vencimiento_contrato, alerta_renovacion, nota
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *
      `, [
        data.concepto, data.categoria || 'Otros', data.fecha, data.periodicidad || 'puntual',
        base, data.tipo_impuesto_desc || 'IVA 21%', pct, total,
        data.fecha_vencimiento_contrato || null,
        data.alerta_renovacion || false,
        data.nota || null
      ]);

      const gasto = rows[0];
      if (oficina_ids.length) {
        for (const oid of oficina_ids) {
          await client.query(
            'INSERT INTO gastos_oficinas (gasto_id, oficina_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
            [gasto.id, oid]
          );
        }
      }

      await client.query('COMMIT');
      return gasto;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  async eliminar(id) {
    await pool.query('DELETE FROM gastos WHERE id = $1', [id]);
  }
};

module.exports = Gasto;
