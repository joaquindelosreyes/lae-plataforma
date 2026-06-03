const pool = require('../db/pool');

const Captacion = {

  async listar({ oficina_id, mandato, tipologia, tipo_operacion, antiguedad, estado } = {}) {
    let where = ['1=1'];
    const params = [];
    let i = 1;
    if (oficina_id)    { where.push(`c.oficina_id = $${i++}`);   params.push(oficina_id); }
    if (mandato)       { where.push(`c.mandato = $${i++}`);      params.push(mandato); }
    if (tipologia)     { where.push(`c.tipologia = $${i++}`);    params.push(tipologia); }
    if (tipo_operacion){ where.push(`c.tipo_operacion = $${i++}`); params.push(tipo_operacion); }
    if (estado)        { where.push(`c.estado = $${i++}`);       params.push(estado); }
    if (antiguedad === '0-3m')  where.push(`c.fecha_captacion >= NOW() - INTERVAL '3 months'`);
    if (antiguedad === '4-6m')  where.push(`c.fecha_captacion BETWEEN NOW() - INTERVAL '6 months' AND NOW() - INTERVAL '3 months'`);
    if (antiguedad === '+7m')   where.push(`c.fecha_captacion < NOW() - INTERVAL '7 months'`);

    const { rows } = await pool.query(`
      SELECT c.*,
        o.nombre AS oficina_nombre,
        cons.nombre AS consultor_nombre,
        EXTRACT(MONTH FROM AGE(NOW(), c.fecha_captacion)) +
          EXTRACT(YEAR FROM AGE(NOW(), c.fecha_captacion)) * 12 AS meses_activa
      FROM captaciones c
      LEFT JOIN oficinas o ON o.id = c.oficina_id
      LEFT JOIN consultores cons ON cons.id = c.consultor_id
      WHERE ${where.join(' AND ')}
      ORDER BY c.fecha_captacion DESC
    `, params);
    return rows;
  },

  async resumen() {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE mandato = 'exclusiva') AS exclusivas,
        COUNT(*) FILTER (WHERE mandato = 'nota_encargo') AS notas_encargo,
        COUNT(*) FILTER (WHERE tipologia = 'vivienda') AS viviendas,
        COUNT(*) FILTER (WHERE tipologia = 'vivienda' AND mandato = 'exclusiva') AS viviendas_excl,
        COUNT(*) FILTER (WHERE tipologia = 'vivienda' AND mandato = 'nota_encargo') AS viviendas_ne,
        COUNT(*) FILTER (WHERE fecha_captacion < NOW() - INTERVAL '7 months' AND mandato = 'exclusiva' AND estado = 'activa') AS bloqueadas,
        COUNT(*) FILTER (WHERE fecha_captacion BETWEEN NOW() - INTERVAL '7 months' AND NOW() - INTERVAL '5 months' AND mandato = 'exclusiva' AND estado = 'activa') AS en_revision,
        COALESCE(SUM(precio_captacion), 0) AS valor_cartera,
        COALESCE(SUM(honorarios_potenciales), 0) AS honorarios_potenciales
      FROM captaciones WHERE estado = 'activa'
    `);
    return rows[0];
  },

  async matriz() {
    const { rows } = await pool.query(`
      SELECT
        tipologia,
        mandato,
        COUNT(*) AS num,
        COALESCE(SUM(precio_captacion), 0) AS valor,
        COALESCE(SUM(honorarios_potenciales), 0) AS honorarios
      FROM captaciones
      WHERE estado = 'activa'
      GROUP BY tipologia, mandato
      ORDER BY tipologia, mandato
    `);
    return rows;
  },

  async porOficina() {
    const { rows } = await pool.query(`
      SELECT
        o.id, o.nombre,
        COUNT(c.id) AS total,
        COUNT(c.id) FILTER (WHERE c.mandato = 'exclusiva') AS exclusivas,
        COUNT(c.id) FILTER (WHERE c.mandato = 'nota_encargo') AS notas_encargo,
        COALESCE(SUM(c.precio_captacion), 0) AS valor,
        COALESCE(SUM(c.honorarios_potenciales), 0) AS honorarios
      FROM oficinas o
      LEFT JOIN captaciones c ON c.oficina_id = o.id AND c.estado = 'activa'
      GROUP BY o.id, o.nombre
      ORDER BY total DESC
    `);
    return rows;
  },

  async crear(data) {
    const ref = 'CAP-' + Date.now().toString().slice(-6) + '-' + new Date().getFullYear();
    const precio = parseFloat(data.precio_captacion) || 0;
    const pct    = parseFloat(data.pct_honorarios) || 5;
    const honorarios_potenciales = precio * pct / 100;
    const vencimiento = data.fecha_captacion && data.duracion_mandato
      ? new Date(new Date(data.fecha_captacion).getTime() + data.duracion_mandato * 30 * 86400000).toISOString().split('T')[0]
      : null;

    const { rows } = await pool.query(`
      INSERT INTO captaciones (
        ref, fecha_captacion, direccion, municipio, provincia,
        oficina_id, consultor_id, mandato, tipologia, tipo_operacion,
        precio_captacion, pct_honorarios, honorarios_potenciales,
        superficie, estado_inmueble, canal_captacion,
        duracion_mandato, fecha_vencimiento, observaciones, estado
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'activa')
      RETURNING *
    `, [
      ref, data.fecha_captacion, data.direccion || null, data.municipio || null, data.provincia || null,
      data.oficina_id || null, data.consultor_id || null,
      data.mandato || 'exclusiva', data.tipologia || 'vivienda', data.tipo_operacion || 'cv',
      precio, pct, honorarios_potenciales,
      data.superficie || null, data.estado_inmueble || null, data.canal_captacion || null,
      data.duracion_mandato || 6, vencimiento, data.observaciones || null
    ]);
    return rows[0];
  },

  async actualizarEstado(id, estado) {
    const { rows } = await pool.query(
      'UPDATE captaciones SET estado=$1 WHERE id=$2 RETURNING *',
      [estado, id]
    );
    return rows[0];
  },

  async evolucionMensual(año) {
    const { rows } = await pool.query(`
      SELECT
        EXTRACT(MONTH FROM fecha_captacion)::int AS mes,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE mandato = 'exclusiva') AS exclusivas,
        COUNT(*) FILTER (WHERE mandato = 'nota_encargo') AS notas_encargo
      FROM captaciones
      WHERE EXTRACT(YEAR FROM fecha_captacion) = $1
      GROUP BY mes ORDER BY mes
    `, [año]);
    return rows;
  }
};

module.exports = Captacion;
