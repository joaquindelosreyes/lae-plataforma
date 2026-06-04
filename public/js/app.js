const API = '';

// ── UTILIDADES ──────────────────────────────────────
function fmt(n, decimals = 0) {
  const v = parseFloat(n) || 0;
  return v.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + '€';
}
function fmtK(n) {
  const v = parseFloat(n) || 0;
  if (v >= 1000000) return (v / 1000000).toFixed(1).replace('.', ',') + 'M€';
  if (v >= 1000)    return Math.round(v / 1000) + 'k€';
  return fmt(v);
}
function semColor(pct) {
  if (pct >= 90) return 'green';
  if (pct >= 60) return 'amber';
  return 'red';
}
function semClass(pct) {
  if (pct >= 90) return 'sem-g';
  if (pct >= 60) return 'sem-a';
  return 'sem-r';
}
function pctClass(pct) {
  if (pct >= 90) return 'pct-green';
  if (pct >= 60) return 'pct-amber';
  return 'pct-red';
}
function fmtFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── NAVEGACIÓN ──────────────────────────────────────
function nav(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const view = document.getElementById('view-' + viewId);
  if (view) view.classList.add('active');
  const navEl = document.querySelector(`[data-view="${viewId}"]`);
  if (navEl) navEl.classList.add('active');
  const titles = {
    dashboard: 'Dashboard General',
    operaciones: 'Operaciones',
    'nueva-op': 'Nueva operación',
    'ingresos-resumen': 'Ingresos — Resumen',
    captaciones: 'Captaciones — Listado',
    'cap-matriz': 'Captaciones — Matriz',
    'cap-oficinas': 'Captaciones — Por oficina',
    actividad: 'Actividad Comercial',
    actividad: 'Actividad Comercial',
    aaff50: 'AAFF 50-50 — Administradores de Fincas',
    demandas: 'Demandas / Leads',
    palancas: 'Palancas — Análisis automático',
    reuniones: 'Reuniones — Calendario',
    actas: 'Actas de reuniones',
    compromisos: 'Compromisos pendientes',
    aaff: 'AAFF',
    gastos: 'Gastos',
    importar: 'Importar Inmovilla',
    recursos: 'Recursos y documentos',
  };
  const title = document.getElementById('page-title');
  if (title) title.textContent = titles[viewId] || viewId;
  if (viewId === 'dashboard')        loadDashboard();
  if (viewId === 'operaciones')      loadOperaciones();
  if (viewId === 'captaciones')      loadCaptaciones();
  if (viewId === 'cap-matriz')       loadCaptacionesMatriz();
  if (viewId === 'cap-oficinas')     loadCaptacionesPorOficina();
  if (viewId === 'ingresos-resumen') loadIngresosResumen();
  if (viewId === 'actividad')         loadActividad();
  if (viewId === 'aaff50')           loadAAFF50();
  if (viewId === 'demandas')         loadDemandas();
  if (viewId === 'palancas')         loadPalancas();
  if (viewId === 'aaff')             loadAAFF();
  if (viewId === 'gastos')           loadGastos();
  if (viewId === 'reuniones')        { loadReuniones(); loadPlantillas(); }
  if (viewId === 'actas')            loadActas();
  if (viewId === 'compromisos')      loadCompromisosPendientes();
}

// ── FILTRO FECHAS ────────────────────────────────────
let _año = 2026, _periodo = 'year';

const DIAS_MES = [31,28,31,30,31,30,31,31,30,31,30,31];
function diasMes(m, a) { return (m===2 && a%4===0) ? 29 : DIAS_MES[m-1]; }
function pad(n) { return String(n).padStart(2,'0'); }

function setAño(a) {
  _año = a;
  // Marcar año activo
  [2024,2025,2026].forEach(y => {
    const el = document.getElementById('yr-' + y);
    if (el) el.classList.toggle('active', y === a);
  });
  aplicarFiltro();
}

function setPeriodo(p) {
  _periodo = p;
  // Marcar período activo
  ['year','1t','2t','3t','4t','m1','m2','m3','m4','m5','m6','m7','m8','m9','m10','m11','m12'].forEach(k => {
    const el = document.getElementById('p-' + k);
    if (el) el.classList.toggle('active', k === p);
  });
  aplicarFiltro();
}

const PERIODO_LABELS = {
  year:'Objetivo año', '1t':'Objetivo 1T', '2t':'Objetivo 2T',
  '3t':'Objetivo 3T', '4t':'Objetivo 4T',
  // Meses → muestran el trimestre al que pertenecen
  m1:'Objetivo 1T', m2:'Objetivo 1T', m3:'Objetivo 1T',
  m4:'Objetivo 2T', m5:'Objetivo 2T', m6:'Objetivo 2T',
  m7:'Objetivo 3T', m8:'Objetivo 3T', m9:'Objetivo 3T',
  m10:'Objetivo 4T', m11:'Objetivo 4T', m12:'Objetivo 4T',
};

function aplicarFiltro() {
  const a = _año;
  let desde, hasta;
  if (_periodo === 'year')    { desde = `${a}-01-01`; hasta = `${a}-12-31`; }
  else if (_periodo === '1t') { desde = `${a}-01-01`; hasta = `${a}-03-31`; }
  else if (_periodo === '2t') { desde = `${a}-04-01`; hasta = `${a}-06-30`; }
  else if (_periodo === '3t') { desde = `${a}-07-01`; hasta = `${a}-09-30`; }
  else if (_periodo === '4t') { desde = `${a}-10-01`; hasta = `${a}-12-31`; }
  else {
    const m = parseInt(_periodo.replace('m',''));
    desde = `${a}-${pad(m)}-01`;
    hasta = `${a}-${pad(m)}-${diasMes(m,a)}`;
  }
  document.getElementById('date-from').value = desde;
  document.getElementById('date-to').value   = hasta;

  // Actualizar labels del dashboard
  const lbl = document.getElementById('kpi-objetivo-label');
  if (lbl) lbl.textContent = (PERIODO_LABELS[_periodo] || 'Objetivo') + ' ' + a;
  const sub = document.getElementById('kpi-pct-sub');
  if (sub) sub.textContent = _periodo === 'year' ? `vs objetivo anual ${a}` : `vs ${PERIODO_LABELS[_periodo]||'objetivo'} ${a}`;

  recargarVistaActiva();
}

// Compatibilidad legacy
function setDR(k) { setPeriodo(k); }
function onDateChange() { recargarVistaActiva(); }

function recargarVistaActiva() {
  const active = document.querySelector('.view.active');
  if (!active) return;
  const id = active.id.replace('view-', '');
  if (id === 'dashboard')        loadDashboard();
  if (id === 'operaciones')      loadOperaciones();
  if (id === 'ingresos-resumen') loadIngresosResumen();
  if (id === 'captaciones')      loadCaptaciones();
  if (id === 'cap-matriz')       loadCaptacionesMatriz();
  if (id === 'cap-oficinas')     loadCaptacionesPorOficina();
  if (id === 'demandas')       loadDemandas();
  if (id === 'palancas')         loadPalancas();
  if (id === 'compromisos') loadCompromisosPendientes();
  if (id === 'actas')       loadActas();
  if (!['dashboard','operaciones','ingresos-resumen','captaciones','cap-matriz','cap-oficinas','palancas','compromisos','actas'].includes(id)) loadDashboard();
}

function getDateRange() {
  const from = document.getElementById('date-from')?.value || '2026-01-01';
  const to   = document.getElementById('date-to')?.value   || '2026-12-31';
  return { desde: from, hasta: to };
}

// ── DASHBOARD ────────────────────────────────────────
async function loadDashboard() {
  const { desde, hasta } = getDateRange();
  // Extraer año del rango para endpoints que lo necesitan
  const año = desde ? desde.split('-')[0] : new Date().getFullYear();
  try {
    const [resumenResp, oficinasResp] = await Promise.all([
      fetch(`${API}/api/resumen?año=${año}&desde=${desde}&hasta=${hasta}`),
      fetch(`${API}/api/oficinas?año=${año}&desde=${desde}&hasta=${hasta}`)
    ]);
    const resumen  = await resumenResp.json();
    const oficinas = await oficinasResp.json();

    const r = resumen.data || resumen;
    const cobrado  = parseFloat(r.cobrado_total) || 0;
    const objetivo = parseFloat(r.objetivo_total) || 0;
    const pct      = parseFloat(r.pct_cumplimiento) || 0;

    // Los 5 conceptos de honorarios en orden
    set('kpi-honor-brutos', fmtK(r.honor_brutos_total || cobrado)); // fallback a cobrado si no hay brutos
    set('kpi-cobrado',      fmtK(cobrado));
    set('kpi-gen-brutos',   fmtK(r.generados_brutos_total || r.generado_total || 0));
    set('kpi-generado',     fmtK(r.generado_total || 0));
    set('kpi-pendientes',   fmtK(r.pendientes_total || 0));
    // Métricas
    set('kpi-objetivo',    fmtK(objetivo));
    set('kpi-pct',         pct + '%');
    set('kpi-cierres',     r.cierres_total || 0);
    set('kpi-captaciones', r.captaciones_total || 0);

    // Guardar datos para ordenación
    window._dashOficinas = oficinas.data || oficinas;
    renderDashOficinas(window._dashOficinas);
  } catch(e) { console.error('Error dashboard:', e); }
}

let _sortCol = 'cobrado', _sortAsc = false;

function sortDash(col) {
  if (_sortCol === col) {
    _sortAsc = !_sortAsc;
  } else {
    _sortCol = col;
    _sortAsc = col === 'nombre'; // texto asc por defecto, números desc
  }
  // Actualizar flechas
  ['nombre','objetivo','cobrado','pct','cierres','captaciones'].forEach(c => {
    const el = document.getElementById('sort-' + c);
    if (el) el.textContent = c === col ? (_sortAsc ? ' ↑' : ' ↓') : '';
  });
  if (window._dashOficinas) renderDashOficinas(window._dashOficinas);
}

function renderDashOficinas(lista) {
    const tbody = document.getElementById('dash-tbody');
    if (!tbody || !Array.isArray(lista)) return;

    const sorted = [...lista].sort((a, b) => {
      let va, vb;
      if (_sortCol === 'nombre')       { va = a.nombre; vb = b.nombre; }
      else if (_sortCol === 'objetivo'){ va = parseFloat(a.objetivo_anual)||0; vb = parseFloat(b.objetivo_anual)||0; }
      else if (_sortCol === 'cobrado') { va = parseFloat(a.total_cobrado)||0; vb = parseFloat(b.total_cobrado)||0; }
      else if (_sortCol === 'pct')     { va = parseFloat(a.pct_cumplimiento)||0; vb = parseFloat(b.pct_cumplimiento)||0; }
      else if (_sortCol === 'cierres') { va = parseInt(a.total_cierres)||0; vb = parseInt(b.total_cierres)||0; }
      else if (_sortCol === 'captaciones') { va = parseInt(a.total_captaciones)||0; vb = parseInt(b.total_captaciones)||0; }
      if (typeof va === 'string') return _sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return _sortAsc ? va - vb : vb - va;
    });

    const max = Math.max(...sorted.map(o => parseFloat(o.total_cobrado) || 0), 1);
    let totObj=0, totCob=0, totCierres=0, totCap=0;
      const filas = sorted.map(o => {
        const cob = parseFloat(o.total_cobrado) || 0;
        const obj = parseFloat(o.objetivo_periodo || o.objetivo_anual) || 0;
        const p   = parseFloat(o.pct_cumplimiento) || 0;
        const w   = Math.round(cob / max * 100);
        const barColor = p >= 90 ? 'var(--green)' : p >= 60 ? 'var(--amber)' : 'var(--red)';
        totObj += obj; totCob += cob;
        totCierres += parseInt(o.total_cierres)||0;
        totCap += parseInt(o.total_captaciones)||0;
        return `<tr>
          <td><span class="sem ${semClass(p)}"></span></td>
          <td><strong>${o.nombre}</strong></td>
          <td class="td-right">${fmtK(obj)}</td>
          <td class="td-right">${fmtK(cob)}</td>
          <td>
            <div style="display:flex;align-items:center;gap:8px;min-width:120px">
              <div style="flex:1;height:5px;background:var(--border);border-radius:2px">
                <div style="width:${w}%;height:100%;background:${barColor};border-radius:2px"></div>
              </div>
              <span class="${pctClass(p)}" style="width:38px;font-size:11px">${p}%</span>
            </div>
          </td>
          <td class="td-right">${parseInt(o.total_cierres)||0}</td>
          <td class="td-right">${parseInt(o.total_captaciones)||0}</td>
        </tr>`;
      }).join('');
      const pctT = totObj > 0 ? Math.round(totCob/totObj*100*10)/10 : 0;
      const barT = pctT >= 90 ? 'var(--green)' : pctT >= 60 ? 'var(--amber)' : 'var(--red)';
      tbody.innerHTML = filas + `<tr style="background:var(--cream);border-top:2px solid var(--border)">
        <td></td>
        <td style="font-weight:700;color:var(--navy)">RED TOTAL</td>
        <td class="td-right" style="font-weight:700">${fmtK(totObj)}</td>
        <td class="td-right" style="font-weight:700">${fmtK(totCob)}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;min-width:120px">
            <div style="flex:1;height:5px;background:var(--border);border-radius:2px">
              <div style="width:${Math.min(pctT,100)}%;height:100%;background:${barT};border-radius:2px"></div>
            </div>
            <span class="${pctClass(pctT)}" style="width:38px;font-size:11px;font-weight:700">${pctT}%</span>
          </div>
        </td>
        <td class="td-right" style="font-weight:700">${totCierres}</td>
        <td class="td-right" style="font-weight:700">${totCap}</td>
      </tr>`;
}

function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── OPERACIONES ──────────────────────────────────────
let _opsData = [], _opsSortCol = 'fecha', _opsSortAsc = false;

