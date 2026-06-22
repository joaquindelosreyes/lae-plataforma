const router = require('express').Router();
const pool = require('../db/pool');

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const pad = n => String(n).padStart(2, '0');

// GET /api/palancas
// 5 palancas: Ventas mes, Captaciones mes, Viviendas en exclusiva,
// Valor cartera viviendas excl., Honorarios potenciales cartera excl.
router.get('/', async (req, res) => {
  try {
    const hoy = new Date();
    const mesInicio = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-01`;
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    const mesFin = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(ultimoDia)}`;
    const mesLabel = `${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`;

    const { rows: oficinasBase } = await pool.query(`
      SELECT id, nombre FROM oficinas WHERE nombre != 'Santander' ORDER BY nombre
    `);

    // 1. Ventas del mes (operaciones cerradas)
    const { rows: ventasRows } = await pool.query(`
      SELECT oficina_id, COUNT(*) AS ventas
      FROM operaciones
      WHERE estado = 'cobrada' AND fecha BETWEEN $1 AND $2
      GROUP BY oficina_id
    `, [mesInicio, mesFin]);
    const ventasMap = {};
    ventasRows.forEach(v => { ventasMap[v.oficina_id] = parseInt(v.ventas); });

    // 2. Captaciones del mes
    const { rows: captRows } = await pool.query(`
      SELECT oficina_id, COUNT(*) AS captaciones
      FROM captaciones
      WHERE fecha_captacion BETWEEN $1 AND $2
      GROUP BY oficina_id
    `, [mesInicio, mesFin]);
    const captMap = {};
    captRows.forEach(c => { captMap[c.oficina_id] = parseInt(c.captaciones); });

    // 3, 4, 5. Cartera de viviendas en exclusiva activas: nº, valor, honorarios potenciales
    const { rows: excRows } = await pool.query(`
      SELECT oficina_id,
        COUNT(*) AS viviendas_excl,
        COALESCE(SUM(precio_captacion), 0) AS valor_cartera_excl,
        COALESCE(SUM(honorarios_potenciales), 0) AS honorarios_potenciales_excl
      FROM captaciones
      WHERE mandato = 'exclusiva' AND tipologia = 'vivienda' AND estado = 'activa'
      GROUP BY oficina_id
    `);
    const excMap = {};
    excRows.forEach(e => {
      excMap[e.oficina_id] = {
        viviendas: parseInt(e.viviendas_excl),
        valor: parseFloat(e.valor_cartera_excl),
        honorarios: parseFloat(e.honorarios_potenciales_excl),
      };
    });

    const oficinas = oficinasBase.map(o => {
      const exc = excMap[o.id] || { viviendas: 0, valor: 0, honorarios: 0 };
      return {
        id: o.id,
        nombre: o.nombre,
        ventas_mes: ventasMap[o.id] || 0,
        captaciones_mes: captMap[o.id] || 0,
        viviendas_excl: exc.viviendas,
        valor_cartera_excl: exc.valor,
        honorarios_potenciales_excl: exc.honorarios,
      };
    });

    const totales = oficinas.reduce((acc, o) => ({
      ventas_mes: acc.ventas_mes + o.ventas_mes,
      captaciones_mes: acc.captaciones_mes + o.captaciones_mes,
      viviendas_excl: acc.viviendas_excl + o.viviendas_excl,
      valor_cartera_excl: acc.valor_cartera_excl + o.valor_cartera_excl,
      honorarios_potenciales_excl: acc.honorarios_potenciales_excl + o.honorarios_potenciales_excl,
    }), { ventas_mes: 0, captaciones_mes: 0, viviendas_excl: 0, valor_cartera_excl: 0, honorarios_potenciales_excl: 0 });

    res.json({ success: true, data: { mes_label: mesLabel, oficinas, totales } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
