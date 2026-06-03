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
    captaciones: 'Captaciones',
    aaff: 'AAFF',
    gastos: 'Gastos',
    reuniones: 'Reuniones',
    importar: 'Importar Inmovilla',
    ajustes: 'Ajustes'
  };
  const title = document.getElementById('page-title');
  if (title) title.textContent = titles[viewId] || viewId;
  // Cargar datos de la vista
  if (viewId === 'dashboard') loadDashboard();
  if (viewId === 'operaciones') loadOperaciones();
  if (viewId === 'captaciones') loadCaptaciones();
  if (viewId === 'aaff') loadAAFF();
  if (viewId === 'gastos') loadGastos();
}

// ── DASHBOARD ────────────────────────────────────────
async function loadDashboard() {
  const año = new Date().getFullYear();
  try {
    const [resumenResp, oficinasResp] = await Promise.all([
      fetch(`${API}/api/resumen?año=${año}`),
      fetch(`${API}/api/oficinas?año=${año}`)
    ]);
    const resumen  = await resumenResp.json();
    const oficinas = await oficinasResp.json();

    const r = resumen.data || resumen;
    const cobrado  = parseFloat(r.cobrado_total) || 0;
    const objetivo = parseFloat(r.objetivo_total) || 0;
    const pct      = parseFloat(r.pct_cumplimiento) || 0;

    set('kpi-cobrado',     fmtK(cobrado));
    set('kpi-objetivo',    fmtK(objetivo));
    set('kpi-pct',         pct + '%');
    set('kpi-cierres',     r.cierres_total || 0);
    set('kpi-captaciones', r.captaciones_total || 0);
    set('kpi-generado',    fmtK(r.generado_total || 0));

    // Tabla de oficinas
    const lista = oficinas.data || oficinas;
    const tbody = document.getElementById('dash-tbody');
    if (tbody && Array.isArray(lista)) {
      const max = Math.max(...lista.map(o => parseFloat(o.total_cobrado) || 0), 1);
      tbody.innerHTML = lista.map(o => {
        const cob  = parseFloat(o.total_cobrado) || 0;
        const obj  = parseFloat(o.objetivo_anual) || 0;
        const p    = parseFloat(o.pct_cumplimiento) || 0;
        const w    = Math.round(cob / max * 100);
        const barColor = p >= 90 ? 'var(--green)' : p >= 60 ? 'var(--amber)' : 'var(--red)';
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
          <td class="td-right">${parseInt(o.total_cierres) || 0}</td>
          <td class="td-right">${parseInt(o.total_captaciones) || 0}</td>
        </tr>`;
      }).join('');
    }
  } catch(e) { console.error('Error dashboard:', e); }
}

function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── OPERACIONES ──────────────────────────────────────
async function loadOperaciones() {
  const tbody = document.getElementById('ops-tbody');
  const counter = document.getElementById('ops-count');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="10" class="loading">Cargando...</td></tr>';
  try {
    const año = new Date().getFullYear();
    const res = await fetch(`${API}/api/operaciones?limit=200&desde=${año}-01-01`).then(r => r.json());
    const ops = res.data || res;
    if (!Array.isArray(ops) || !ops.length) {
      tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><div class="empty-state-icon">📋</div><h3>Sin operaciones</h3><p>Las operaciones importadas de Inmovilla aparecerán aquí.<br>También puedes añadir una manualmente.</p></div></td></tr>`;
      return;
    }
    if (counter) counter.textContent = ops.length + ' operaciones';
    const estadoBadge = { cobrada: 'badge-green', pipeline: 'badge-blue', pendiente_escritura: 'badge-amber', cancelada: 'badge-gray' };
    const estadoLbl   = { cobrada: 'Cobrada', pipeline: 'Pipeline', pendiente_escritura: 'Pend. escritura', cancelada: 'Cancelada' };
    tbody.innerHTML = ops.map(op => {
      const est = op.estado || 'pipeline';
      const fecha = fmtFecha(op.fecha);
      const precio = parseFloat(op.precio_inmueble) > 0 ? fmtK(op.precio_inmueble) : '—';
      const honor  = parseFloat(op.honorarios_lae) > 0 ? fmt(op.honorarios_lae) : '—';
      return `<tr>
        <td style="font-size:10px;color:var(--muted);font-family:monospace">${op.ref || '—'}</td>
        <td>${fecha}</td>
        <td>${op.oficina_nombre || '—'}</td>
        <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${op.direccion || '—'}</td>
        <td><span class="badge badge-gray">${op.tipo_operacion === 'cv' ? 'C-V' : op.tipo_operacion || '—'}</span></td>
        <td class="td-right">${precio}</td>
        <td class="td-right" style="color:var(--green);font-weight:500">${honor}</td>
        <td><span class="badge ${estadoBadge[est]||'badge-gray'}" style="cursor:pointer" onclick="cambiarEstadoOp(${op.id},'${est}')">${estadoLbl[est]||est}</span></td>
      </tr>`;
    }).join('');
  } catch(e) { tbody.innerHTML = `<tr><td colspan="10" class="loading">Error: ${e.message}</td></tr>`; }
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
        <div class="kpi-card highlight"><div class="kpi-label">Total activas</div><div class="kpi-value">${s.total||0}</div></div>
        <div class="kpi-card"><div class="kpi-label">Exclusivas</div><div class="kpi-value" style="color:#1E40AF">${s.exclusivas||0}</div></div>
        <div class="kpi-card"><div class="kpi-label">Notas encargo</div><div class="kpi-value" style="color:var(--navy)">${s.notas_encargo||0}</div></div>
        <div class="kpi-card"><div class="kpi-label">Valor cartera</div><div class="kpi-value gold">${fmtK(s.valor_cartera||0)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Honor. potenciales</div><div class="kpi-value gold">${fmtK(s.honorarios_potenciales||0)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Bloqueadas +7m</div><div class="kpi-value red">${s.bloqueadas||0}</div></div>
      `;
    }
    const lista = listRes.data || listRes;
    if (!Array.isArray(lista) || !lista.length) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">🏠</div><h3>Sin captaciones</h3><p>Importa un CSV de Inmovilla para ver las captaciones activas.</p><button class="btn btn-primary" style="margin-top:12px" onclick="nav('importar')">Importar Inmovilla</button></div></td></tr>`;
      return;
    }
    tbody.innerHTML = lista.map(c => {
      const meses = Math.round(parseFloat(c.meses_activa) || 0);
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
        <td><span class="badge badge-gray">${c.tipo_operacion === 'alquiler' ? 'Alquiler' : 'C-V'}</span></td>
        <td class="td-right">${parseFloat(c.precio_captacion)>0 ? fmtK(c.precio_captacion) : '—'}</td>
        <td class="td-right" style="color:var(--green)">${parseFloat(c.honorarios_potenciales)>0 ? fmt(c.honorarios_potenciales) : '—'}</td>
        <td class="td-right" style="color:${mCol};font-weight:600">${meses}m</td>
      </tr>`;
    }).join('');
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
    const estBadge = { activo:'badge-green', reactivar:'badge-amber', rescindir:'badge-red' };
    const estLbl   = { activo:'Activo', reactivar:'Reactivar', rescindir:'Rescindir' };
    tbody.innerHTML = lista.map(d => `<tr>
      <td><strong>${d.nombre}</strong></td>
      <td>${d.oficina_nombre||'—'}</td>
      <td>${d.consultor_nombre||'—'}</td>
      <td class="td-right">${parseInt(d.total_captaciones)||0}</td>
      <td class="td-right">${parseInt(d.total_cierres)||0}</td>
      <td class="td-right">${parseFloat(d.honorarios_cierres)>0 ? fmt(d.honorarios_cierres) : '—'}</td>
      <td class="td-right">${d.dias_sin_actividad!=null ? d.dias_sin_actividad+'d' : '—'}</td>
      <td><span class="badge ${estBadge[d.estado]||'badge-gray'}" style="cursor:pointer" onclick="cambiarEstadoAAFF(${d.id},'${d.estado}')">${estLbl[d.estado]||d.estado}</span></td>
    </tr>`).join('');
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
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">💰</div><h3>Sin gastos registrados</h3><p>Añade el primer gasto con el formulario de abajo.</p></div></td></tr>`;
      return;
    }
    const perLbl = { puntual:'Puntual', mensual:'Mensual', trimestral:'Trimestral', anual:'Anual' };
    tbody.innerHTML = lista.map(g => {
      const venc = g.fecha_vencimiento_contrato
        ? (new Date(g.fecha_vencimiento_contrato) - new Date() < 60*86400000*1000
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
  } catch(e) { tbody.innerHTML = `<tr><td colspan="8" class="loading">Error: ${e.message}</td></tr>`; }
}

async function guardarGasto() {
  const concepto = document.getElementById('g-concepto')?.value?.trim();
  if (!concepto) { alert('El concepto es obligatorio'); return; }
  const base = parseFloat((document.getElementById('g-base')?.value||'0').replace(/[^0-9,]/g,'').replace(',','.')) || 0;
  const pct  = parseFloat(document.getElementById('g-pct')?.value||'0') || 0;
  const categoria = document.querySelector('[name="g-categoria"]:checked')?.value || 'Otros';
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
  const btn = document.getElementById('btn-importar');
  if (btn) btn.disabled = false;
}

async function ejecutarImport() {
  if (!_importFile) return;
  const btn = document.getElementById('btn-importar');
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
    const res = await fetch(`${API}/api/import/inmovilla`, { method:'POST', body: fd }).then(r => r.json());
    clearInterval(iv);
    if (fill) fill.style.width = '100%';
    if (result) {
      result.style.display = 'block';
      if (res.success) {
        const s = res.stats;
        result.className = 'alert alert-success';
        result.innerHTML = `<strong>✓ Importación completada</strong><br>
          ${s.captaciones_nuevas} captaciones · ${s.operaciones_nuevas} operaciones · ${s.ignoradas} ignoradas
          ${s.errores > 0 ? ' · <span style="color:var(--red)">'+s.errores+' errores</span>' : ''}
          <br><small style="opacity:.8">El dashboard ya refleja los datos actualizados.</small>`;
      } else {
        result.className = 'alert alert-error';
        result.innerHTML = `<strong>Error:</strong> ${res.error}`;
      }
    }
  } catch(e) {
    clearInterval(iv);
    if (result) { result.style.display='block'; result.className='alert alert-error'; result.innerHTML='Error: '+e.message; }
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Importar'; }
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
    ['nop-captador','nop-vendedor','aaff-consultor-sel'].forEach(id => {
      const s = document.getElementById(id);
      if (s) s.innerHTML = optsCons;
    });
  } catch(e) {}
}

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
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
