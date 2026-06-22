const router = require('express').Router();
const pool = require('../db/pool');

// Calcula el ritmo esperado según la fecha actual o período indicado
function ritmoEsperado(año) {
  const hoy = new Date();
  const inicio = new Date(año, 0, 1);
  const fin    = new Date(año, 11, 31);
  const total  = (fin - inicio) / 86400000;
  const transcurridos = Math.min((hoy - inicio) / 86400000, total);
  return Math.round(transcurridos / total * 100 * 10) / 10;
}

// GET /api/palancas?año=2026
router.get('/', async (req, res) => {
  try {
    const año = parseInt(req.query.año) || new Date().getFullYear();
    const ritmo = ritmoEsperado(año);

    // 1. Honorarios LAE por oficina (desde seguimiento)
    const { rows: honor } = await pool.query(`
      SELECT o.id, o.nombre, o.objetivo_anual, o.objetivo_aaff,
        COALESCE(SUM(s.cobrado), 0)      AS cobrado,
        COALESCE(SUM(s.captaciones), 0)  AS captaciones,
        COALESCE(SUM(s.cierres), 0)      AS cierres,
        COALESCE(MAX(s.aaff_activos), 0) AS aaff_activos
      FROM oficinas o
      LEFT JOIN seguimiento s ON s.oficina_id = o.id AND s.año = $1
      WHERE o.nombre != 'Santander'
      GROUP BY o.id, o.nombre, o.objetivo_anual, o.objetivo_aaff
      ORDER BY o.nombre
    `, [año]);

    // 2. Ingresos generados (pipeline) por oficina
    const { rows: genRows } = await pool.query(`
      SELECT oficina_id, COALESCE(SUM(honorarios_lae), 0) AS generado
      FROM operaciones
      WHERE estado = 'pipeline' AND EXTRACT(YEAR FROM fecha) = $1
      GROUP BY oficina_id
    `, [año]).catch(() => ({ rows: [] }));

    const genMap = {};
    genRows.forEach(g => { genMap[g.oficina_id] = parseFloat(g.generado); });

    // 3. Captaciones exclusivas activas por oficina (desde tabla captaciones si existe)
    const { rows: capt } = await pool.query(`
      SELECT oficina_id, COUNT(*) AS excl_activas
      FROM captaciones
      WHERE mandato = 'exclusiva' AND estado = 'activa'
      GROUP BY oficina_id
    `).catch(() => ({ rows: [] }));

    const captMap = {};
    capt.forEach(c => { captMap[c.oficina_id] = parseInt(c.excl_activas); });

    // 4. AAFF activos desde aaff_despachos (más actualizado que seguimiento)
    const { rows: aaffRows } = await pool.query(`
      SELECT oficina_id, COUNT(*) FILTER (WHERE estado='activo') AS activos, COUNT(*) AS total
      FROM aaff_despachos GROUP BY oficina_id
    `).catch(() => ({ rows: [] }));

    const aaffMap = {};
    aaffRows.forEach(a => { aaffMap[a.oficina_id] = { activos: parseInt(a.activos), total: parseInt(a.total) }; });

    // Clasificar % vs ritmo
    function semaforo(pct, ritmoEsp) {
      if (ritmoEsp === 0) return 'sin_datos';
      const ratio = pct / ritmoEsp;
      if (ratio >= 1.1)  return 'verde';   // >110% del ritmo
      if (ratio >= 0.85) return 'ambar';   // 85-110%
      return 'rojo';                        // <85%
    }

    function icono(sem) {
      return { verde: '↑', ambar: '→', rojo: '↓', sin_datos: '—' }[sem];
    }

    const oficinas = honor.map(o => {
      const objAnual  = parseFloat(o.objetivo_anual) || 1;
      const objAAFF   = parseFloat(o.objetivo_aaff)  || 1;
      const cobrado   = parseFloat(o.cobrado);
      const captTotSeg = parseInt(o.captaciones);
      const cierres   = parseInt(o.cierres);
      const aaffActSeg = parseInt(o.aaff_activos);

      // Usar datos de tablas específicas si existen, sino seguimiento
      const exclActivas = captMap[o.id] ?? null;
      const aaffObj     = aaffMap[o.id];
      const aaffActivos = aaffObj ? aaffObj.activos : aaffActSeg;
      const aaffTotal   = aaffObj ? aaffObj.total   : null;
      const generado    = genMap[o.id] ?? null;

      // % cumplimiento de cada palanca
      const pctHonor    = Math.round(cobrado / objAnual * 100 * 10) / 10;
      const pctAAFF     = aaffActivos > 0 ? Math.round(aaffActivos / objAAFF * 100 * 10) / 10 : 0;
      const pctGenerado = generado !== null ? Math.round(generado / objAnual * 100 * 10) / 10 : 0;

      // Para captaciones y cierres, estimamos objetivo proporcional desde planes
      // (sin datos históricos de captaciones usamos seguimiento)
      const captPct    = captTotSeg > 0 ? Math.round(captTotSeg / Math.max(captTotSeg * (100/ritmo), 1) * ritmo * 10) / 10 : 0;
      const cierresPct = cierres > 0 ? Math.round(cierres / Math.max(cierres * (100/ritmo), 1) * ritmo * 10) / 10 : 0;

      const palancas = {
        honor_lae:   { pct: pctHonor,    sem: semaforo(pctHonor, ritmo),    icono: icono(semaforo(pctHonor, ritmo)),    valor: cobrado },
        generado:    { pct: pctGenerado, sem: generado !== null ? semaforo(pctGenerado, ritmo) : 'sin_datos', icono: generado !== null ? icono(semaforo(pctGenerado, ritmo)) : '—', valor: generado ?? 0 },
        captaciones: { pct: captPct,     sem: captTotSeg > 0 ? semaforo(captPct, ritmo) : 'sin_datos', icono: captTotSeg > 0 ? icono(semaforo(captPct, ritmo)) : '—', valor: captTotSeg },
        cierres:     { pct: cierresPct,  sem: cierres > 0 ? semaforo(cierresPct, ritmo) : 'sin_datos', icono: cierres > 0 ? icono(semaforo(cierresPct, ritmo)) : '—', valor: cierres },
        aaff_activos:{ pct: pctAAFF,     sem: semaforo(pctAAFF, ritmo),     icono: icono(semaforo(pctAAFF, ritmo)),     valor: aaffActivos },
        cartera_excl:{ pct: exclActivas !== null ? Math.round(exclActivas / Math.max(exclActivas*(100/ritmo),1)*ritmo*10)/10 : 0,
                       sem: exclActivas !== null ? semaforo(Math.round(exclActivas/(Math.max(exclActivas*(100/ritmo),1))*ritmo*10)/10, ritmo) : 'sin_datos',
                       icono: exclActivas !== null ? icono(semaforo(0, 1)) : '—', valor: exclActivas ?? captTotSeg }
      };

      return {
        id: o.id, nombre: o.nombre, objetivo_anual: objAnual,
        cobrado, captaciones: captTotSeg, cierres, aaff_activos: aaffActivos,
        palancas
      };
    });

    // Resumen por palanca (media de red)
    const palancaKeys = ['honor_lae','generado','captaciones','cierres','aaff_activos','cartera_excl'];
    const resumenPalancas = {};
    palancaKeys.forEach(k => {
      const vals = oficinas.map(o => o.palancas[k].pct).filter(p => p > 0);
      const media = vals.length ? Math.round(vals.reduce((a,b) => a+b, 0) / vals.length * 10) / 10 : 0;
      const sem = semaforo(media, ritmo);
      resumenPalancas[k] = { media, sem, icono: icono(sem) };
    });

    // Alertas: oficinas con más de 2 palancas en rojo
    const alertas = oficinas
      .map(o => ({
        ...o,
        rojas: Object.values(o.palancas).filter(p => p.sem === 'rojo').length,
        ambares: Object.values(o.palancas).filter(p => p.sem === 'ambar').length
      }))
      .filter(o => o.rojas >= 2)
      .sort((a,b) => b.rojas - a.rojas);

    res.json({
      success: true,
      data: {
        ritmo_esperado: ritmo,
        año,
        fecha_calculo: new Date().toISOString(),
        oficinas,
        resumen_palancas: resumenPalancas,
        alertas,
        contadores: {
          verde:  oficinas.filter(o => Object.values(o.palancas).filter(p=>p.sem==='verde').length >= 3).length,
          ambar:  oficinas.filter(o => !Object.values(o.palancas).every(p=>p.sem==='verde') && Object.values(o.palancas).filter(p=>p.sem==='rojo').length < 2).length,
          rojo:   oficinas.filter(o => Object.values(o.palancas).filter(p=>p.sem==='rojo').length >= 2).length
        }
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