async function loadOperaciones() {
  const tbody = document.getElementById('ops-tbody');
  const counter = document.getElementById('ops-count');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" class="loading">Cargando...</td></tr>';
  try {
    const { desde, hasta } = getDateRange();
    const res = await fetch(`${API}/api/operaciones?limit=500&desde=${desde}&hasta=${hasta}`).then(r => r.json());
    _opsData = res.data || res;
    if (!Array.isArray(_opsData) || !_opsData.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">📋</div><h3>Sin operaciones</h3><p>Las operaciones importadas de Inmovilla aparecerán aquí.<br>También puedes añadir una manualmente.</p></div></td></tr>`;
      return;
    }
    if (counter) counter.textContent = _opsData.length + ' operaciones';
    renderOps();
  } catch(e) { tbody.innerHTML = `<tr><td colspan="8" class="loading">Error: ${e.message}</td></tr>`; }
}

function sortOps(col) {
  if (_opsSortCol === col) {
    _opsSortAsc = !_opsSortAsc;
  } else {
    _opsSortCol = col;
    _opsSortAsc = ['ref','oficina','direccion','tipo','estado'].includes(col);
  }
  ['ref','fecha','oficina','direccion','tipo','precio','honor','estado'].forEach(c => {
    const el = document.getElementById('ops-sort-' + c);
    if (el) el.textContent = c === col ? (_opsSortAsc ? ' ↑' : ' ↓') : '';
  });
  renderOps();
}

function renderOps() {
  const tbody = document.getElementById('ops-tbody');
  if (!tbody || !_opsData.length) return;

  const sorted = [..._opsData].sort((a, b) => {
    let va, vb;
    if      (_opsSortCol === 'ref')       { va = a.ref||''; vb = b.ref||''; }
    else if (_opsSortCol === 'fecha')     { va = a.fecha||''; vb = b.fecha||''; }
    else if (_opsSortCol === 'oficina')   { va = a.oficina_nombre||''; vb = b.oficina_nombre||''; }
    else if (_opsSortCol === 'direccion') { va = a.direccion||''; vb = b.direccion||''; }
    else if (_opsSortCol === 'tipo')      { va = a.tipo_operacion||''; vb = b.tipo_operacion||''; }
    else if (_opsSortCol === 'precio')    { va = parseFloat(a.precio_inmueble)||0; vb = parseFloat(b.precio_inmueble)||0; }
    else if (_opsSortCol === 'honor')     { va = parseFloat(a.honorarios_lae)||0; vb = parseFloat(b.honorarios_lae)||0; }
    else if (_opsSortCol === 'estado')    { va = a.estado||''; vb = b.estado||''; }
    if (typeof va === 'string') return _opsSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return _opsSortAsc ? va - vb : vb - va;
  });

  const estadoBadge = { cobrada:'badge-green', pipeline:'badge-blue', pendiente_escritura:'badge-amber', cancelada:'badge-gray' };
  const estadoLbl   = { cobrada:'Cobrada', pipeline:'Pipeline', pendiente_escritura:'Pend. escritura', cancelada:'Cancelada' };
  tbody.innerHTML = sorted.map(op => {
    const est   = op.estado || 'pipeline';
    const precio = parseFloat(op.precio_inmueble) > 0 ? fmtK(op.precio_inmueble) : '—';
    const honor  = parseFloat(op.honorarios_lae)  > 0 ? fmt(op.honorarios_lae)   : '—';
    return `<tr>
      <td style="font-size:10px;color:var(--muted);font-family:monospace">${op.ref||'—'}</td>
      <td>${fmtFecha(op.fecha)}</td>
      <td>${op.oficina_nombre||'—'}</td>
      <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${op.direccion||'—'}</td>
      <td><span class="badge badge-gray">${op.tipo_operacion==='cv'?'C-V':op.tipo_operacion||'—'}</span></td>
      <td class="td-right">${precio}</td>
      <td class="td-right" style="color:var(--green);font-weight:500">${honor}</td>
      <td><span class="badge ${estadoBadge[est]||'badge-gray'}" style="cursor:pointer" onclick="cambiarEstadoOp(${op.id},'${est}')">${estadoLbl[est]||est}</span></td>
    </tr>`;
  }).join('');
}

async function cambiarEstadoOp(id, estadoActual) {
  const estados = ['pipeline','pendiente_escritura','cobrada','cancelada'];
  const lbls    = ['Pipeline','Pend. escritura','Cobrada','Cancelada'];
  const sig = estados[(estados.indexOf(estadoActual)+1) % estados.length];
  if (!confirm(`Cambiar a "${lbls[estados.indexOf(sig)]}"?`)) return;
  await fetch(`${API}/api/operaciones/${id}/estado`, {
    method: 'PATCH', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ estado: sig })
  });
  loadOperaciones();
  loadDashboard();
}

// ── NUEVA OPERACIÓN ──────────────────────────────────
async function initNuevaOp() {
  // Cargar oficinas y consultores en los selects
  try {
    const [of, cons] = await Promise.all([
      fetch(`${API}/api/oficinas`).then(r => r.json()),
      fetch(`${API}/api/consultores`).then(r => r.json())
    ]);
    const oficinas = of.data || of;
    const consultores = cons.data || cons;
    const selOf = document.getElementById('nop-oficina');
    if (selOf && Array.isArray(oficinas)) {
      selOf.innerHTML = '<option value="">Selecciona oficina...</option>' +
        oficinas.map(o => `<option value="${o.id}">${o.nombre}</option>`).join('');
    }
    const optsC = Array.isArray(consultores)
      ? '<option value="">— seleccionar —</option>' + consultores.map(c => `<option value="${c.id}">${c.nombre}${c.oficina_nombre ? ' ('+c.oficina_nombre+')' : ''}</option>`).join('')
      : '';
    ['nop-captador','nop-vendedor'].forEach(id => {
      const s = document.getElementById(id);
      if (s) s.innerHTML = optsC;
    });
  } catch(e) {}
}

function calcNuevaOp() {
  const precio = parseFloat((document.getElementById('nop-precio')?.value||'0').replace(/\./g,'').replace(',','.')) || 0;
  const pct    = parseFloat(document.getElementById('nop-pct')?.value || '5') || 5;
  const comp   = document.getElementById('nop-compartida')?.checked || false;
  const split  = parseFloat(document.getElementById('nop-split')?.value || '50') || 50;
  const bruta  = precio * pct / 100;
  const lae    = comp ? bruta * split / 100 : bruta;
  const elBruta = document.getElementById('nop-bruta');
  const elLae   = document.getElementById('nop-lae');
  if (elBruta) elBruta.value = bruta > 0 ? bruta.toLocaleString('es-ES', {maximumFractionDigits:0}) + ' €' : '';
  if (elLae)   elLae.value   = lae > 0   ? lae.toLocaleString('es-ES', {maximumFractionDigits:0}) + ' €' : '';
  const compRow = document.getElementById('nop-comp-row');
  if (compRow) compRow.style.display = comp ? 'grid' : 'none';

  // Reparto detallado
  if (lae <= 0) {
    const prev = document.getElementById('nop-reparto-preview');
    if (prev) prev.style.display = 'none';
    return;
  }
  const agentes = [
    { rol:'Captador',            selId:'nop-captador',     pctId:'nop-pct-cap',  def:15  },
    { rol:'Vendedor',            selId:'nop-vendedor',     pctId:'nop-pct-ven',  def:15  },
    { rol:'Coordinadora',        selId:'nop-coordinadora', pctId:'nop-pct-coor', def:1   },
    { rol:'Director de oficina', selId:'nop-director',     pctId:'nop-pct-dir',  def:1.5 },
  ];
  let totalRepartos = 0;
  const rows = agentes.map(a => {
    const sel = document.getElementById(a.selId);
    const nombre = sel?.options[sel.selectedIndex]?.text || '';
    if (!nombre || nombre.includes('seleccionar') || nombre.includes('—')) return null;
    const p   = parseFloat(document.getElementById(a.pctId)?.value || a.def) || 0;
    const imp = lae * p / 100;
    totalRepartos += imp;
    return `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0">
      <span style="color:var(--muted)">${a.rol} · ${nombre.split('(')[0].trim()}</span>
      <span style="font-weight:500">${p}% = ${imp.toLocaleString('es-ES',{maximumFractionDigits:0})}€</span>
    </div>`;
  }).filter(Boolean);

  const neto = lae - totalRepartos;
  const prev = document.getElementById('nop-reparto-preview');
  const rowsEl = document.getElementById('nop-reparto-rows');
  const netoEl = document.getElementById('nop-neto');
  if (prev) prev.style.display = rows.length ? 'block' : 'none';
  if (rowsEl) rowsEl.innerHTML = rows.join('');
  if (netoEl) netoEl.textContent = neto.toLocaleString('es-ES',{maximumFractionDigits:0}) + '€';
}

async function guardarNuevaOp() {
  const fecha = document.getElementById('nop-fecha')?.value;
  const oficina = document.getElementById('nop-oficina')?.value;
  if (!fecha || !oficina) { alert('Fecha y oficina son obligatorias'); return; }

  const precioRaw = (document.getElementById('nop-precio')?.value||'0').replace(/[^0-9,]/g,'').replace(',','.');
  const precio    = parseFloat(precioRaw) || 0;
  const pct       = parseFloat(document.getElementById('nop-pct')?.value) || 5;
  const comp      = document.getElementById('nop-compartida')?.checked || false;
  const split     = parseFloat(document.getElementById('nop-split')?.value) || 50;
  const bruta     = precio * pct / 100;
  const lae       = comp ? bruta * split / 100 : bruta;

  const tipoIngreso = document.querySelector('[name="tipo-ingreso"]:checked')?.value || 'inmobiliaria';
  const tipoOp = { 'Compra-Venta':'cv', 'Alquiler':'alquiler', 'Traspaso':'traspaso' }
    [document.getElementById('nop-tipo-op')?.value] || 'cv';

  const payload = {
    fecha, tipo_ingreso: tipoIngreso, tipo_operacion: tipoOp,
    oficina_id: parseInt(oficina),
    direccion: document.getElementById('nop-direccion')?.value || '',
    consultor_captador_id: parseInt(document.getElementById('nop-captador')?.value) || null,
    pct_captador: parseFloat(document.getElementById('nop-pct-cap')?.value) || 0,
    consultor_vendedor_id: parseInt(document.getElementById('nop-vendedor')?.value) || null,
    pct_vendedor: parseFloat(document.getElementById('nop-pct-ven')?.value) || 0,
    precio_inmueble: precio, pct_comision: pct,
    comision_bruta: bruta, honorarios_lae: lae,
    canal: document.getElementById('nop-canal')?.value || 'directa',
    compartida: comp, split_pct: split,
    agencia_externa: document.getElementById('nop-agencia')?.value || null,
    estado: document.getElementById('nop-estado')?.value || 'cobrada',
    observaciones: document.getElementById('nop-obs')?.value || null
  };

  const btn = document.getElementById('btn-guardar-op');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    const res = await fetch(`${API}/api/operaciones`, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
    }).then(r => r.json());
    if (res.success) {
      showAlert('op-alert', '✓ Operación guardada correctamente · Ref: ' + res.data.ref, 'success');
      document.getElementById('form-nueva-op')?.reset();
      calcNuevaOp();
    } else {
      showAlert('op-alert', 'Error: ' + res.error, 'error');
    }
  } catch(e) {
    showAlert('op-alert', 'Error de conexión: ' + e.message, 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Guardar operación'; }
}

// ── CAPTACIONES ──────────────────────────────────────
async function loadCaptaciones() {
  const tbody = document.getElementById('cap-tbody');
  const kpis  = document.getElementById('cap-kpis');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="9" class="loading">Cargando...</td></tr>';
  try {
    const [sumRes, listRes] = await Promise.all([
      fetch(`${API}/api/captaciones/resumen`).then(r => r.json()),
      fetch(`${API}/api/captaciones?estado=activa`).then(r => r.json())
    ]);
    const s = sumRes.data || sumRes;
    if (kpis) {
      kpis.innerHTML = `
        <div class="kpi-card highlight">
          <div class="kpi-label">Total activas</div>
          <div class="kpi-value">${s.total||0}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Exclusivas</div>
          <div class="kpi-value" style="color:#1E40AF">${s.exclusivas||0}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Notas encargo</div>
          <div class="kpi-value" style="color:#7C3AED">${s.notas_encargo||0}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Valor cartera</div>
          <div class="kpi-value gold">${fmtK(s.valor_cartera||0)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Hon. potenciales</div>
          <div class="kpi-value green">${fmtK(s.honorarios_potenciales||0)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Hon. pot. exclusivas</div>
          <div class="kpi-value" style="color:#1E40AF">${fmtK(s.hon_pot_exclusivas||0)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Hon. pot. N.E.</div>
          <div class="kpi-value" style="color:#7C3AED">${fmtK(s.hon_pot_ne||0)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Excl. viviendas</div>
          <div class="kpi-value" style="color:#1E40AF">${s.excl_viviendas||0}</div>
          <div class="kpi-sub">⭐ tipología principal</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Hon. pot. excl. viviendas</div>
          <div class="kpi-value green">${fmtK(s.hon_pot_excl_viviendas||0)}</div>
        </div>
      `;
    }
    const lista = listRes.data || listRes;
    if (!Array.isArray(lista) || !lista.length) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">🏠</div><h3>Sin captaciones</h3><p>Importa un CSV de Inmovilla para ver las captaciones activas.</p><button class="btn btn-primary" style="margin-top:12px" onclick="nav('importar')">Importar Inmovilla</button></div></td></tr>`;
      return;
    }
    renderCap(lista);
    const cnt = document.getElementById('cap-count');
    if (cnt) cnt.textContent = lista.length + ' captaciones activas';
  } catch(e) { tbody.innerHTML = `<tr><td colspan="9" class="loading">Error: ${e.message}</td></tr>`; }
}

