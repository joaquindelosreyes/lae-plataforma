const router   = require('express').Router();
const multer   = require('multer');
const { parse } = require('csv-parse/sync');
const pool     = require('../db/pool');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Migración idempotente: columna fuente para distinguir Inmovilla vs manual
pool.query(`
  ALTER TABLE captaciones  ADD COLUMN IF NOT EXISTS fuente VARCHAR(20) DEFAULT 'manual';
  ALTER TABLE operaciones   ADD COLUMN IF NOT EXISTS fuente VARCHAR(20) DEFAULT 'manual';
  ALTER TABLE demandas      ADD COLUMN IF NOT EXISTS fuente VARCHAR(20) DEFAULT 'inmovilla';
`).catch(() => {});

// Mapa sucursal_id → nombre oficina LAE
const SUCURSAL_MAP = {
  '10385': 'San Sebastián',
  '10386': 'Marbella',
  '10396': 'Valencia',
  '10397': 'Barcelona',
  '10398': 'Málaga',
  '10399': 'Madrid',
  '10400': 'Sevilla',
  '10401': 'Alicante',
  '10852': 'Santander',
  '11318': 'Jaén',
  '13442': 'Castellón',
};

const ESTADOS_ACTIVOS = new Set([
  'Libre','Reservado','Señalizada','Contrato Arras',
  'En Trámites','Pendiente de Firma','No Libre','Sólo Seguimiento'
]);

const ESTADOS_CERRADOS = new Set(['Vendida','Alquilada']);

function mapTipoOp(tipoInmovilla) {
  const t = (tipoInmovilla || '').toLowerCase();
  if (t.includes('alquil')) return 'alquiler';
  return 'cv';
}

function mapTipologia(tipo) {
  const t = (tipo || '').toLowerCase();
  if (t.includes('apart') || t.includes('piso') || t.includes('ático') || t.includes('atico') || t.includes('estudio') || t.includes('casa') || t.includes('chalet') || t.includes('villa') || t.includes('bungal') || t.includes('duplex') || t.includes('dúplex')) return 'vivienda';
  if (t.includes('solar') || t.includes('terreno') || t.includes('parcela')) return 'solar';
  if (t.includes('local') || t.includes('comercial')) return 'local';
  if (t.includes('garaje') || t.includes('parking') || t.includes('plaza')) return 'garaje';
  if (t.includes('trastero')) return 'trastero';
  if (t.includes('oficina') || t.includes('despacho')) return 'oficina';
  if (t.includes('nave') || t.includes('industrial') || t.includes('almac')) return 'nave';
  if (t.includes('finca') || t.includes('rústic') || t.includes('rustic')) return 'finca';
  return 'vivienda';
}

