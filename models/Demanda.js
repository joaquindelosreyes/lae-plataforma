const pool = require('../db/pool');

const SITUACION_ACTIVA = ['Buscando', 'En Espera', 'Pendiente Revisión', 'Oferta Realizada', 'Negociando', 'Realizada Reserva', 'Contrato Arras'];
const SITUACION_CONVERTIDA = ['Vendido', 'Alquilado', 'Han encontrado', 'Vendido Mls'];
const SITUACION_PERDIDA = ['Ya no buscan', 'Descartado'];

const Demanda = {

  async resumen({ oficina_id, desde, hasta } = {}) {
    let where = ['1=1'];
    const params = [];
    let i = 1;
    if (oficina_id) { where.push(`oficina_id = $${i++}`); params.push(oficina_id); }
    if (desde) { where.push(`fecha_alta_demanda >= $${i++}`); params.push(desde); }
    if (hasta) { where.push(`fecha_alta_demanda <= $${i++}`); params.push(hasta); }

    const { rows } = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE situacion IN (${SITUACION_ACTIVA.map((_,j) => `$${i+j}`).join(',')})) AS activos,
        COUNT(*) FILTER (WHERE situacion IN (${SITUACION_CONVERTIDA.map((_,j) => `$${i+SITUACION_ACTIVA.length+j}`).join(',')})) AS convertidos,
        COUNT(*) FILTER (WHERE situacion IN (${SITUACION_PERDIDA.map((_,j) => `$${i+SITUACION_ACTIVA.length+SITUACION_CONVERTIDA.length+j}`).join(',')})) AS perdidos,
        COUNT(*) FILTER (WHERE situacion = 'Buscando') AS buscando,
        COUNT(*) FILTER (WHERE situacion = 'Contrato Arras') AS arras,
        COUNT(*) FILTER (WHERE situacion = 'Realizada Reserva') AS reservas,
        ROUND(COUNT(*) FILTER (WHERE situacion IN (${SITUACION_CONVERTIDA.map((_,j) => `$${i+SITUACION_ACTIVA.length+j}`).join(',')})) * 100.0 / NULLIF(COUNT(*), 0), 1) AS tasa_conversion
      FROM demandas
      WHERE ${where.join(' AND ')}
    `, [...params, ...SITUACION_ACTIVA, ...SITUACION_CONVERTIDA, ...SITUACION_PERDIDA]);
    return rows[0];
  },

  async porOficina({ desde, hasta } = {}) {
    let where = ['1=1'];
    const params = [];
    let i = 1;
    if (desde) { where.push(`d.fecha_alta_demanda >= $${i++}`); params.push(desde); }
    if (hasta) { where.push(`d.fecha_alta_demanda <= $${i++}`); params.push(hasta); }

    const { rows } = await pool.query(`
      SELECT o.nombre,
        COUNT(d.id) AS total,
        COUNT(d.id) FILTER (WHERE d.situacion = 'Buscando') AS buscando,
        COUNT(d.id) FILTER (WHERE d.situacion IN ('Vendido','Alquilado','Han encontrado','Vendido Mls')) AS convertidos,
        COUNT(d.id) FILTER (WHERE d.situacion = 'Contrato Arras') AS arras,
        COUNT(d.id) FILTER (WHERE d.situacion = 'Realizada Reserva') AS reservas,
        ROUND(COUNT(d.id) FILTER (WHERE d.situacion IN ('Vendido','Alquilado','Han encontrado','Vendido Mls')) * 100.0 / NULLIF(COUNT(d.id),0), 1) AS tasa_conversion
      FROM oficinas o
      LEFT JOIN demandas d ON d.oficina_id = o.id AND ${where.join(' AND ')}
      GROUP BY o.id, o.nombre
      ORDER BY total DESC
    `, params);
    return rows;
  },

  async porCanal({ oficina_id, desde, hasta } = {}) {
    let where = ['1=1'];
    const params = [];
    let i = 1;
    if (oficina_id) { where.push(`oficina_id = $${i++}`); params.push(oficina_id); }
    if (desde) { where.push(`fecha_alta_demanda >= $${i++}`); params.push(desde); }
    if (hasta) { where.push(`fecha_alta_demanda <= $${i++}`); params.push(hasta); }

    const { rows } = await pool.query(`
      SELECT
        COALESCE(NULLIF(medio_contacto,''), 'Sin canal') AS canal,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE situacion IN ('Vendido','Alquilado','Han encontrado','Vendido Mls')) AS convertidos,
        ROUND(COUNT(*) FILTER (WHERE situacion IN ('Vendido','Alquilado','Han encontrado','Vendido Mls')) * 100.0 / NULLIF(COUNT(*),0), 1) AS tasa_conversion
      FROM demandas
      WHERE ${where.join(' AND ')}
      GROUP BY canal
      ORDER BY total DESC
      LIMIT 12
    `, params);
    return rows;
  },

  async porConsultor({ oficina_id, desde, hasta } = {}) {
    let where = ['1=1'];
    const params = [];
    let i = 1;
    if (oficina_id) { where.push(`d.oficina_id = $${i++}`); params.push(oficina_id); }
    if (desde) { where.push(`d.fecha_alta_demanda >= $${i++}`); params.push(desde); }
    if (hasta) { where.push(`d.fecha_alta_demanda <= $${i++}`); params.push(hasta); }

    const { rows } = await pool.query(`
      SELECT
        d.consultor_nombre AS consultor,
        o.nombre AS oficina,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE d.situacion = 'Buscando') AS buscando,
        COUNT(*) FILTER (WHERE d.situacion IN ('Vendido','Alquilado','Han encontrado')) AS convertidos,
        ROUND(COUNT(*) FILTER (WHERE d.situacion IN ('Vendido','Alquilado','Han encontrado')) * 100.0 / NULLIF(COUNT(*),0), 1) AS tasa_conversion
      FROM demandas d
      LEFT JOIN oficinas o ON o.id = d.oficina_id
      WHERE ${where.join(' AND ')}
      GROUP BY d.consultor_nombre, o.nombre
      ORDER BY total DESC
      LIMIT 30
    `, params);
    return rows;
  },

  async evolucionMensual(año) {
    const { rows } = await pool.query(`
      SELECT
        EXTRACT(MONTH FROM fecha_alta_demanda)::int AS mes,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE situacion = 'Buscando') AS activos,
        COUNT(*) FILTER (WHERE situacion IN ('Vendido','Alquilado','Han encontrado')) AS convertidos
      FROM demandas
      WHERE EXTRACT(YEAR FROM fecha_alta_demanda) = $1
      GROUP BY mes ORDER BY mes
    `, [año]);
    return rows;
  }
};

module.exports = Demanda;