// ── AAFF ─────────────────────────────────────────────
async function loadAAFF() {
  const tbody  = document.getElementById('aaff-tbody');
  const kanban = document.getElementById('aaff-kanban');
  if (!tbody) return;
  try {
    const [listRes, sumRes] = await Promise.all([
      fetch(`${API}/api/aaff`).then(r => r.json()),
      fetch(`${API}/api/aaff/resumen`).then(r => r.json())
    ]);
    const s = sumRes.data || sumRes;
    set('aaff-activos', `${s.activos||0}/${s.total||0}`);
    set('aaff-pct', (s.pct_activos||0) + '%');
    const lista = listRes.data || listRes;

    // Kanban
    if (kanban && Array.isArray(lista)) {
      ['activo','reactivar','rescindir'].forEach(est => {
        const col = document.getElementById('aaff-col-' + est);
        if (!col) return;
        const items = lista.filter(d => d.estado === est);
        col.innerHTML = items.length
          ? items.map(d => `
            <div class="panel" style="margin-bottom:8px;cursor:pointer" onclick="cambiarEstadoAAFF(${d.id},'${d.estado}')">
              <div class="panel-body" style="padding:10px 12px">
                <div style="font-size:12px;font-weight:500;color:var(--navy)">${d.nombre}</div>
                <div style="font-size:10px;color:var(--muted);margin-top:2px">${d.oficina_nombre||'—'} · ${d.consultor_nombre||'—'}</div>
                ${d.dias_sin_actividad > 30 ? `<div style="font-size:10px;color:var(--red);margin-top:2px">${d.dias_sin_actividad}d sin contacto</div>` : ''}
              </div>
            </div>`).join('')
          : '<div style="font-size:11px;color:var(--muted);text-align:center;padding:12px;border:1px dashed var(--border);border-radius:6px">Sin despachos</div>';
        const cnt = document.getElementById('aaff-cnt-' + est);
        if (cnt) cnt.textContent = items.length;
      });
    }

    // Tabla
    if (!tbody) return;
    if (!Array.isArray(lista) || !lista.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">🤝</div><h3>Sin despachos AAFF</h3><p>Añade el primero con el botón "+ Nuevo despacho".</p></div></td></tr>`;
      return;
    }
    renderAaffTabla(lista);
  } catch(e) { if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="loading">Error: ${e.message}</td></tr>`; }
}

async function cambiarEstadoAAFF(id, estadoActual) {
  const estados = ['activo','reactivar','rescindir'];
  const sig = estados[(estados.indexOf(estadoActual)+1) % estados.length];
  if (!confirm(`Cambiar estado a "${sig}"?`)) return;
  await fetch(`${API}/api/aaff/${id}/estado`, {
    method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ estado: sig })
  });
  loadAAFF();
}

async function guardarNuevoAAFF() {
  const nombre = document.getElementById('aaff-nombre')?.value?.trim();
  if (!nombre) { alert('Introduce el nombre del despacho'); return; }
  const payload = {
    nombre,
    oficina_id: parseInt(document.getElementById('aaff-oficina-sel')?.value) || null,
    consultor_responsable_id: parseInt(document.getElementById('aaff-consultor-sel')?.value) || null,
    pct_comision: parseFloat(document.getElementById('aaff-pct-com')?.value) || 10,
    estado: 'activo'
  };
  const res = await fetch(`${API}/api/aaff`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
  }).then(r => r.json());
  if (res.success) {
    document.getElementById('form-nuevo-aaff').style.display = 'none';
    document.getElementById('aaff-nombre').value = '';
    loadAAFF();
  } else { alert('Error: ' + res.error); }
}

// ── GASTOS ────────────────────────────────────────────
async function loadGastos() {
  const tbody = document.getElementById('gastos-tbody');
  if (!tbody) return;
  try {
    const [listRes, sumRes] = await Promise.all([
      fetch(`${API}/api/gastos`).then(r => r.json()),
      fetch(`${API}/api/gastos/resumen`).then(r => r.json())
    ]);
    const s = sumRes.data || sumRes;
    set('gastos-total',      fmt(s.total_gastos||0));
    set('gastos-periodicos', fmt(s.gastos_periodicos||0));
    set('gastos-num',        s.num_gastos||0);

    const lista = listRes.data || listRes;
    if (!Array.isArray(lista) || !lista.length) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">💰</div><h3>Sin gastos registrados</h3><p>Añade el primer gasto con el formulario de abajo.</p></div></td></tr>`;
      return;
    }
    renderGastosTabla(lista);
  } catch(e) { tbody.innerHTML = `<tr><td colspan="8" class="loading">Error: ${e.message}</td></tr>`; }
}

async function guardarGasto() {
  const concepto = document.getElementById('g-concepto')?.value?.trim();
  if (!concepto) { alert('El concepto es obligatorio'); return; }
  const base = parseFloat((document.getElementById('g-base')?.value||'0').replace(/[^0-9,]/g,'').replace(',','.')) || 0;
  const pct  = parseFloat(document.getElementById('g-pct')?.value||'0') || 0;
  const categoria = document.getElementById('g-categoria')?.value || 'Otros';
  const oficina_id = document.getElementById('g-oficina')?.value || null;
  const payload = {
    concepto, categoria,
    fecha: document.getElementById('g-fecha')?.value || new Date().toISOString().split('T')[0],
    periodicidad: document.getElementById('g-periodicidad')?.value || 'puntual',
    base_imponible: base,
    tipo_impuesto_desc: document.getElementById('g-imp-desc')?.value || 'IVA 21%',
    pct_impuesto: pct,
    fecha_vencimiento_contrato: document.getElementById('g-vencimiento')?.value || null,
    nota: document.getElementById('g-nota')?.value || null,
    oficina_ids: oficina_id ? [parseInt(oficina_id)] : []
  };
  const res = await fetch(`${API}/api/gastos`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
  }).then(r => r.json());
  if (res.success) {
    showAlert('gastos-alert', '✓ Gasto guardado', 'success');
    document.getElementById('form-gasto')?.reset();
    loadGastos();
  } else { showAlert('gastos-alert', 'Error: ' + res.error, 'error'); }
}

async function eliminarGasto(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  await fetch(`${API}/api/gastos/${id}`, { method:'DELETE' });
  loadGastos();
}

// ── IMPORTAR ──────────────────────────────────────────
let _importFile = null;

function setImportFile(f) {
  _importFile = f;
  const lbl = document.getElementById('import-file-label');
  if (lbl) { lbl.textContent = '✓ ' + f.name + ' (' + (f.size/1024).toFixed(0) + ' KB)'; lbl.style.display = 'block'; }
  document.getElementById('btn-importar') && (document.getElementById('btn-importar').disabled = false);
  document.getElementById('btn-importar-demandas') && (document.getElementById('btn-importar-demandas').disabled = false);
}

async function ejecutarImport(tipo) {
  if (!_importFile) return;
  const esDemandas = tipo === 'demandas';
  const btnId = esDemandas ? 'btn-importar-demandas' : 'btn-importar';
  const btn = document.getElementById(btnId);
  const result = document.getElementById('import-result');
  const prog = document.getElementById('import-prog');
  if (btn) { btn.disabled = true; btn.textContent = 'Importando...'; }
  if (prog) prog.style.display = 'block';
  if (result) result.style.display = 'none';

  let pct = 0;
  const fill = document.getElementById('import-fill');
  const iv = setInterval(() => { pct = Math.min(pct+6, 85); if (fill) fill.style.width = pct+'%'; }, 400);

  try {
    const fd = new FormData();
    fd.append('archivo', _importFile);
    const endpoint = esDemandas ? '/api/import/demandas' : '/api/import/inmovilla';
    const res = await fetch(`${API}${endpoint}`, { method:'POST', body: fd }).then(r => r.json());
    clearInterval(iv);
    if (fill) fill.style.width = '100%';
    if (result) {
      result.style.display = 'block';
      if (res.success) {
        const s = res.stats;
        result.className = 'alert alert-success';
        if (esDemandas) {
          result.innerHTML = `<strong>✓ Demandas importadas</strong><br>
            ${s.insertadas} demandas importadas · ${s.errores||0} errores
            <br><small style="opacity:.8">Ve a Demandas/Leads para ver los datos.</small>`;
        } else {
          result.innerHTML = `<strong>✓ Propiedades importadas</strong><br>
            ${s.captaciones_nuevas} captaciones · ${s.operaciones_nuevas} operaciones · ${s.ignoradas} ignoradas
            ${s.errores > 0 ? ' · <span style="color:var(--red)">'+s.errores+' errores</span>' : ''}
            <br><small style="opacity:.8">El dashboard ya refleja los datos actualizados.</small>`;
        }
      } else {
        result.className = 'alert alert-error';
        result.innerHTML = `<strong>Error:</strong> ${res.error}`;
      }
    }
  } catch(e) {
    clearInterval(iv);
    if (result) { result.style.display='block'; result.className='alert alert-error'; result.innerHTML='Error: '+e.message; }
  }
  if (btn) { btn.disabled = false; btn.textContent = esDemandas ? 'Importar demandas/leads' : 'Importar propiedades'; }
  // Habilitar el otro botón también
  const otroBtn = document.getElementById(esDemandas ? 'btn-importar' : 'btn-importar-demandas');
  if (otroBtn) otroBtn.disabled = !_importFile;
}

// ── UTILIDADES ────────────────────────────────────────
function showAlert(containerId, msg, type) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.className = 'alert alert-' + type;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

async function loadSelectsGlobales() {
  try {
    const [of, cons] = await Promise.all([
      fetch(`${API}/api/oficinas`).then(r => r.json()),
      fetch(`${API}/api/consultores`).then(r => r.json())
    ]);
    const oficinas = of.data || of;
    const consultores = cons.data || cons;
    const optsOf = Array.isArray(oficinas)
      ? '<option value="">Selecciona...</option>' + oficinas.map(o => `<option value="${o.id}">${o.nombre}</option>`).join('')
      : '';
    const optsCons = Array.isArray(consultores)
      ? '<option value="">— seleccionar —</option>' + consultores.map(c => `<option value="${c.id}">${c.nombre}${c.oficina_nombre?' ('+c.oficina_nombre+')':''}</option>`).join('')
      : '';
    ['nop-oficina','aaff-oficina-sel','g-oficina'].forEach(id => {
      const s = document.getElementById(id);
      if (s) s.innerHTML = optsOf;
    });
    // Opciones con puesto visible
    const optsConsPuesto = Array.isArray(consultores)
      ? '<option value="">— seleccionar —</option>' + consultores.map(c =>
          `<option value="${c.id}">${c.nombre}${c.puesto ? ' · '+c.puesto : ''}${c.oficina_nombre ? ' ('+c.oficina_nombre+')' : ''}</option>`
        ).join('')
      : '';
    ['nop-captador','nop-vendedor','nop-coordinadora','nop-director','aaff-consultor-sel'].forEach(id => {
      const s = document.getElementById(id);
      if (s) s.innerHTML = optsConsPuesto;
    });
  } catch(e) {}
}

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setAño(2026); // Arranca en 2026 año completo
  nav('dashboard');
  loadSelectsGlobales();
  // Drag & drop para importar
  const dz = document.getElementById('drop-zone');
  if (dz) {
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag'); if (e.dataTransfer.files[0]) setImportFile(e.dataTransfer.files[0]); });
  }
});