// POST /api/import/inmovilla
// Estrategia: reemplaza completamente los datos de Inmovilla.
// Las operaciones manuales (fuente='manual') no se tocan.
router.post('/inmovilla', upload.single('archivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No se recibió ningún archivo' });

  const client = await pool.connect();
  try {
    const content = req.file.buffer.toString('latin1');
    const rows = parse(content, {
      delimiter: ';',
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    const { rows: oficinas } = await client.query('SELECT id, nombre FROM oficinas');
    const oficinaMap = {};
    oficinas.forEach(o => { oficinaMap[o.nombre] = o.id; });

    const { rows: consultores } = await client.query('SELECT id, nombre FROM consultores');
    const consultorMap = {};
    consultores.forEach(c => { consultorMap[c.nombre.toLowerCase()] = c.id; });

    await client.query('BEGIN');

    // Borrar datos previos de Inmovilla — las entradas manuales se conservan
    await client.query(`DELETE FROM captaciones WHERE fuente = 'inmovilla'`);
    await client.query(`DELETE FROM operaciones  WHERE fuente = 'inmovilla'`);

    const stats = { captaciones_nuevas: 0, operaciones_nuevas: 0, errores: 0, ignoradas: 0 };
    const errores = [];

    for (const row of rows) {
      try {
        const sucursal      = (row['Sucursal'] || '').trim();
        const oficinaNombre = SUCURSAL_MAP[sucursal];
        if (!oficinaNombre) { stats.ignoradas++; continue; }

        const oficina_id = oficinaMap[oficinaNombre];
        if (!oficina_id) { stats.ignoradas++; continue; }

        const estado      = (row['Estado Ficha'] || '').trim();
        const ref         = (row['Referencia'] || row['Código Propiedad'] || row['Codigo'] || '').trim();
        const direccion   = (row['Calle Prop'] || '').trim();
        const tipo        = (row['Tipo'] || '').trim();
        const tipoOp      = (row['tipo operacion'] || '').trim();
        const exclusiva   = (row['Exclusiva'] || '0').trim() === '1';
        const fechaAlta   = (row['Fecha Alta Propiedad'] || '').split(' ')[0] || null;
        const fechaCierre = (row['Fecha Cierre Operación'] || '').split(' ')[0] || null;
        const precioVenta = parseFloat((row['Precio Inmobiliaria'] || '0').replace(',', '.')) || 0;
        const pctComision = parseFloat((row['Porcentaje'] || '5').replace(',', '.')) || 5;
        const comision    = parseFloat((row['Comisión'] || '0').replace(',', '.')) || 0;

        const captadoPor = (row['Captado por'] || '').trim().toLowerCase();
        let resolvedConsultor = consultorMap[captadoPor] || null;
        if (!resolvedConsultor && captadoPor) {
          const { rows: newCons } = await client.query(
            'INSERT INTO consultores (nombre, oficina_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id',
            [row['Captado por'].trim(), oficina_id]
          );
          if (newCons[0]) {
            resolvedConsultor = newCons[0].id;
            consultorMap[captadoPor] = resolvedConsultor;
          }
        }

        const tipologia  = mapTipologia(tipo);
        const tipoOpLAE  = mapTipoOp(tipoOp);
        const mandato    = exclusiva ? 'exclusiva' : 'nota_encargo';
        const honorarios = comision > 0 ? comision : (precioVenta * pctComision / 100);

        if (ESTADOS_ACTIVOS.has(estado)) {
          await client.query(`
            INSERT INTO captaciones (ref, fecha_captacion, direccion, oficina_id, consultor_id,
              mandato, tipologia, tipo_operacion, precio_captacion, pct_honorarios,
              honorarios_potenciales, estado, fuente)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'activa','inmovilla')
          `, [ref, fechaAlta, direccion, oficina_id, resolvedConsultor,
              mandato, tipologia, tipoOpLAE, precioVenta, pctComision, honorarios]);
          stats.captaciones_nuevas++;

        } else if (ESTADOS_CERRADOS.has(estado)) {
          const fechaOp = (fechaCierre && fechaCierre !== '0000-00-00') ? fechaCierre : fechaAlta;
          if (!fechaOp || fechaOp === '0000-00-00') { stats.ignoradas++; continue; }
          const añoOp = parseInt((fechaOp || '').split('-')[0]);
          if (añoOp < 2023) { stats.ignoradas++; continue; }

          await client.query(`
            INSERT INTO operaciones (ref, fecha, tipo_ingreso, tipo_operacion,
              oficina_id, direccion, precio_inmueble, pct_comision,
              comision_bruta, honorarios_lae, canal, estado, fecha_cobro, fuente)
            VALUES ($1,$2,'inmobiliaria',$3,$4,$5,$6,$7,$8,$9,'directa','cobrada',$10,'inmovilla')
          `, [ref + '-OP', fechaOp, tipoOpLAE, oficina_id, direccion,
              precioVenta, pctComision, honorarios, honorarios,
              (fechaCierre && fechaCierre !== '0000-00-00') ? fechaCierre : null]);
          stats.operaciones_nuevas++;

        } else {
          stats.ignoradas++;
        }

      } catch (rowErr) {
        stats.errores++;
        if (errores.length < 5) errores.push(rowErr.message);
      }
    }

    await client.query('COMMIT');
    await recalcularSeguimiento(pool);

    res.json({
      success: true,
      stats,
      errores_muestra: errores,
      mensaje: `Importación completada: ${stats.captaciones_nuevas} captaciones, ${stats.operaciones_nuevas} operaciones`,
    });

  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error importación:', e);
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// POST /api/import/actividad
// Reemplaza completamente la tabla actividad_comercial
router.post('/actividad', upload.single('archivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No se recibió archivo' });

  const client = await pool.connect();
  try {
    const content = req.file.buffer.toString('latin1');
    const rows = parse(content, {
      delimiter: ';', columns: true, skip_empty_lines: true,
      trim: true, relax_column_count: true, relax_quotes: true,
    });

    const { rows: oficinas } = await client.query('SELECT id, nombre FROM oficinas');
    const oficinaMap = {};
    oficinas.forEach(o => { oficinaMap[o.nombre] = o.id; });

    await client.query('BEGIN');
    await client.query('DELETE FROM actividad_comercial');

    const stats = { insertadas: 0, errores: 0, ignoradas: 0 };
    const parseDate = s => {
      if (!s || s.startsWith('0000')) return null;
      const d = s.split(' ')[0];
      return d.match(/^\d{4}-\d{2}-\d{2}$/) ? d : null;
    };

    for (const row of rows) {
      try {
        const sucursal = (row['Sucursal'] || '').trim();
        const oficinaNombre = SUCURSAL_MAP[sucursal];
        const oficina_id = oficinaNombre ? (oficinaMap[oficinaNombre] || null) : null;
        if (!oficinaNombre) { stats.ignoradas++; continue; }

        await client.query(`
          INSERT INTO actividad_comercial
            (sucursal, oficina_id, comercial, ref_propiedad, tipo_seguimiento, fecha)
          VALUES ($1,$2,$3,$4,$5,$6)
        `, [
          sucursal, oficina_id,
          (row['Nombre Captador'] || row['Comercial'] || '').trim() || null,
          (row['Referencia'] || row['Ref'] || '').trim() || null,
          (row['Tipo Seguimiento'] || row['tipo operacion'] || '').trim() || null,
          parseDate(row['Fecha Seguimiento'] || row['Fecha']),
        ]);
        stats.insertadas++;
      } catch(e) {
        stats.errores++;
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, stats, mensaje: `${stats.insertadas} registros de actividad importados` });
  } catch(e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// POST /api/import/demandas
// Reemplaza completamente la tabla demandas
router.post('/demandas', upload.single('archivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No se recibió archivo' });

  const client = await pool.connect();
  try {
    const content = req.file.buffer.toString('latin1');
    const cleanContent = content.replace(/<[^>]*>/g, '').replace(/\[amp,\]/g, '&');
    const rows = parse(cleanContent, {
      delimiter: ';', columns: true, skip_empty_lines: true,
      trim: true, relax_column_count: true, relax_quotes: true,
    });

    const { rows: oficinas } = await client.query('SELECT id, nombre FROM oficinas');
    const oficinaMap = {};
    oficinas.forEach(o => { oficinaMap[o.nombre] = o.id; });

    await client.query('BEGIN');
    await client.query('DELETE FROM demandas');

    const stats = { insertadas: 0, errores: 0 };
    const parseDate = s => {
      if (!s || s.startsWith('0000')) return null;
      const d = s.split(' ')[0];
      return d.match(/^\d{4}-\d{2}-\d{2}$/) ? d : null;
    };

    for (const row of rows) {
      try {
        const sucursal = (row['Sucursal'] || '').trim();
        const oficinaNombre = SUCURSAL_MAP[sucursal];
        const oficina_id = oficinaNombre ? (oficinaMap[oficinaNombre] || null) : null;
        const consultor = [row['Nombre Captador'] || '', row['Apellidos Captador'] || ''].filter(Boolean).join(' ').trim();
        const cliente   = [row['Nombre Cliente']  || '', row['Apellidos']          || ''].filter(Boolean).join(' ').trim();

        await client.query(`
          INSERT INTO demandas (
            sucursal, oficina_id, consultor_nombre, cliente_nombre,
            fecha_alta_cliente, fecha_alta_demanda, fecha_act_demanda, fecha_cierre,
            medio_contacto, tipo_cliente, situacion, titulo, email, observacion, fuente
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'inmovilla')
        `, [
          sucursal, oficina_id, consultor || null, cliente || null,
          parseDate(row['Fecha Alta Clientes']),
          parseDate(row['Fecha Alta Demandas']),
          parseDate(row['Fecha Act Demandas']),
          parseDate(row['Fecha Cierre Operación'] || row['Fecha Cierre Operacion']),
          (row['Medio Contacto'] || '').trim() || null,
          (row['Tipo Cliente'] || '').trim() || null,
          (row['Situación'] || row['Situacion'] || '').trim() || null,
          (row['Título demanda'] || row['Titulo demanda'] || '').trim().slice(0, 500) || null,
          (row['Email Cliente'] || '').trim() || null,
          (row['Observación'] || row['Observacion'] || '').trim().slice(0, 1000) || null,
        ]);
        stats.insertadas++;
      } catch(e) {
        stats.errores++;
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, stats, mensaje: `${stats.insertadas} demandas importadas` });
  } catch(e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

async function recalcularSeguimiento(pool) {
  await pool.query(`
    INSERT INTO seguimiento (oficina_id, año, trimestre, cobrado, generado, captaciones, cierres)
    SELECT
      o.id AS oficina_id,
      EXTRACT(YEAR FROM op.fecha)::int AS año,
      EXTRACT(QUARTER FROM op.fecha)::int AS trimestre,
      COALESCE(SUM(op.honorarios_lae) FILTER (WHERE op.estado = 'cobrada'), 0) AS cobrado,
      COALESCE(SUM(op.honorarios_lae) FILTER (WHERE op.estado = 'pipeline'), 0) AS generado,
      0 AS captaciones,
      COUNT(*) FILTER (WHERE op.estado = 'cobrada') AS cierres
    FROM oficinas o
    JOIN operaciones op ON op.oficina_id = o.id
    WHERE EXTRACT(YEAR FROM op.fecha) >= 2024
    GROUP BY o.id, EXTRACT(YEAR FROM op.fecha), EXTRACT(QUARTER FROM op.fecha)
    ON CONFLICT (oficina_id, año, trimestre) DO UPDATE SET
      cobrado = EXCLUDED.cobrado,
      generado = EXCLUDED.generado,
      cierres  = EXCLUDED.cierres,
      updated_at = NOW()
  `);
}

module.exports = router;
