const pool = require('../db/pool');

const Operacion = {

  async listar({ oficina_id, estado, canal, desde, hasta, limit = 100, offset = 0 } = {}) {
    let where = ['1=1'];
    const params = [];
    let i = 1;
    if (oficina_id) { where.push(`o.oficina_id = $${i++}`); params.push(oficina_id); }
    if (estado)     { where.push(`o.estado = $${i++}`);     params.push(estado); }
    if (canal)      { where.push(`o.canal = $${i++}`);      params.push(canal); }
    if (desde)      { where.push(`o.fecha >= $${i++}`);     params.push(desde); }
    if (hasta)      { where.push(`o.fecha <= $${i++}`);     params.push(hasta); }
    params.push(limit, offset);

    const { rows } = await pool.query(`
      SELECT o.*,
        of.nombre AS oficina_nombre,
        cc.nombre AS captador_nombre,
        cv.nombre AS vendedor_nombre
      FROM operaciones o
      LEFT JOIN oficinas of ON of.id = o.oficina_id
      LEFT JOIN consultores cc ON cc.id = o.consultor_captador_id
      LEFT JOIN consultores cv ON cv.id = o.consultor_vendedor_id
      WHERE ${where.join(' AND ')}
      ORDER BY o.fecha DESC
      LIMIT $${i++} OFFSET $${i++}
    `, params);
    return rows;
  },

  async porId(id) {
    const { rows } = await pool.query(`
      SELECT o.*,
        of.nombre AS oficina_nombre,
        cc.nombre AS captador_nombre,
        cv.nombre AS vendedor_nombre
      FROM operaciones o
      LEFT JOIN oficinas of ON of.id = o.oficina_id
      LEFT JOIN consultores cc ON cc.id = o.consultor_captador_id
      LEFT JOIN consultores cv ON cv.id = o.consultor_vendedor_id
      WHERE o.id = $1
    `, [id]);
    return rows[0];
  },

  async crear(data) {
    const ref = 'OP-' + Date.now().toString().slice(-6) + '-' + new Date().getFullYear();
    const comision_bruta = (data.precio_inmueble || 0) * (data.pct_comision || 5) / 100;
    const honorarios_lae = data.compartida
      ? comision_bruta * (data.split_pct || 50) / 100
      : comision_bruta;

    const { rows } = await pool.query(`
      INSERT INTO operaciones (
        ref, fecha, tipo_ingreso, tipo_operacion, tipo_atipico,
        oficina_id, direccion, municipio,
        consultor_captador_id, pct_captador,
        consultor_vendedor_id, pct_vendedor,
        precio_inmueble, pct_comision, comision_bruta, honorarios_lae,
        canal, compartida, agencia_externa, split_pct,
        aaff_id, pct_aaff, importe_aaff,
        estado, fecha_cobro, observaciones
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
        $17,$18,$19,$20,$21,$22,$23,$24,$25,$26
      ) RETURNING *
    `, [
      ref, data.fecha, data.tipo_ingreso || 'inmobiliaria', data.tipo_operacion, data.tipo_atipico,
      data.oficina_id, data.direccion, data.municipio,
      data.consultor_captador_id || null, data.pct_captador || 0,
      data.consultor_vendedor_id || null, data.pct_vendedor || 0,
      data.precio_inmueble || 0, data.pct_comision || 5, comision_bruta, data.honorarios_lae || honorarios_lae,
      data.canal || 'directa', data.compartida || false, data.agencia_externa || null, data.split_pct || 50,
      data.aaff_id || null, data.pct_aaff || 0, data.importe_aaff || 0,
      data.estado || 'pipeline', data.fecha_cobro || null, data.observaciones || null
    ]);
    return rows[0];
  },

  async actualizar(id, data) {
    const campos = [];
    const valores = [];
    let i = 1;
    const permitidos = [
      'fecha','tipo_ingreso','tipo_operacion','tipo_atipico','oficina_id','direccion','municipio',
      'consultor_captador_id','pct_captador','consultor_vendedor_id','pct_vendedor',
      'precio_inmueble','pct_comision','comision_bruta','honorarios_lae',
      'canal','compartida','agencia_externa','split_pct',
      'aaff_id','pct_aaff','importe_aaff','estado','fecha_cobro','observaciones'
    ];
    for (const k of permitidos) {
      if (data[k] !== undefined) {
        campos.push(`${k} = $${i++}`);
        valores.push(data[k]);
      }
    }
    if (!campos.length) throw new Error('Sin datos para actualizar');
    campos.push(`updated_at = NOW()`);
    valores.push(id);
    const { rows } = await pool.query(
      `UPDATE operaciones SET ${campos.join(', ')} WHERE id = $${i} RETURNING *`,
      valores
    );
    return rows[0];
  },

  async eliminar(id) {
    await pool.query('DELETE FROM operaciones WHERE id = $1', [id]);
  },

  async resumen({ oficina_id, desde, hasta } = {}) {
    let where = ['1=1'];
    const params = [];
    let i = 1;
    if (oficina_id) { where.push(`oficina_id = $${i++}`); params.push(oficina_id); }
    if (desde)      { where.push(`fecha >= $${i++}`);     params.push(desde); }
    if (hasta)      { where.push(`fecha <= $${i++}`);     params.push(hasta); }

    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE tipo_ingreso='inmobiliaria') AS ops_inmobiliarias,
        COUNT(*) FILTER (WHERE tipo_ingreso='atipico') AS ops_atipicas,
        COALESCE(SUM(honorarios_lae) FILTER (WHERE estado='cobrada'), 0) AS cobrado,
        COALESCE(SUM(honorarios_lae) FILTER (WHERE estado='pipeline'), 0) AS pipeline,
        COALESCE(SUM(honorarios_lae) FILTER (WHERE estado='pendiente_escritura'), 0) AS pendiente_escritura,
        COALESCE(SUM(GREATEST(honorarios_brutos, comision_bruta)) FILTER (WHERE estado='cobrada'), 0) AS cobrado_bruto,
        COALESCE(SUM(GREATEST(honorarios_brutos, comision_bruta)) FILTER (WHERE estado='pipeline'), 0) AS pipeline_bruto,
        COALESCE(SUM(honorarios_lae) FILTER (WHERE canal='directa' AND estado='cobrada'), 0) AS cobrado_directa,
        COALESCE(SUM(honorarios_lae) FILTER (WHERE canal='aaff' AND estado='cobrada'), 0) AS cobrado_aaff,
        COALESCE(SUM(honorarios_lae) FILTER (WHERE canal='prescriptor' AND estado='cobrada'), 0) AS cobrado_prescriptor,
        COALESCE(SUM(honorarios_lae) FILTER (WHERE canal='compartida' AND estado='cobrada'), 0) AS cobrado_compartida
      FROM operaciones
      WHERE ${where.join(' AND ')}
    `, params);
    return rows[0];
  },

  async porOficinaTipoCanal({ desde, hasta } = {}) {
    let where = [`o.tipo_ingreso = 'inmobiliaria'`];
    const params = [];
    let i = 1;
    if (desde) { where.push(`o.fecha >= $${i++}`); params.push(desde); }
    if (hasta) { where.push(`o.fecha <= $${i++}`); params.push(hasta); }

    const { rows } = await pool.query(`
      SELECT
        of.id, of.nombre,
        COUNT(o.id) FILTER (WHERE o.tipo_operacion = 'cv')                                AS ops_venta,
        COUNT(o.id) FILTER (WHERE o.tipo_operacion = 'alquiler')                           AS ops_alquiler,
        COUNT(o.id) FILTER (WHERE o.tipo_operacion = 'cv' AND o.canal = 'aaff')            AS ops_venta_aaff,
        COUNT(o.id) FILTER (WHERE o.tipo_operacion = 'alquiler' AND o.canal = 'aaff')      AS ops_alquiler_aaff
      FROM oficinas of
      LEFT JOIN operaciones o ON o.oficina_id = of.id AND ${where.join(' AND ')}
      GROUP BY of.id, of.nombre
      ORDER BY (COUNT(o.id) FILTER (WHERE o.tipo_operacion='cv') + COUNT(o.id) FILTER (WHERE o.tipo_operacion='alquiler')) DESC
    `, params);
    return rows;
  },

  async porOficinaTipoCanalEuros({ desde, hasta } = {}) {
    let where = [`o.tipo_ingreso = 'inmobiliaria'`];
    const params = [];
    let i = 1;
    if (desde) { where.push(`o.fecha >= $${i++}`); params.push(desde); }
    if (hasta) { where.push(`o.fecha <= $${i++}`); params.push(hasta); }

    const { rows } = await pool.query(`
      SELECT
        of.id, of.nombre,
        COALESCE(SUM(o.honorarios_lae) FILTER (WHERE o.tipo_operacion = 'cv'), 0)                           AS eur_venta,
        COALESCE(SUM(o.honorarios_lae) FILTER (WHERE o.tipo_operacion = 'alquiler'), 0)                     AS eur_alquiler,
        COALESCE(SUM(o.honorarios_lae) FILTER (WHERE o.tipo_operacion = 'cv' AND o.canal = 'aaff'), 0)      AS eur_venta_aaff,
        COALESCE(SUM(o.honorarios_lae) FILTER (WHERE o.tipo_operacion = 'alquiler' AND o.canal = 'aaff'), 0) AS eur_alquiler_aaff
      FROM oficinas of
      LEFT JOIN operaciones o ON o.oficina_id = of.id AND ${where.join(' AND ')}
      GROUP BY of.id, of.nombre
      ORDER BY (COALESCE(SUM(o.honorarios_lae) FILTER (WHERE o.tipo_operacion='cv'),0) + COALESCE(SUM(o.honorarios_lae) FILTER (WHERE o.tipo_operacion='alquiler'),0)) DESC
    `, params);
    return rows;
  },

  async porOficina({ desde, hasta } = {}) {
    let where = ['1=1'];
    const params = [];
    let i = 1;
    if (desde) { where.push(`o.fecha >= $${i++}`); params.push(desde); }
    if (hasta) { where.push(`o.fecha <= $${i++}`); params.push(hasta); }

    const { rows } = await pool.query(`
      SELECT
        of.id, of.nombre,
        of.objetivo_anual,
        COALESCE(SUM(o.honorarios_lae) FILTER (WHERE o.estado='cobrada'), 0) AS cobrado,
        COALESCE(SUM(o.honorarios_lae) FILTER (WHERE o.estado='pipeline'), 0) AS pipeline,
        COUNT(*) FILTER (WHERE o.estado='cobrada') AS cierres,
        CASE WHEN of.objetivo_anual > 0
          THEN ROUND(COALESCE(SUM(o.honorarios_lae) FILTER (WHERE o.estado='cobrada'), 0) / of.objetivo_anual * 100, 1)
          ELSE 0 END AS pct_cumplimiento
      FROM oficinas of
      LEFT JOIN operaciones o ON o.oficina_id = of.id AND ${where.join(' AND ')}
      GROUP BY of.id, of.nombre, of.objetivo_anual
      ORDER BY cobrado DESC
    `, params);
    return rows;
  }
};

module.exports = Operacion;