// ── PALANCAS ─────────────────────────────────────────
async function loadPalancas() {
  try {
    const año = new Date().getFullYear();
    const res = await fetch(`${API}/api/palancas?año=${año}`).then(r => r.json());
    if (!res.success) return;
    const d = res.data;
    const el = id => document.getElementById(id);
    const bg  = { verde:'#f0faf3', ambar:'#fffbeb', rojo:'#fff5f5', sin_datos:'transparent' };
    const col = { verde:'#16a34a', ambar:'#d97706', rojo:'#dc2626', sin_datos:'#9ca3af' };
    const palancaKeys = ['honor_lae','captaciones','cierres','aaff_activos','cartera_excl'];
    const lbl = { honor_lae:'Honor. LAE', captaciones:'Captaciones', cierres:'Cierres', aaff_activos:'AAFF activos', cartera_excl:'Cartera excl.' };

    if (el('palanca-ritmo')) el('palanca-ritmo').textContent = d.ritmo_esperado + '%';
    if (el('palanca-cnt-verde')) el('palanca-cnt-verde').textContent = d.contadores.verde;
    if (el('palanca-cnt-ambar')) el('palanca-cnt-ambar').textContent = d.contadores.ambar;
    if (el('palanca-cnt-rojo'))  el('palanca-cnt-rojo').textContent  = d.contadores.rojo;

    const tbody = el('palanca-tbody');
    if (tbody) {
      tbody.innerHTML = d.oficinas.map(o => {
        const celdas = palancaKeys.map(k => {
          const p = o.palancas[k];
          const txt = p.sem === 'sin_datos' ? '—' : `${p.pct}% ${p.icono}`;
          return `<td class="td-right" style="background:${bg[p.sem]}"><span style="color:${col[p.sem]};font-weight:600">${txt}</span></td>`;
        }).join('');
        return `<tr><td style="font-weight:500;color:var(--navy);white-space:nowrap">${o.nombre}</td>${celdas}</tr>`;
      }).join('');
    }

    const resDiv = el('palanca-resumen');
    if (resDiv) {
      resDiv.innerHTML = palancaKeys.map(k => {
        const r = d.resumen_palancas[k];
        const c = col[r.sem] || col.rojo;
        const dir = r.sem === 'verde' ? '↑ por encima' : r.sem === 'ambar' ? '→ en ritmo' : '↓ por debajo';
        return `<div class="kpi-card"><div class="kpi-label">${lbl[k]}</div><div class="kpi-value" style="color:${c}">${r.media}%</div><div class="kpi-sub">ritmo esp. ${d.ritmo_esperado}% · ${dir}</div></div>`;
      }).join('');
    }

    const alertDiv = el('palanca-alertas');
    if (alertDiv) {
      if (!d.alertas.length) {
        alertDiv.innerHTML = '<div class="alert alert-success">✓ Ninguna oficina requiere atención urgente</div>';
      } else {
        alertDiv.innerHTML = d.alertas.map(a => {
          const borderCol = a.rojas >= 3 ? '#dc2626' : '#d97706';
          const txtCol = a.rojas >= 3 ? '#dc2626' : '#d97706';
          const barras = palancaKeys.map(k => {
            const p = a.palancas[k];
            if (p.sem === 'sin_datos') return '';
            const w = Math.min(p.pct, 100);
            return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
              <span style="width:90px;font-size:11px;color:var(--muted)">${lbl[k]}</span>
              <div style="flex:1;height:5px;background:var(--border);border-radius:2px"><div style="width:${w}%;height:100%;background:${col[p.sem]};border-radius:2px"></div></div>
              <span style="font-size:11px;font-weight:600;color:${col[p.sem]};width:36px">${p.pct}%</span>
            </div>`;
          }).filter(Boolean).join('');
          const accion = a.rojas >= 3 ? 'Acción urgente: reunión esta semana · plan específico' : 'Seguimiento quincenal · reforzar AAFF';
          return `<div class="panel" style="border-left:3px solid ${borderCol};margin-bottom:12px">
            <div class="panel-header"><span class="panel-title" style="color:${txtCol}">${a.nombre} — ${a.rojas} palancas por debajo</span></div>
            <div class="panel-body">${barras}<div class="alert" style="background:${a.rojas>=3?'#FEF2F2':'#FFFBEB'};color:${txtCol};border:none;margin:8px 0 0;padding:8px 12px">${accion}</div></div>
          </div>`;
        }).join('');
      }
    }
  } catch(e) { console.warn('Error palancas:', e.message); }
}

// ── INGRESOS RESUMEN ──────────────────────────────────
async function loadIngresosResumen() {
  try {
    const { desde, hasta } = getDateRange();
    const res = await fetch(`${API}/api/operaciones/resumen?desde=${desde}&hasta=${hasta}`).then(r => r.json());
    if (!res.success) {
      console.warn('Ingresos resumen error:', res.error);
      return;
    }
    const s = res.data;
    const el = id => document.getElementById(id);
    if (el('ir-cobrado'))    el('ir-cobrado').textContent    = fmtK(s.cobrado);
    if (el('ir-pipeline'))   el('ir-pipeline').textContent   = fmtK(s.pipeline);
    if (el('ir-pendiente'))  el('ir-pendiente').textContent  = fmtK(s.pendiente_escritura);
    if (el('ir-ops-inmob'))  el('ir-ops-inmob').textContent  = s.ops_inmobiliarias || 0;
    if (el('ir-ops-atip'))   el('ir-ops-atip').textContent   = s.ops_atipicas || 0;
    // Barras por canal
    const total = parseFloat(s.cobrado) || 1;
    const canales = [
      { lbl:'Directa', val: s.cobrado_directa, color:'var(--navy)' },
      { lbl:'AAFF',    val: s.cobrado_aaff,    color:'var(--gold)' },
      { lbl:'Prescriptor', val: s.cobrado_prescriptor, color:'#7C3AED' },
      { lbl:'Compartida',  val: s.cobrado_compartida,  color:'#d97706' },
    ];
    const barDiv = el('ir-canales');
    if (barDiv) {
      barDiv.innerHTML = canales.map(c => {
        const v = parseFloat(c.val) || 0;
        const w = Math.round(v / total * 100);
        return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="width:80px;font-size:11px;color:var(--muted)">${c.lbl}</span>
          <div style="flex:1;height:12px;background:var(--border);border-radius:3px;overflow:hidden">
            <div style="width:${w}%;height:100%;background:${c.color};border-radius:3px"></div>
          </div>
          <span style="font-size:11px;font-weight:600;color:var(--text);width:70px;text-align:right">${fmtK(v)}</span>
        </div>`;
      }).join('');
    }

    // Panel cobrado por oficina
    const ofDiv = el('ir-por-oficina');
    if (ofDiv) {
      const { desde, hasta } = getDateRange();
      const ofRes = await fetch(`${API}/api/oficinas?desde=${desde}&hasta=${hasta}`).then(r => r.json());
      const lista = ofRes.data || ofRes;
      if (Array.isArray(lista) && lista.length) {
        const max = Math.max(...lista.map(o => parseFloat(o.total_cobrado)||0), 1);
        ofDiv.innerHTML = lista.filter(o => parseFloat(o.total_cobrado) > 0).map(o => {
          const v = parseFloat(o.total_cobrado)||0;
          const w = Math.round(v/max*100);
          return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <span style="width:90px;font-size:11px;color:var(--muted);white-space:nowrap">${o.nombre}</span>
            <div style="flex:1;height:12px;background:var(--border);border-radius:3px;overflow:hidden">
              <div style="width:${w}%;height:100%;background:var(--navy);border-radius:3px"></div>
            </div>
            <span style="font-size:11px;font-weight:600;color:var(--navy);width:70px;text-align:right">${fmtK(v)}</span>
          </div>`;
        }).join('') || '<p style="font-size:12px;color:var(--muted)">Sin datos para este período</p>';
      }
    }
  } catch(e) { console.warn('Error ingresos resumen:', e.message); }
}

// ── CAPTACIONES MATRIZ ────────────────────────────────
async function loadCaptacionesMatriz() {
  const tbody = document.getElementById('matriz-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="loading">Cargando...</td></tr>';
  try {
    const { desde, hasta } = getDateRange();
    const res = await fetch(`${API}/api/captaciones/matriz?desde=${desde}&hasta=${hasta}`).then(r => r.json());
    const lista = res.data || res;
    if (!Array.isArray(lista) || !lista.length) {
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state" style="padding:24px"><div class="empty-state-icon">📊</div><h3>Sin datos</h3><p>Importa captaciones de Inmovilla para ver la matriz.</p></div></td></tr>';
      return;
    }
    // Ordenar tipologías: vivienda primero, resto alfabético
    const tipologias = [...new Set(lista.map(r => r.tipologia))].sort((a,b) => a === 'vivienda' ? -1 : b === 'vivienda' ? 1 : a.localeCompare(b));
    const matrix = {};
    lista.forEach(r => {
      if (!matrix[r.tipologia]) matrix[r.tipologia] = { exclusiva:{num:0,valor:0,honor:0}, nota_encargo:{num:0,valor:0,honor:0} };
      matrix[r.tipologia][r.mandato] = { num: parseInt(r.num)||0, valor: parseFloat(r.valor)||0, honor: parseFloat(r.honorarios)||0 };
    });

    // Totales para fila final
    let totExclNum=0, totExclHon=0, totNeNum=0, totNeHon=0;
    tipologias.forEach(t => {
      const e = matrix[t]?.exclusiva || {num:0,honor:0};
      const n = matrix[t]?.nota_encargo || {num:0,honor:0};
      totExclNum += e.num; totExclHon += e.honor;
      totNeNum   += n.num; totNeHon   += n.honor;
    });

    tbody.innerHTML = tipologias.map(tip => {
      const e = matrix[tip]?.exclusiva    || {num:0,valor:0,honor:0};
      const n = matrix[tip]?.nota_encargo || {num:0,valor:0,honor:0};
      const total = e.num + n.num;
      const tipLbl = tip === 'vivienda' ? '⭐ Vivienda' : tip.charAt(0).toUpperCase() + tip.slice(1);
      return `<tr>
        <td style="font-weight:500;color:var(--navy)">${tipLbl}</td>
        <td class="td-right" style="background:#EFF6FF"><strong style="color:#1E40AF">${e.num}</strong></td>
        <td class="td-right" style="background:#EFF6FF;font-size:11px;color:var(--green)">${fmtK(e.honor)}</td>
        <td class="td-right" style="background:#F5F3FF"><strong style="color:#7C3AED">${n.num}</strong></td>
        <td class="td-right" style="background:#F5F3FF;font-size:11px;color:var(--green)">${fmtK(n.honor)}</td>
        <td class="td-right"><strong>${total}</strong></td>
        <td class="td-right" style="color:var(--green);font-weight:600">${fmtK(e.honor + n.honor)}</td>
      </tr>`;
    }).join('') + `<tr style="background:var(--cream);font-weight:600">
      <td>TOTAL</td>
      <td class="td-right" style="color:#1E40AF">${totExclNum}</td>
      <td class="td-right" style="color:var(--green)">${fmtK(totExclHon)}</td>
      <td class="td-right" style="color:#7C3AED">${totNeNum}</td>
      <td class="td-right" style="color:var(--green)">${fmtK(totNeHon)}</td>
      <td class="td-right">${totExclNum + totNeNum}</td>
      <td class="td-right" style="color:var(--green)">${fmtK(totExclHon + totNeHon)}</td>
    </tr>`;
  } catch(e) { tbody.innerHTML = `<tr><td colspan="7" class="loading">Error: ${e.message}</td></tr>`; console.warn('Error matriz:', e); }
}

// ── CAPTACIONES POR OFICINA ───────────────────────────
async function loadCaptacionesPorOficina() {
  try {
    const { desde, hasta } = getDateRange();
    const [res, resViv] = await Promise.all([
      fetch(`${API}/api/captaciones/por-oficina?desde=${desde}&hasta=${hasta}`).then(r => r.json()),
      fetch(`${API}/api/captaciones/vivienda-excl-por-oficina?desde=${desde}&hasta=${hasta}`).then(r => r.json())
    ]);
    const lista = res.data || res;
    if (!Array.isArray(lista)) return;
    renderCapOf(lista);

    // Segundo panel: viviendas exclusiva
    const listaViv = resViv.data || resViv;
    const tbodyViv = document.getElementById('cap-viv-excl-tbody');
    if (tbodyViv && Array.isArray(listaViv)) {
      const maxExcl = Math.max(...listaViv.map(o => parseInt(o.exclusivas)||0), 1);
      tbodyViv.innerHTML = listaViv.filter(o => (parseInt(o.total)||0) > 0).map(o => {
        const excl  = parseInt(o.exclusivas)||0;
        const ne    = parseInt(o.notas_encargo)||0;
        const total = parseInt(o.total)||0;
        const honor = parseFloat(o.honorarios_excl)||0;
        const w = Math.round(excl / maxExcl * 100);
        return `<tr>
          <td><strong>${o.nombre}</strong></td>
          <td class="td-right" style="color:#1E40AF;font-weight:600">${excl}</td>
          <td class="td-right" style="color:#7C3AED">${ne}</td>
          <td class="td-right"><strong>${total}</strong></td>
          <td class="td-right" style="color:var(--green);font-weight:600">${fmtK(honor)}</td>
          <td style="width:120px">
            <div style="height:5px;background:var(--border);border-radius:2px">
              <div style="width:${w}%;height:100%;background:#1E40AF;border-radius:2px"></div>
            </div>
          </td>
        </tr>`;
      }).join('');
    }
  } catch(e) {}
}

// ── REUNIONES ─────────────────────────────────────────
let _calAño = new Date().getFullYear();
let _calMes  = new Date().getMonth() + 1;
let _reunionActivaId = null;
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function navMes(delta) {
  _calMes += delta;
  if (_calMes > 12) { _calMes = 1; _calAño++; }
  if (_calMes < 1)  { _calMes = 12; _calAño--; }
  loadReuniones();
}

function mostrarFormReunion() {
  const f = document.getElementById('form-reunion-wrap');
  if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

async function guardarReunion() {
  const fecha = document.getElementById('reu-fecha')?.value;
  if (!fecha) { alert('Selecciona una fecha'); return; }
  const payload = {
    fecha,
    oficina_id: parseInt(document.getElementById('reu-oficina')?.value) || null,
    tipo: document.getElementById('reu-tipo')?.value || 'periodica',
    titulo: document.getElementById('reu-titulo')?.value || null
  };
  try {
    const res = await fetch(`${API}/api/reuniones`, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
    }).then(r => r.json());
    if (res.success) {
      document.getElementById('form-reunion-wrap').style.display = 'none';
      document.getElementById('reu-titulo').value = '';
      loadReuniones();
    } else { alert('Error: ' + res.error); }
  } catch(e) { alert('Error: ' + e.message); }
}

async function abrirReunion(id) {
  _reunionActivaId = id;
  try {
    const res = await fetch(`${API}/api/reuniones/${id}`).then(r => r.json());
    if (!res.success) return;
    const r = res.data;
    const det = document.getElementById('reunion-detalle');
    if (det) det.style.display = 'block';
    const tit = document.getElementById('reunion-detalle-titulo');
    const fecha = r.fecha ? new Date(r.fecha).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) : '';
    const tipoLbl = { periodica:'Periódica', extraordinaria:'Extraordinaria', urgente:'Urgente' };
    if (tit) tit.textContent = `${tipoLbl[r.tipo]||r.tipo} · ${r.oficina_nombre||'General'} · ${fecha}`;
    const conc = document.getElementById('reu-conclusiones');
    if (conc) conc.value = r.conclusiones || '';
    renderCompromisos(r.compromisos || []);
    det?.scrollIntoView({ behavior:'smooth', block:'nearest' });
  } catch(e) { console.warn(e); }
}

function renderCompromisos(compromisos) {
  const list = document.getElementById('complist-api');
  if (!list) return;
  if (!compromisos.length) {
    list.innerHTML = '<p style="font-size:12px;color:var(--muted);font-style:italic">Sin compromisos. Añade con "+ Compromiso".</p>';
    return;
  }
  list.innerHTML = compromisos.map(c => `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <div onclick="toggleComp(${c.id})" style="width:18px;height:18px;border-radius:3px;border:2px solid ${c.completado?'var(--green)':'var(--border)'};background:${c.completado?'var(--green)':'transparent'};cursor:pointer;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center">
        ${c.completado ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
      </div>
      <div style="flex:1">
        <div style="font-size:13px;color:var(--text);${c.completado?'text-decoration:line-through;color:var(--muted)':''}">${c.descripcion}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">
          ${c.responsable||'—'} · ${c.plazo ? new Date(c.plazo).toLocaleDateString('es-ES') : 'Sin plazo'}
        </div>
      </div>
      <button onclick="eliminarComp(${c.id})" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:14px;padding:0">✕</button>
    </div>`).join('');
}

async function guardarConclusiones() {
  if (!_reunionActivaId) return;
  const conclusiones = document.getElementById('reu-conclusiones')?.value;
  const res = await fetch(`${API}/api/reuniones/${_reunionActivaId}/conclusiones`, {
    method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ conclusiones })
  }).then(r => r.json());
  if (res.success) showAlert('reu-alert', '✓ Conclusiones guardadas', 'success');
}

async function addCompromiso() {
  if (!_reunionActivaId) { alert('Abre primero una reunión del calendario'); return; }
  const desc = prompt('Compromiso:');
  if (!desc) return;
  const responsable = prompt('Responsable (ej: Rodrigo, Jorge):') || '';
  const plazo = prompt('Plazo (YYYY-MM-DD):') || null;
  const res = await fetch(`${API}/api/reuniones/${_reunionActivaId}/compromisos`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ descripcion: desc, responsable, plazo })
  }).then(r => r.json());
  if (res.success) abrirReunion(_reunionActivaId);
}

async function toggleComp(id) {
  await fetch(`${API}/api/reuniones/compromisos/${id}/toggle`, { method: 'PATCH' });
  abrirReunion(_reunionActivaId);
}

async function eliminarComp(id) {
  if (!confirm('¿Eliminar compromiso?')) return;
  await fetch(`${API}/api/reuniones/compromisos/${id}`, { method: 'DELETE' });
  abrirReunion(_reunionActivaId);
}

async function loadCompromisosPendientes() {
  const list = document.getElementById('compromisos-pendientes');
  if (!list) return;
  try {
    const { desde, hasta } = getDateRange();
    const res = await fetch(`${API}/api/reuniones/compromisos-abiertos?desde=${desde}&hasta=${hasta}`).then(r => r.json());
    const data = res.data || res;
    if (!Array.isArray(data) || !data.length) {
      list.innerHTML = '<div class="empty-state" style="padding:24px"><div class="empty-state-icon">✓</div><h3>Sin compromisos pendientes</h3></div>';
      return;
    }
    list.innerHTML = data.map(c => {
      const vencido = c.plazo && new Date(c.plazo) < new Date();
      return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div onclick="toggleCompGlobal(${c.id})" style="width:18px;height:18px;border-radius:3px;border:2px solid var(--border);cursor:pointer;flex-shrink:0;margin-top:1px"></div>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:500;color:var(--text)">${c.descripcion}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${c.oficina_nombre||'General'} · ${c.responsable||'—'}</div>
          <div style="font-size:11px;color:${vencido?'var(--red)':'var(--muted)'};margin-top:1px">
            ${c.plazo ? (vencido?'⚠ Vencido: ':'Plazo: ') + new Date(c.plazo).toLocaleDateString('es-ES') : 'Sin plazo'}
          </div>
        </div>
      </div>`;
    }).join('');
    const cnt = document.getElementById('compromisos-cnt');
    if (cnt) cnt.textContent = data.length + ' pendientes';
  } catch(e) {}
}

async function toggleCompGlobal(id) {
  await fetch(`${API}/api/reuniones/compromisos/${id}/toggle`, { method: 'PATCH' });
  loadCompromisosPendientes();
}

async function loadReuniones() {
  const lbl = MESES[_calMes - 1] + ' ' + _calAño;
  const el = id => document.getElementById(id);
  if (el('cal-titulo')) el('cal-titulo').textContent = lbl;
  if (el('cal-panel-titulo')) el('cal-panel-titulo').textContent = 'Calendario — ' + lbl;

  // Cargar oficinas en select si vacío
  const selOf = el('reu-oficina');
  if (selOf && selOf.options.length <= 1) {
    try {
      const of = await fetch(`${API}/api/oficinas`).then(r => r.json());
      const lista = of.data || of;
      if (Array.isArray(lista)) {
        selOf.innerHTML = '<option value="">General (todas)</option>' +
          lista.map(o => `<option value="${o.id}">${o.nombre}</option>`).join('');
      }
    } catch(e) {}
  }

  try {
    const res = await fetch(`${API}/api/reuniones?año=${_calAño}&mes=${_calMes}`).then(r => r.json());
    const reuniones = res.data || res;
    if (!Array.isArray(reuniones)) return;

    // Construir calendario
    const grid = el('cal-grid');
    if (!grid) return;
    const primerDia = new Date(_calAño, _calMes - 1, 1).getDay();
    const diasMes   = new Date(_calAño, _calMes, 0).getDate();
    const offset    = primerDia === 0 ? 6 : primerDia - 1;
    const hoy       = new Date();

    const porDia = {};
    reuniones.forEach(r => {
      const d = new Date(r.fecha).getUTCDate();
      if (!porDia[d]) porDia[d] = [];
      porDia[d].push(r);
    });

    const tipoCss = {
      periodica:     'background:#1B2A4A;color:#fff',
      extraordinaria:'background:#C9A84C;color:#1B2A4A',
      urgente:       'background:#dc2626;color:#fff'
    };

    let html = '<div class="cal-day-hd">L</div><div class="cal-day-hd">M</div><div class="cal-day-hd">X</div><div class="cal-day-hd">J</div><div class="cal-day-hd">V</div><div class="cal-day-hd">S</div><div class="cal-day-hd">D</div>';
    for (let i = 0; i < offset; i++) html += '<div class="cal-day"></div>';

    for (let d = 1; d <= diasMes; d++) {
      const esHoy = hoy.getFullYear()===_calAño && hoy.getMonth()+1===_calMes && hoy.getDate()===d;
      const tieneReu = !!porDia[d]?.length;
      let pills = '';
      if (porDia[d]) {
        pills = porDia[d].map(r => {
          const css = tipoCss[r.tipo] || tipoCss.periodica;
          const lbl2 = (r.oficina_nombre||r.titulo||'Reunión').split(' ')[0];
          return `<div onclick="abrirReunion(${r.id})" style="font-size:9px;padding:2px 5px;border-radius:3px;margin-top:2px;cursor:pointer;${css};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lbl2}</div>`;
        }).join('');
      }
      html += `<div class="cal-day${tieneReu?' has-reu':''}${esHoy?' hoy':''}">
        <div class="cal-day-num" ${esHoy?'style="font-weight:700;color:var(--navy)"':''}>${d}</div>
        ${pills}
      </div>`;
    }
    grid.innerHTML = html;

    // Expbar
    const abiertos = reuniones.reduce((a,r) => a + parseInt(r.compromisos_abiertos||0), 0);
    if (el('reu-expbar')) el('reu-expbar').textContent = `${lbl} · ${reuniones.length} reuniones · ${abiertos} compromisos abiertos`;

    // Abrir reunión de hoy automáticamente
    if (!_reunionActivaId) {
      const hoyReu = reuniones.find(r => new Date(r.fecha).getUTCDate()===hoy.getDate() && _calMes===hoy.getMonth()+1 && _calAño===hoy.getFullYear());
      if (hoyReu) abrirReunion(hoyReu.id);
    }
  } catch(e) { console.warn('Error reuniones:', e.message); }
}

// ── ORDENACIÓN GENÉRICA ───────────────────────────────
function makeSorter(dataKey, colMap, renderFn, sortPrefix, defaultCol, defaultAsc) {
  let col = defaultCol, asc = defaultAsc;
  return function(newCol) {
    if (col === newCol) { asc = !asc; } else { col = newCol; asc = defaultAsc; }
    Object.keys(colMap).forEach(c => {
      const el = document.getElementById(sortPrefix + c);
      if (el) el.textContent = c === col ? (asc ? ' ↑' : ' ↓') : '';
    });
    const data = window[dataKey];
    if (!data) return;
    const sorted = [...data].sort((a, b) => {
      const va = colMap[col]?.(a) ?? '';
      const vb = colMap[col]?.(b) ?? '';
      if (typeof va === 'string') return asc ? va.localeCompare(vb) : vb.localeCompare(va);
      return asc ? va - vb : vb - va;
    });
    window[dataKey] = sorted;
    renderFn(sorted);
    window[dataKey] = data; // restaurar original para re-sorts
  };
}

// ── CAPTACIONES SORTABLE ──────────────────────────────
let _capData = [], _capSortCol = 'meses', _capSortAsc = false;

function sortCap(col) {
  if (_capSortCol === col) { _capSortAsc = !_capSortAsc; }
  else { _capSortCol = col; _capSortAsc = ['ref','oficina','direccion','mandato','tipologia','tipo_op'].includes(col); }
  ['ref','oficina','direccion','mandato','tipologia','tipo_op','precio','honor','meses'].forEach(c => {
    const el = document.getElementById('cap-sort-' + c);
    if (el) el.textContent = c === _capSortCol ? (_capSortAsc ? ' ↑' : ' ↓') : '';
  });
  renderCap();
}

function renderCap(data) {
  if (data) _capData = data;
  const tbody = document.getElementById('cap-tbody');
  if (!tbody || !_capData.length) return;
  const sorted = [..._capData].sort((a, b) => {
    let va, vb;
    if      (_capSortCol === 'ref')       { va = a.ref||''; vb = b.ref||''; }
    else if (_capSortCol === 'oficina')   { va = a.oficina_nombre||''; vb = b.oficina_nombre||''; }
    else if (_capSortCol === 'direccion') { va = a.direccion||''; vb = b.direccion||''; }
    else if (_capSortCol === 'mandato')   { va = a.mandato||''; vb = b.mandato||''; }
    else if (_capSortCol === 'tipologia') { va = a.tipologia||''; vb = b.tipologia||''; }
    else if (_capSortCol === 'tipo_op')   { va = a.tipo_operacion||''; vb = b.tipo_operacion||''; }
    else if (_capSortCol === 'precio')    { va = parseFloat(a.precio_captacion)||0; vb = parseFloat(b.precio_captacion)||0; }
    else if (_capSortCol === 'honor')     { va = parseFloat(a.honorarios_potenciales)||0; vb = parseFloat(b.honorarios_potenciales)||0; }
    else if (_capSortCol === 'meses')     { va = parseFloat(a.meses_activa)||0; vb = parseFloat(b.meses_activa)||0; }
    if (typeof va === 'string') return _capSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return _capSortAsc ? va - vb : vb - va;
  });
  tbody.innerHTML = sorted.map(c => {
    const meses = Math.round(parseFloat(c.meses_activa)||0);
    const mCol  = meses >= 7 ? 'var(--red)' : meses >= 5 ? 'var(--amber)' : 'var(--green)';
    const mandTag = c.mandato === 'exclusiva'
      ? '<span class="badge badge-blue">Excl.</span>'
      : '<span class="badge badge-gray">NE</span>';
    return `<tr>
      <td style="font-size:10px;color:var(--muted);font-family:monospace">${c.ref||'—'}</td>
      <td>${c.oficina_nombre||'—'}</td>
      <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.direccion||'—'}</td>
      <td>${mandTag}</td>
      <td><span class="badge badge-gray">${c.tipologia||'—'}</span></td>
      <td><span class="badge badge-gray">${c.tipo_operacion==='alquiler'?'Alquiler':'C-V'}</span></td>
      <td class="td-right">${parseFloat(c.precio_captacion)>0?fmtK(c.precio_captacion):'—'}</td>
      <td class="td-right" style="color:var(--green)">${parseFloat(c.honorarios_potenciales)>0?fmt(c.honorarios_potenciales):'—'}</td>
      <td class="td-right" style="color:${mCol};font-weight:600">${meses}m</td>
    </tr>`;
  }).join('');
}

// ── AAFF SORTABLE ─────────────────────────────────────
let _aaffData = [], _aaffSortCol = 'nombre', _aaffSortAsc = true;

function sortAAFF(col) {
  if (_aaffSortCol === col) { _aaffSortAsc = !_aaffSortAsc; }
  else { _aaffSortCol = col; _aaffSortAsc = ['nombre','oficina','consultor','estado'].includes(col); }
  ['nombre','oficina','consultor','captac','cierres','honor','dias','estado'].forEach(c => {
    const el = document.getElementById('aaff-sort-' + c);
    if (el) el.textContent = c === _aaffSortCol ? (_aaffSortAsc ? ' ↑' : ' ↓') : '';
  });
  renderAaffTabla();
}

function renderAaffTabla(data) {
  if (data) _aaffData = data;
  const tbody = document.getElementById('aaff-tbody');
  if (!tbody || !_aaffData.length) return;
  const sorted = [..._aaffData].sort((a, b) => {
    let va, vb;
    if      (_aaffSortCol === 'nombre')   { va = a.nombre||''; vb = b.nombre||''; }
    else if (_aaffSortCol === 'oficina')  { va = a.oficina_nombre||''; vb = b.oficina_nombre||''; }
    else if (_aaffSortCol === 'consultor'){ va = a.consultor_nombre||''; vb = b.consultor_nombre||''; }
    else if (_aaffSortCol === 'captac')   { va = parseInt(a.total_captaciones)||0; vb = parseInt(b.total_captaciones)||0; }
    else if (_aaffSortCol === 'cierres')  { va = parseInt(a.total_cierres)||0; vb = parseInt(b.total_cierres)||0; }
    else if (_aaffSortCol === 'honor')    { va = parseFloat(a.honorarios_cierres)||0; vb = parseFloat(b.honorarios_cierres)||0; }
    else if (_aaffSortCol === 'dias')     { va = parseInt(a.dias_sin_actividad)||0; vb = parseInt(b.dias_sin_actividad)||0; }
    else if (_aaffSortCol === 'estado')   { va = a.estado||''; vb = b.estado||''; }
    if (typeof va === 'string') return _aaffSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return _aaffSortAsc ? va - vb : vb - va;
  });
  const estBadge = { activo:'badge-green', reactivar:'badge-amber', rescindir:'badge-red' };
  const estLbl   = { activo:'Activo', reactivar:'Reactivar', rescindir:'Rescindir' };
  tbody.innerHTML = sorted.map(d => `<tr>
    <td><strong>${d.nombre}</strong></td>
    <td>${d.oficina_nombre||'—'}</td>
    <td>${d.consultor_nombre||'—'}</td>
    <td class="td-right">${parseInt(d.total_captaciones)||0}</td>
    <td class="td-right">${parseInt(d.total_cierres)||0}</td>
    <td class="td-right">${parseFloat(d.honorarios_cierres)>0?fmt(d.honorarios_cierres):'—'}</td>
    <td class="td-right">${d.dias_sin_actividad!=null?d.dias_sin_actividad+'d':'—'}</td>
    <td><span class="badge ${estBadge[d.estado]||'badge-gray'}" style="cursor:pointer" onclick="cambiarEstadoAAFF(${d.id},'${d.estado}')">${estLbl[d.estado]||d.estado}</span></td>
  </tr>`).join('');
}

// ── GASTOS SORTABLE ───────────────────────────────────
let _gastosData = [], _gastosSortCol = 'fecha', _gastosSortAsc = false;

function sortGastos(col) {
  if (_gastosSortCol === col) { _gastosSortAsc = !_gastosSortAsc; }
  else { _gastosSortCol = col; _gastosSortAsc = ['concepto','categoria','oficina','periodo'].includes(col); }
  ['fecha','concepto','categoria','oficina','periodo','base','total','vencimiento'].forEach(c => {
    const el = document.getElementById('g-sort-' + c);
    if (el) el.textContent = c === _gastosSortCol ? (_gastosSortAsc ? ' ↑' : ' ↓') : '';
  });
  renderGastosTabla();
}

function renderGastosTabla(data) {
  if (data) _gastosData = data;
  const tbody = document.getElementById('gastos-tbody');
  if (!tbody || !_gastosData.length) return;
  const sorted = [..._gastosData].sort((a, b) => {
    let va, vb;
    if      (_gastosSortCol === 'fecha')      { va = a.fecha||''; vb = b.fecha||''; }
    else if (_gastosSortCol === 'concepto')   { va = a.concepto||''; vb = b.concepto||''; }
    else if (_gastosSortCol === 'categoria')  { va = a.categoria||''; vb = b.categoria||''; }
    else if (_gastosSortCol === 'oficina')    { va = a.oficinas||''; vb = b.oficinas||''; }
    else if (_gastosSortCol === 'periodo')    { va = a.periodicidad||''; vb = b.periodicidad||''; }
    else if (_gastosSortCol === 'base')       { va = parseFloat(a.base_imponible)||0; vb = parseFloat(b.base_imponible)||0; }
    else if (_gastosSortCol === 'total')      { va = parseFloat(a.total)||0; vb = parseFloat(b.total)||0; }
    else if (_gastosSortCol === 'vencimiento'){ va = a.fecha_vencimiento_contrato||'9999'; vb = b.fecha_vencimiento_contrato||'9999'; }
    if (typeof va === 'string') return _gastosSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return _gastosSortAsc ? va - vb : vb - va;
  });
  const perLbl = { puntual:'Puntual', mensual:'Mensual', trimestral:'Trimestral', anual:'Anual' };
  tbody.innerHTML = sorted.map(g => {
    const venc = g.fecha_vencimiento_contrato
      ? (new Date(g.fecha_vencimiento_contrato) - new Date() < 60*86400000
        ? `<span style="color:var(--amber);font-weight:500">${fmtFecha(g.fecha_vencimiento_contrato)} ⚠</span>`
        : fmtFecha(g.fecha_vencimiento_contrato))
      : '—';
    return `<tr>
      <td>${fmtFecha(g.fecha)}</td>
      <td><strong>${g.concepto}</strong></td>
      <td><span class="badge badge-gray">${g.categoria||'—'}</span></td>
      <td>${g.oficinas||'Central'}</td>
      <td><span class="badge badge-gray">${perLbl[g.periodicidad]||g.periodicidad}</span></td>
      <td class="td-right">${fmt(g.base_imponible)}</td>
      <td class="td-right"><strong>${fmt(g.total)}</strong></td>
      <td>${venc}</td>
      <td><button class="btn btn-danger btn-sm" onclick="eliminarGasto(${g.id})">✕</button></td>
    </tr>`;
  }).join('');
}

// ── CAPTACIONES POR OFICINA SORTABLE ──────────────────
let _capOfData = [], _capOfSortCol = 'total', _capOfSortAsc = false;

function sortCapOf(col) {
  if (_capOfSortCol === col) { _capOfSortAsc = !_capOfSortAsc; }
  else { _capOfSortCol = col; _capOfSortAsc = col === 'nombre'; }
  ['nombre','excl','ne','total','honor'].forEach(c => {
    const el = document.getElementById('cof-sort-' + c);
    if (el) el.textContent = c === _capOfSortCol ? (_capOfSortAsc ? ' ↑' : ' ↓') : '';
  });
  renderCapOf();
}

function renderCapOf(data) {
  if (data) _capOfData = data;
  const tbody = document.getElementById('cap-oficinas-tbody');
  if (!tbody || !_capOfData.length) return;
  const sorted = [..._capOfData].sort((a, b) => {
    let va, vb;
    if      (_capOfSortCol === 'nombre') { va = a.nombre||''; vb = b.nombre||''; }
    else if (_capOfSortCol === 'excl')   { va = parseInt(a.exclusivas)||0; vb = parseInt(b.exclusivas)||0; }
    else if (_capOfSortCol === 'ne')     { va = parseInt(a.notas_encargo)||0; vb = parseInt(b.notas_encargo)||0; }
    else if (_capOfSortCol === 'total')  { va = parseInt(a.total)||0; vb = parseInt(b.total)||0; }
    else if (_capOfSortCol === 'honor')  { va = parseFloat(a.honorarios)||0; vb = parseFloat(b.honorarios)||0; }
    if (typeof va === 'string') return _capOfSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return _capOfSortAsc ? va - vb : vb - va;
  });
  const maxTotal = Math.max(...sorted.map(o => parseInt(o.total)||0), 1);
  tbody.innerHTML = sorted.map(o => {
    const w = Math.round((parseInt(o.total)||0) / maxTotal * 100);
    return `<tr>
      <td><strong>${o.nombre}</strong></td>
      <td class="td-right" style="color:#1E40AF;font-weight:600">${o.exclusivas||0}</td>
      <td class="td-right" style="color:#7C3AED">${o.notas_encargo||0}</td>
      <td class="td-right"><strong>${o.total||0}</strong></td>
      <td class="td-right" style="color:var(--green)">${fmtK(o.honorarios||0)}</td>
      <td style="width:120px">
        <div style="height:5px;background:var(--border);border-radius:2px">
          <div style="width:${w}%;height:100%;background:var(--navy);border-radius:2px"></div>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── PLANTILLAS DE REUNIÓN ─────────────────────────────
async function loadPlantillas() {
  const grid = document.getElementById('plantillas-grid');
  if (!grid) return;
  try {
    const res = await fetch(`${API}/api/reuniones/plantillas`).then(r => r.json());
    const lista = res.data || [];
    const iconos = { semanal:'📅', quincenal:'🗓️', trimestral:'📊' };
    const colores = { semanal:'var(--navy)', quincenal:'var(--gold)', trimestral:'var(--green)' };
    grid.innerHTML = lista.map(p => `
      <div class="panel" style="border-top:3px solid ${colores[p.frecuencia]||'var(--border)'}">
        <div class="panel-body">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:20px">${iconos[p.frecuencia]||'📋'}</span>
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--navy)">${p.nombre}</div>
                <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">${p.frecuencia}</div>
              </div>
            </div>
            <div style="display:flex;gap:4px">
              <button class="btn btn-outline btn-sm" onclick="editarPlantilla(${p.id})" title="Editar plantilla">✏️</button>
              <button class="btn btn-outline btn-sm" onclick="exportarOrdenDia(${p.id})" title="Exportar PDF">📄</button>
            </div>
          </div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:10px">${p.participantes}</div>
          <button class="btn btn-primary btn-sm" style="width:100%" onclick="usarPlantilla(${p.id})">+ Nueva reunión</button>
        </div>
      </div>`).join('');
  } catch(e) {}
}

let _plantillas = [];
async function editarPlantilla(id) {
  if (!_plantillas.length) {
    const res = await fetch(`${API}/api/reuniones/plantillas`).then(r => r.json());
    _plantillas = res.data || [];
  }
  const p = _plantillas.find(x => x.id === id);
  if (!p) return;

  const modal = document.getElementById('modal-plantilla') || crearModalPlantilla();
  document.getElementById('mp-titulo').textContent = p.nombre;
  document.getElementById('mp-id').value = id;
  document.getElementById('mp-participantes').value = p.participantes || '';
  document.getElementById('mp-orden').value = p.orden_dia || '';
  modal.style.display = 'flex';
}

function crearModalPlantilla() {
  const m = document.createElement('div');
  m.id = 'modal-plantilla';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);display:none;align-items:center;justify-content:center;z-index:1000';
  m.innerHTML = `
    <div style="background:#fff;border-radius:10px;padding:24px;max-width:560px;width:90%;max-height:85vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-family:'Cormorant Garamond',serif;font-size:17px;color:var(--navy)" id="mp-titulo"></div>
        <button onclick="document.getElementById('modal-plantilla').style.display='none'" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted)">✕</button>
      </div>
      <input type="hidden" id="mp-id">
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Participantes</label>
        <input type="text" id="mp-participantes" class="form-input" placeholder="Nombres separados por ·">
      </div>
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">Orden del día</label>
        <textarea id="mp-orden" class="form-textarea" style="min-height:200px" placeholder="1. Punto uno&#10;2. Punto dos&#10;..."></textarea>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-gold" onclick="guardarPlantilla()">Guardar cambios</button>
        <button class="btn btn-outline" onclick="document.getElementById('modal-plantilla').style.display='none'">Cancelar</button>
      </div>
      <div id="mp-msg" style="display:none;margin-top:8px;font-size:11px;padding:6px 10px;border-radius:4px"></div>
    </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if (e.target === m) m.style.display='none'; });
  return m;
}

async function guardarPlantilla() {
  const id = document.getElementById('mp-id').value;
  const participantes = document.getElementById('mp-participantes').value;
  const orden_dia = document.getElementById('mp-orden').value;
  const msg = document.getElementById('mp-msg');
  try {
    const res = await fetch(`${API}/api/reuniones/plantillas/${id}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ participantes, orden_dia })
    }).then(r => r.json());
    if (res.success) {
      if (msg) { msg.style.display='block'; msg.style.background='#ECFDF5'; msg.style.color='#065F46'; msg.textContent='✓ Plantilla guardada'; }
      _plantillas = [];
      setTimeout(() => { document.getElementById('modal-plantilla').style.display='none'; loadPlantillas(); }, 800);
    }
  } catch(e) { if (msg) { msg.style.display='block'; msg.style.background='#FEF2F2'; msg.style.color='#991B1B'; msg.textContent='Error: '+e.message; } }
}

async function exportarOrdenDia(id) {
  if (!_plantillas.length) {
    const res = await fetch(`${API}/api/reuniones/plantillas`).then(r => r.json());
    _plantillas = res.data || [];
  }
  const p = _plantillas.find(x => x.id === id);
  if (!p) return;
  const hoy = new Date().toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <style>
      body { font-family: 'Georgia', serif; max-width: 680px; margin: 40px auto; color: #1a1a1a; }
      .header { border-bottom: 2px solid #1B2A4A; padding-bottom: 16px; margin-bottom: 24px; }
      .logo { font-size: 22px; font-weight: bold; color: #1B2A4A; letter-spacing: .05em; }
      .tipo { font-size: 11px; color: #C9A84C; text-transform: uppercase; letter-spacing: .1em; margin-top: 4px; }
      h1 { font-size: 20px; color: #1B2A4A; margin-bottom: 6px; }
      .fecha { font-size: 13px; color: #6b7280; margin-bottom: 20px; }
      .section-title { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: .1em; color: #6b7280; margin-bottom: 8px; border-bottom: 1px solid #EDE8DF; padding-bottom: 4px; }
      .participantes { font-size: 13px; color: #374151; margin-bottom: 24px; line-height: 1.8; }
      .orden { font-size: 14px; line-height: 2; white-space: pre-wrap; }
      .footer { margin-top: 40px; border-top: 1px solid #EDE8DF; padding-top: 12px; font-size: 11px; color: #9ca3af; }
    </style>
  </head><body>
    <div class="header">
      <div class="logo">LAE HOMES</div>
      <div class="tipo">${p.frecuencia} · Plataforma interna</div>
    </div>
    <h1>${p.nombre}</h1>
    <div class="fecha">${hoy}</div>
    <div class="section-title">Participantes</div>
    <div class="participantes">${(p.participantes||'').split('·').map(x => '· '+x.trim()).join('<br>')}</div>
    <div class="section-title">Orden del día</div>
    <div class="orden">${p.orden_dia||''}</div>
    <div class="footer">LAE HOMES · Documento generado automáticamente</div>
  </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

let _plantillaActual = null;

async function usarPlantilla(id) {
  try {
    const res = await fetch(`${API}/api/reuniones/plantillas`).then(r => r.json());
    _plantillaActual = (res.data||[]).find(p => p.id === id);
    if (!_plantillaActual) return;
    mostrarFormReunion();
    // Pre-rellenar el formulario
    const titulo = document.getElementById('reu-titulo');
    if (titulo) titulo.value = _plantillaActual.nombre;
    // Mostrar orden del día en el área de conclusiones al abrir
    document.getElementById('form-reunion-wrap').scrollIntoView({ behavior:'smooth' });
    // Mostrar orden del día como referencia
    const odDiv = document.getElementById('orden-dia-preview');
    if (odDiv) {
      odDiv.style.display = 'block';
      odDiv.innerHTML = `<div style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Orden del día — ${_plantillaActual.nombre}</div>
        <pre style="font-size:12px;color:var(--text);white-space:pre-wrap;font-family:inherit">${_plantillaActual.orden_dia}</pre>`;
    }
  } catch(e) {}
}

// ── ACTAS ─────────────────────────────────────────────
async function loadActas() {
  const el = document.getElementById('actas-list');
  if (!el) return;
  el.innerHTML = '<div class="loading">Cargando actas...</div>';
  try {
    const { desde, hasta } = getDateRange();
    const res = await fetch(`${API}/api/reuniones/actas?desde=${desde}&hasta=${hasta}`).then(r => r.json());
    const lista = res.data || [];
    if (!lista.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><h3>Sin actas todavía</h3><p>Las actas aparecen aquí cuando guardas conclusiones en una reunión.</p></div>';
      return;
    }
    const tipoLbl = { periodica:'Periódica', extraordinaria:'Extraordinaria', urgente:'Urgente' };
    const tipoCls = { periodica:'badge-gray', extraordinaria:'badge-amber', urgente:'badge-red' };
    el.innerHTML = lista.map(r => {
      const fecha = fmtFecha(r.fecha);
      const comp = parseInt(r.total_compromisos)||0;
      const abiertos = parseInt(r.compromisos_abiertos)||0;
      return `<div class="panel" style="margin-bottom:12px">
        <div class="panel-header" style="cursor:pointer" onclick="abrirReunion(${r.id});nav('reuniones');loadReuniones()">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:13px;font-weight:600;color:var(--navy)">${r.titulo||r.oficina_nombre||'Reunión general'}</span>
            <span class="badge ${tipoCls[r.tipo]||'badge-gray'}">${tipoLbl[r.tipo]||r.tipo}</span>
            ${r.plantilla ? `<span class="badge badge-blue">${r.plantilla}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-size:11px;color:var(--muted)">${fecha}</span>
            ${comp > 0 ? `<span class="badge ${abiertos>0?'badge-amber':'badge-green'}">${abiertos>0?abiertos+' abiertos':'✓ todo cerrado'}</span>` : ''}
          </div>
        </div>
        ${r.conclusiones ? `<div class="panel-body" style="padding:12px 16px">
          <div style="font-size:11px;color:var(--muted);margin-bottom:6px">Conclusiones</div>
          <div style="font-size:12px;color:var(--text);white-space:pre-wrap">${r.conclusiones.slice(0,300)}${r.conclusiones.length>300?'…':''}</div>
        </div>` : ''}
      </div>`;
    }).join('');
  } catch(e) { el.innerHTML = `<div class="loading">Error: ${e.message}</div>`; }
}

// ── DEMANDAS / LEADS ──────────────────────────────────
async function loadDemandas() {
  try {
    const { desde, hasta } = getDateRange();
    const q = `desde=${desde}&hasta=${hasta}`;
    const [sumRes, ofRes, canRes, consRes] = await Promise.all([
      fetch(`${API}/api/demandas/resumen?${q}`).then(r => r.json()),
      fetch(`${API}/api/demandas/por-oficina?${q}`).then(r => r.json()),
      fetch(`${API}/api/demandas/por-canal?${q}`).then(r => r.json()),
      fetch(`${API}/api/demandas/por-consultor?${q}`).then(r => r.json()),
    ]);

    // KPIs
    if (sumRes.success) {
      const s = sumRes.data;
      set('dem-total',       s.total||0);
      set('dem-buscando',    s.buscando||0);
      set('dem-convertidos', s.convertidos||0);
      set('dem-tasa',        (s.tasa_conversion||0) + '%');
      set('dem-arras',       s.arras||0);
      set('dem-reservas',    s.reservas||0);
      set('dem-perdidos',    s.perdidos||0);
    }

    // Por canal
    const canalDiv = document.getElementById('dem-canales');
    if (canalDiv && canRes.success) {
      const lista = canRes.data;
      const maxT = Math.max(...lista.map(c => parseInt(c.total)||0), 1);
      canalDiv.innerHTML = lista.map(c => {
        const t = parseInt(c.total)||0;
        const conv = parseInt(c.convertidos)||0;
        const w = Math.round(t/maxT*100);
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
          <span style="width:110px;font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.canal}</span>
          <div style="flex:1;height:12px;background:var(--border);border-radius:3px;overflow:hidden">
            <div style="width:${w}%;height:100%;background:var(--navy);border-radius:3px"></div>
          </div>
          <span style="font-size:11px;font-weight:600;color:var(--navy);width:36px;text-align:right">${t}</span>
          <span style="font-size:10px;color:var(--green);width:32px;text-align:right">${c.tasa_conversion||0}%</span>
        </div>`;
      }).join('');
    }

    // Situación (calculada del resumen)
    const sitDiv = document.getElementById('dem-situacion');
    if (sitDiv && sumRes.success) {
      const s = sumRes.data;
      const total = parseInt(s.total)||1;
      const items = [
        { lbl:'Buscando activos', val: s.buscando||0, color:'var(--green)' },
        { lbl:'Convertidos (venta/alquiler)', val: s.convertidos||0, color:'#1E40AF' },
        { lbl:'Contrato Arras', val: s.arras||0, color:'var(--amber)' },
        { lbl:'Reservas realizadas', val: s.reservas||0, color:'var(--amber)' },
        { lbl:'Perdidos', val: s.perdidos||0, color:'var(--red)' },
      ];
      sitDiv.innerHTML = items.map(it => {
        const w = Math.round((parseInt(it.val)||0)/total*100);
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="width:170px;font-size:11px;color:var(--muted)">${it.lbl}</span>
          <div style="flex:1;height:12px;background:var(--border);border-radius:3px;overflow:hidden">
            <div style="width:${w}%;height:100%;background:${it.color};border-radius:3px"></div>
          </div>
          <span style="font-size:12px;font-weight:600;color:${it.color};width:42px;text-align:right">${it.val}</span>
          <span style="font-size:10px;color:var(--muted);width:30px">${w}%</span>
        </div>`;
      }).join('');
    }

    // Por oficina
    const tbody = document.getElementById('dem-oficinas-tbody');
    if (tbody && ofRes.success) {
      const lista = ofRes.data;
      const maxT = Math.max(...lista.map(o => parseInt(o.total)||0), 1);
      let totTotal=0, totBusc=0, totConv=0;
      const filas = lista.map(o => {
        const t = parseInt(o.total)||0;
        const b = parseInt(o.buscando)||0;
        const c = parseInt(o.convertidos)||0;
        const a = parseInt(o.arras)||0;
        const r = parseInt(o.reservas)||0;
        const tc = parseFloat(o.tasa_conversion)||0;
        const w = Math.round(t/maxT*100);
        totTotal+=t; totBusc+=b; totConv+=c;
        return `<tr>
          <td><strong>${o.nombre}</strong></td>
          <td class="td-right">${t}</td>
          <td class="td-right" style="color:var(--green);font-weight:500">${b}</td>
          <td class="td-right" style="color:#1E40AF;font-weight:500">${c}</td>
          <td class="td-right" style="color:var(--amber)">${a}</td>
          <td class="td-right" style="color:var(--amber)">${r}</td>
          <td class="td-right"><span class="${tc>=5?'pct-green':tc>=2?'pct-amber':'pct-red'}">${tc}%</span></td>
          <td><div style="height:5px;background:var(--border);border-radius:2px"><div style="width:${w}%;height:100%;background:var(--navy);border-radius:2px"></div></div></td>
        </tr>`;
      }).join('');
      tbody.innerHTML = filas + `<tr style="background:var(--cream);border-top:2px solid var(--border)">
        <td style="font-weight:700">RED TOTAL</td>
        <td class="td-right" style="font-weight:700">${totTotal}</td>
        <td class="td-right" style="color:var(--green);font-weight:700">${totBusc}</td>
        <td class="td-right" style="color:#1E40AF;font-weight:700">${totConv}</td>
        <td class="td-right">—</td><td class="td-right">—</td>
        <td class="td-right" style="font-weight:700">${totTotal>0?Math.round(totConv/totTotal*100*10)/10:0}%</td>
        <td></td>
      </tr>`;
    }

    // Por consultor
    const tbodyCons = document.getElementById('dem-consultores-tbody');
    if (tbodyCons && consRes.success) {
      const lista = consRes.data;
      if (!lista.length) {
        tbodyCons.innerHTML = '<tr><td colspan="6" class="loading">Sin datos para este período</td></tr>';
      } else {
        tbodyCons.innerHTML = lista.map(c => `<tr>
          <td>${c.consultor||'—'}</td>
          <td><span class="badge badge-gray">${c.oficina||'—'}</span></td>
          <td class="td-right">${c.total||0}</td>
          <td class="td-right" style="color:var(--green);font-weight:500">${c.buscando||0}</td>
          <td class="td-right" style="color:#1E40AF;font-weight:500">${c.convertidos||0}</td>
          <td class="td-right"><span class="${(c.tasa_conversion||0)>=5?'pct-green':(c.tasa_conversion||0)>=2?'pct-amber':'pct-red'}">${c.tasa_conversion||0}%</span></td>
        </tr>`).join('');
      }
    }

  } catch(e) { console.warn('Error demandas:', e.message); }
}

// ── AAFF 50-50 ────────────────────────────────────────
let _aaffSelId = null;

async function loadAAFF50() {
  try {
    const [sumRes, listRes, ofRes, medRes] = await Promise.all([
      fetch(`${API}/api/aaff50/resumen`).then(r => r.json()),
      fetch(`${API}/api/aaff50`).then(r => r.json()),
      fetch(`${API}/api/aaff50/stats/oficinas`).then(r => r.json()),
      fetch(`${API}/api/aaff50/stats/medios`).then(r => r.json()),
    ]);

    // KPIs
    if (sumRes.success) {
      const s = sumRes.data;
      set('a50-total',       s.total_despachos||0);
      set('a50-comunidades', (s.total_comunidades||0).toLocaleString('es-ES'));
      set('a50-admin',       (s.total_administrados||0).toLocaleString('es-ES'));
      set('a50-com-comp',    s.comunidades_compartidas||0);
      set('a50-vec-comp',    (s.vecinos_compartidos||0).toLocaleString('es-ES'));
      set('a50-captaciones', s.captaciones_totales||0);
      set('a50-ventas',      s.ventas_totales||0);
      set('a50-impactados',  (s.vecinos_impactados||0).toLocaleString('es-ES'));
      set('a50-tasa',        (s.tasa_interes||0) + '%');
    }

    // Por oficina
    const tOficinas = document.getElementById('a50-oficinas-tbody');
    if (tOficinas && ofRes.success) {
      tOficinas.innerHTML = ofRes.data.map(o => `<tr>
        <td><strong>${o.nombre||'—'}</strong></td>
        <td class="td-right">${o.despachos||0}</td>
        <td class="td-right" style="color:#1E40AF">${o.comunidades||0}</td>
        <td class="td-right" style="color:#1E40AF">${(o.vecinos||0).toLocaleString('es-ES')}</td>
        <td class="td-right" style="color:var(--green);font-weight:600">${o.captaciones||0}</td>
        <td class="td-right" style="color:var(--green);font-weight:600">${o.ventas||0}</td>
      </tr>`).join('');
    }

    // Por medio
    const medDiv = document.getElementById('a50-medios');
    if (medDiv && medRes.success) {
      const max = Math.max(...medRes.data.map(m => parseInt(m.total)||0), 1);
      medDiv.innerHTML = medRes.data.map(m => {
        const t = parseInt(m.total)||0;
        const w = Math.round(t/max*100);
        const tasa = parseFloat(m.tasa)||0;
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
          <span style="width:130px;font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.medio}</span>
          <div style="flex:1;height:10px;background:var(--border);border-radius:3px;overflow:hidden">
            <div style="width:${w}%;height:100%;background:var(--navy);border-radius:3px"></div>
          </div>
          <span style="font-size:11px;font-weight:600;width:28px;text-align:right">${t}</span>
          <span style="font-size:10px;color:var(--amber);width:38px;text-align:right">${tasa}% int.</span>
        </div>`;
      }).join('');
    }

    // Tabla despachos
    const tbody = document.getElementById('a50-tbody');
    const cnt = document.getElementById('a50-count');
    if (tbody && listRes.success) {
      const lista = listRes.data;
      if (cnt) cnt.textContent = lista.length + ' despachos';
      renderA50Tabla(lista);
      // Keep old render for reference but use new sortable version
      if (false) lista.map(d => {
        const dias = d.dias_ultimo_contacto;
        const diasCol = dias == null ? 'var(--muted)' : dias > 30 ? 'var(--red)' : dias > 14 ? 'var(--amber)' : 'var(--green)';
        const diasTxt = dias == null ? 'Sin contacto' : dias === 0 ? 'Hoy' : dias + 'd';
        const tasa = parseFloat(d.tasa_interes)||0;
        return `<tr style="cursor:pointer" onclick="abrirDespacho50(${d.id})">
          <td><strong>${d.nombre}</strong><div style="font-size:10px;color:var(--muted)">${d.ciudad||'—'} · ${d.dni||d.cif||'—'}</div></td>
          <td><span class="badge badge-gray">${d.oficina_nombre||'—'}</span></td>
          <td style="font-size:11px;color:var(--muted)">${d.observaciones||'—'}</td>
          <td class="td-right">${d.comunidades_totales||0}</td>
          <td class="td-right" style="color:#1E40AF">${d.comunidades_compartidas||0}</td>
          <td class="td-right" style="color:#1E40AF">${(d.vecinos_compartidos||0).toLocaleString('es-ES')}</td>
          <td class="td-right" style="color:var(--green);font-weight:600">${d.captaciones_cerradas||0}</td>
          <td class="td-right" style="color:var(--green);font-weight:600">${d.ventas_cerradas||0}</td>
          <td class="td-right">${d.total_comunicaciones||0}</td>
          <td class="td-right"><span style="color:${tasa>=5?'var(--green)':tasa>=2?'var(--amber)':'var(--red)'};font-weight:600">${tasa}%</span></td>
          <td style="color:${diasCol};font-size:11px;font-weight:500">${diasTxt}</td>
          <td>${d.plan_mkt?'<span class="badge badge-green">✓ Sí</span>':'<span class="badge badge-gray">No</span>'}</td>
        </tr>`;
      }).join('');
    }
  } catch(e) { console.warn('Error AAFF50:', e.message); }
}

async function abrirDespacho50(id) {
  _aaffSelId = id;
  const det = document.getElementById('a50-detalle');
  if (det) det.style.display = 'block';
  try {
    const [dRes, comRes] = await Promise.all([
      fetch(`${API}/api/aaff50`).then(r => r.json()),
      fetch(`${API}/api/aaff50/${id}/comunicaciones`).then(r => r.json()),
    ]);
    const d = (dRes.data||[]).find(x => x.id === id);
    if (d) {
      set('a50-det-nombre', d.nombre);
      const info = document.getElementById('a50-det-info');
      if (info) info.innerHTML = `
        <div class="mini"><span class="ml2">Ciudad</span><span class="mv2">${d.ciudad||'—'}</span></div>
        <div class="mini"><span class="ml2">Oficina LAE</span><span class="mv2">${d.oficina_nombre||'—'}</span></div>
        <div class="mini"><span class="ml2">Responsable</span><span class="mv2">${d.observaciones||'—'}</span></div>
        <div class="mini"><span class="ml2">DNI/CIF</span><span class="mv2">${d.dni||d.cif||'—'}</span></div>
        <div class="mini"><span class="ml2">Comunidades totales</span><span class="mv2">${d.comunidades_totales||0}</span></div>
        <div class="mini"><span class="ml2">Administrados</span><span class="mv2">${(d.administrados||0).toLocaleString('es-ES')}</span></div>
        <div class="mini"><span class="ml2">Com. compartidas</span><span class="mv2" style="color:#1E40AF">${d.comunidades_compartidas||0}</span></div>
        <div class="mini"><span class="ml2">Vecinos compartidos</span><span class="mv2" style="color:#1E40AF">${(d.vecinos_compartidos||0).toLocaleString('es-ES')}</span></div>
        <div class="mini"><span class="ml2">Captaciones cerradas</span><span class="mv2" style="color:var(--green)">${d.captaciones_cerradas||0}</span></div>
        <div class="mini"><span class="ml2">Ventas cerradas</span><span class="mv2" style="color:var(--green)">${d.ventas_cerradas||0}</span></div>
        <div class="mini"><span class="ml2">Plan MKT</span><span class="mv2">${d.plan_mkt?'✓ Sí':'No'}</span></div>
        <div class="mini"><span class="ml2">Firma contrato</span><span class="mv2">${d.fecha_firma?fmtFecha(d.fecha_firma):'—'}</span></div>
      `;
    }

    const tCom = document.getElementById('a50-com-tbody');
    if (tCom && comRes.success) {
      const lista = comRes.data;
      if (!lista.length) {
        tCom.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);font-style:italic;padding:12px">Sin comunicaciones registradas</td></tr>';
      } else {
        tCom.innerHTML = lista.map(c => `<tr>
          <td>${c.fecha?fmtFecha(c.fecha):'—'}</td>
          <td style="font-size:11px">${c.tematica||'—'}</td>
          <td><span class="badge badge-gray" style="font-size:9px">${c.medio||'—'}</span></td>
          <td class="td-right">${c.vecinos_recibido||0}</td>
          <td class="td-right" style="color:var(--green)">${c.vecinos_interes||0}</td>
          <td class="td-right" style="color:var(--red)">${c.vecinos_rechazo||0}</td>
        </tr>`).join('');
      }
    }
    det?.scrollIntoView({ behavior:'smooth', block:'nearest' });
  } catch(e) { console.warn(e); }
}

function mostrarFormCom() {
  const f = document.getElementById('form-com');
  if (f) { f.style.display = f.style.display==='none'?'block':'none'; }
  const fi = document.getElementById('com-fecha');
  if (fi) fi.valueAsDate = new Date();
}

async function guardarComunicacion() {
  if (!_aaffSelId) return;
  const payload = {
    fecha: document.getElementById('com-fecha')?.value,
    tematica: document.getElementById('com-tematica')?.value,
    medio: document.getElementById('com-medio')?.value,
    vecinos_recibido: parseInt(document.getElementById('com-recibidos')?.value)||0,
    vecinos_interes:  parseInt(document.getElementById('com-interes')?.value)||0,
    vecinos_rechazo:  parseInt(document.getElementById('com-rechazo')?.value)||0,
  };
  const res = await fetch(`${API}/api/aaff50/${_aaffSelId}/comunicaciones`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
  }).then(r => r.json());
  if (res.success) {
    document.getElementById('form-com').style.display = 'none';
    document.getElementById('com-tematica').value = '';
    abrirDespacho50(_aaffSelId);
    loadAAFF50();
  }
}

// ── ACTIVIDAD COMERCIAL ───────────────────────────────
let _actData = [], _actSortCol = 'total', _actSortAsc = false;

async function loadActividad() {
  try {
    const { desde, hasta } = getDateRange();
    const q = `desde=${desde}&hasta=${hasta}`;
    const año = new Date().getFullYear();

    const [sumRes, comRes, tipoRes, propRes] = await Promise.all([
      fetch(`${API}/api/actividad/resumen?${q}`).then(r => r.json()),
      fetch(`${API}/api/actividad/por-comercial?${q}`).then(r => r.json()),
      fetch(`${API}/api/actividad/por-tipo?${q}`).then(r => r.json()),
      fetch(`${API}/api/actividad/propiedades-activas?${q}`).then(r => r.json()),
    ]);

    // KPIs
    if (sumRes.success) {
      const s = sumRes.data;
      set('act-total',       (parseInt(s.total_visitas)||0).toLocaleString('es-ES'));
      set('act-venta',       s.visitas_venta||0);
      set('act-alquiler',    s.visitas_alquiler||0);
      set('act-eval',        s.visitas_evaluacion||0);
      set('act-adicionales', s.visitas_adicionales||0);
      set('act-canceladas',  s.visitas_canceladas||0);
      set('act-ratio',       (s.ratio_cancelacion||0) + '%');
      set('act-comerciales', s.comerciales_activos||0);
      set('act-propiedades', s.propiedades_visitadas||0);
    }

    // Tipos de visita
    const tipoDiv = document.getElementById('act-tipos');
    if (tipoDiv && tipoRes.success) {
      const lista = tipoRes.data;
      const max = Math.max(...lista.map(t => parseInt(t.total)||0), 1);
      tipoDiv.innerHTML = lista.map(t => {
        const v = parseInt(t.total)||0;
        const w = Math.round(v/max*100);
        const esCancel = t.tipo_seguimiento.includes('Cancelada');
        const color = esCancel ? 'var(--red)' : t.tipo_seguimiento.includes('Venta') ? '#1E40AF' :
                      t.tipo_seguimiento.includes('Alquiler') ? '#7C3AED' : 'var(--navy)';
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="width:200px;font-size:10px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.tipo_seguimiento}</span>
          <div style="flex:1;height:10px;background:var(--border);border-radius:3px;overflow:hidden">
            <div style="width:${w}%;height:100%;background:${color};border-radius:3px"></div>
          </div>
          <span style="font-size:11px;font-weight:600;color:${color};width:32px;text-align:right">${v}</span>
        </div>`;
      }).join('');
    }

    // Propiedades más visitadas
    const tProps = document.getElementById('act-props-tbody');
    if (tProps && propRes.success) {
      tProps.innerHTML = propRes.data.map(p => `<tr>
        <td style="font-family:monospace;font-size:10px;font-weight:600;color:var(--navy)">${p.ref}</td>
        <td><span class="badge badge-gray" style="font-size:9px">${p.oficina||'—'}</span></td>
        <td class="td-right" style="font-weight:700">${p.total_visitas}</td>
        <td class="td-right" style="color:#1E40AF">${p.primeras_visitas}</td>
        <td class="td-right" style="color:var(--red)">${p.canceladas}</td>
        <td style="font-size:11px;color:var(--muted)">${p.ultima_visita?fmtFecha(p.ultima_visita):'—'}</td>
      </tr>`).join('');
    }

    // Comerciales
    _actData = comRes.data || [];
    renderActComerciales();

  } catch(e) { console.warn('Error actividad:', e.message); }
}

function sortActividad(col) {
  if (_actSortCol === col) { _actSortAsc = !_actSortAsc; }
  else { _actSortCol = col; _actSortAsc = col === 'comercial'; }
  ['comercial','total'].forEach(c => {
    const el = document.getElementById('act-sort-' + c[0]);
    if (el) el.textContent = c === col ? (_actSortAsc ? ' ↑' : ' ↓') : '';
  });
  renderActComerciales();
}

function renderActComerciales() {
  const tbody = document.getElementById('act-comerciales-tbody');
  if (!tbody || !_actData.length) return;
  const sorted = [..._actData].sort((a,b) => {
    const va = _actSortCol==='comercial' ? (a.comercial||'') : (parseInt(a.total)||0);
    const vb = _actSortCol==='comercial' ? (b.comercial||'') : (parseInt(b.total)||0);
    if (typeof va==='string') return _actSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return _actSortAsc ? va-vb : vb-va;
  });
  const max = Math.max(...sorted.map(c => parseInt(c.total)||0), 1);
  tbody.innerHTML = sorted.map(c => {
    const t = parseInt(c.total)||0;
    const rc = parseFloat(c.ratio_cancel)||0;
    const w = Math.round(t/max*100);
    return `<tr>
      <td style="font-weight:500">${c.comercial||'—'}</td>
      <td><span class="badge badge-gray" style="font-size:9px">${c.oficina||'—'}</span></td>
      <td class="td-right" style="font-weight:700">${t}</td>
      <td class="td-right" style="color:#1E40AF">${c.venta||0}</td>
      <td class="td-right" style="color:#7C3AED">${c.alquiler||0}</td>
      <td class="td-right">${c.adicionales||0}</td>
      <td class="td-right" style="color:var(--red)">${c.canceladas||0}</td>
      <td class="td-right"><span class="${rc>12?'pct-red':rc>8?'pct-amber':'pct-green'}">${rc}%</span></td>
      <td><div style="height:5px;background:var(--border);border-radius:2px"><div style="width:${w}%;height:100%;background:var(--navy);border-radius:2px"></div></div></td>
    </tr>`;
  }).join('');
}

// ── AAFF 50-50 SORT ───────────────────────────────────
let _a50SortCol = 'nombre', _a50SortAsc = true, _a50Data = [];

function sortAAFF50(col) {
  if (_a50SortCol === col) { _a50SortAsc = !_a50SortAsc; }
  else { _a50SortCol = col; _a50SortAsc = ['nombre','oficina','resp','mkt'].includes(col); }
  ['nombre','oficina','resp','com_total','com_comp','vecinos','captaciones','ventas','msgs','interes','dias','mkt'].forEach(c => {
    const el = document.getElementById('s50-' + c);
    if (el) el.textContent = c === col ? (_a50SortAsc ? ' ↑' : ' ↓') : '';
  });
  if (_a50Data.length) renderA50Tabla(_a50Data);
}

function renderA50Tabla(lista) {
  _a50Data = lista;
  const tbody = document.getElementById('a50-tbody');
  if (!tbody) return;
  const sorted = [...lista].sort((a, b) => {
    let va, vb;
    if (_a50SortCol === 'nombre')      { va = a.nombre||''; vb = b.nombre||''; }
    else if (_a50SortCol === 'oficina'){ va = a.oficina_nombre||''; vb = b.oficina_nombre||''; }
    else if (_a50SortCol === 'resp')   { va = a.observaciones||''; vb = b.observaciones||''; }
    else if (_a50SortCol === 'com_total') { va = parseInt(a.comunidades_totales)||0; vb = parseInt(b.comunidades_totales)||0; }
    else if (_a50SortCol === 'com_comp')  { va = parseInt(a.comunidades_compartidas)||0; vb = parseInt(b.comunidades_compartidas)||0; }
    else if (_a50SortCol === 'vecinos')   { va = parseInt(a.vecinos_compartidos)||0; vb = parseInt(b.vecinos_compartidos)||0; }
    else if (_a50SortCol === 'captaciones') { va = parseInt(a.captaciones_cerradas)||0; vb = parseInt(b.captaciones_cerradas)||0; }
    else if (_a50SortCol === 'ventas')    { va = parseInt(a.ventas_cerradas)||0; vb = parseInt(b.ventas_cerradas)||0; }
    else if (_a50SortCol === 'msgs')      { va = parseInt(a.total_comunicaciones)||0; vb = parseInt(b.total_comunicaciones)||0; }
    else if (_a50SortCol === 'interes')   { va = parseFloat(a.tasa_interes)||0; vb = parseFloat(b.tasa_interes)||0; }
    else if (_a50SortCol === 'dias')      { va = parseInt(a.dias_ultimo_contacto)||9999; vb = parseInt(b.dias_ultimo_contacto)||9999; }
    else if (_a50SortCol === 'mkt')       { va = a.plan_mkt?1:0; vb = b.plan_mkt?1:0; }
    if (typeof va === 'string') return _a50SortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return _a50SortAsc ? va - vb : vb - va;
  });
  const max = Math.max(...sorted.map(d => parseInt(d.total_comunicaciones)||0), 1);
  tbody.innerHTML = sorted.map(d => {
    const dias = d.dias_ultimo_contacto;
    const diasCol = dias == null ? 'var(--muted)' : dias > 30 ? 'var(--red)' : dias > 14 ? 'var(--amber)' : 'var(--green)';
    const diasTxt = dias == null ? 'Sin contacto' : dias === 0 ? 'Hoy' : dias + 'd';
    const tasa = parseFloat(d.tasa_interes)||0;
    return `<tr style="cursor:pointer" onclick="abrirDespacho50(${d.id})">
      <td><strong>${d.nombre}</strong><div style="font-size:10px;color:var(--muted)">${d.ciudad||'—'} · ${d.dni||d.cif||'—'}</div></td>
      <td><span class="badge badge-gray">${d.oficina_nombre||'—'}</span></td>
      <td style="font-size:11px;color:var(--muted)">${d.observaciones||'—'}</td>
      <td class="td-right">${d.comunidades_totales||0}</td>
      <td class="td-right" style="color:#1E40AF">${d.comunidades_compartidas||0}</td>
      <td class="td-right" style="color:#1E40AF">${(d.vecinos_compartidos||0).toLocaleString('es-ES')}</td>
      <td class="td-right" style="color:var(--green);font-weight:600">${d.captaciones_cerradas||0}</td>
      <td class="td-right" style="color:var(--green);font-weight:600">${d.ventas_cerradas||0}</td>
      <td class="td-right">${d.total_comunicaciones||0}</td>
      <td class="td-right"><span style="color:${tasa>=5?'var(--green)':tasa>=2?'var(--amber)':'var(--red)'};font-weight:600">${tasa}%</span></td>
      <td style="color:${diasCol};font-size:11px;font-weight:500">${diasTxt}</td>
      <td>${d.plan_mkt?'<span class="badge badge-green">✓ Sí</span>':'<span class="badge badge-gray">No</span>'}</td>
    </tr>`;
  }).join('');
}
