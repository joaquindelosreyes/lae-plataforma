const pool = require('../db/pool');

// Migración idempotente: soporte para segundo impuesto (ej. IVA + retención IRPF)
pool.query(`
  ALTER TABLE gastos ADD COLUMN IF NOT EXISTS tipo_impuesto2_desc VARCHAR(60);
  ALTER TABLE gastos ADD COLUMN IF NOT EXISTS pct_impuesto2 NUMERIC DEFAULT 0;
  ALTER TABLE gastos ADD COLUMN IF NOT EXISTS signo_impuesto2 VARCHAR(5) DEFAULT 'resta';
`).catch(() => {});

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
      const base   = parseFloat(data.base_imponible) || 0;
      const pct    = parseFloat(data.pct_impuesto) || 0;
      const pct2   = parseFloat(data.pct_impuesto2) || 0;
      const signo2 = data.signo_impuesto2 === 'suma' ? 'suma' : 'resta';
      const importe2 = base * pct2 / 100 * (signo2 === 'resta' ? -1 : 1);
      const total = base + base * pct / 100 + importe2;

      const { rows } = await client.query(`
        INSERT INTO gastos (
          concepto, categoria, fecha, periodicidad,
          base_imponible, tipo_impuesto_desc, pct_impuesto, total,
          fecha_vencimiento_contrato, alerta_renovacion, nota,
          tipo_impuesto2_desc, pct_impuesto2, signo_impuesto2
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING *
      `, [
        data.concepto, data.categoria || 'Otros', data.fecha, data.periodicidad || 'puntual',
        base, data.tipo_impuesto_desc || 'IVA 21%', pct, total,
        data.fecha_vencimiento_contrato || null,
        data.alerta_renovacion || false,
        data.nota || null,
        pct2 > 0 ? (data.tipo_impuesto2_desc || 'Retención IRPF') : null,
        pct2, signo2
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
