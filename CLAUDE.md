# LAE HOMES — Plataforma de Gestión

## Contexto del proyecto

**Cliente:** Joaquín, Director General de LAE HOMES
**Producto:** Plataforma web de gestión interna para la red inmobiliaria
**Stack:** Node.js + Express + PostgreSQL + Railway (Hobby plan) + GitHub (deploy automático)
**URL producción:** https://web-production-b0b986.up.railway.app
**Estado actual:** En producción. La mayoría de módulos están construidos y en uso real; este documento se actualiza con cada sesión para no perder contexto.

**IMPORTANTE — directorio de trabajo:** todo el desarrollo se hace exclusivamente dentro de `lae-plataforma/` (este directorio). Nunca editar copias de referencia sueltas en el directorio padre (`lae_actual.html`, `app.js` standalone, etc.) — no se despliegan y solo generan confusión.

---

## La red

10 oficinas: Alicante, Barcelona, Castellón, Jaén, Madrid, Málaga, Marbella, San Sebastián, Sevilla, Valencia
Objetivo red 2026: 2.500.000€ en honorarios LAE
Personas clave:
- **Joaquín** — Director General, usuario principal de la plataforma
- **Rodrigo Güelfo** — Adjunto a dirección, introduce datos operativos (honorarios, reuniones, compromisos)
- **Inés Bilbao** — Administración, gestión AAFF (ve solo datos administrativos, no comerciales)
- **Jorge** — Recibe informes Excel periódicos

**Nota:** la oficina de **Santander** existe en la base de datos (procede de un CSV de Inmovilla histórico) pero se excluye deliberadamente de Dashboard y Palancas porque no es una oficina operativa de la red. Si aparecen nuevas vistas agregadas por oficina, confirmar con Joaquín si debe excluirse también ahí.

---

## Terminología del negocio (CRÍTICO — usar siempre estos términos)

- **Honorarios LAE** — honorarios efectivamente cobrados (neto después del split con consultor)
- **Honorarios brutos** — antes del split con consultor
- **Generado / Pipeline** — operaciones cerradas pendientes de cobro
- **Pendiente escritura** — señales/arras firmadas pendientes de notaría
- **Captaciones** — inmuebles captados. Se dividen en:
  - **Exclusivas** — mandato en exclusiva (honorarios ~5%)
  - **Notas de encargo (NE)** — sin exclusividad (honorarios ~2,5%)
- **Tipología** — tipo de inmueble: Vivienda, Solar, Local comercial, Garaje, Trastero, Oficina, Nave industrial, Finca rústica, Obra nueva
- **Cierres** — operaciones cerradas en el período
- **Cartera bloqueada** — exclusivas con más de 7 meses sin venta
- **AAFF** — Agentes de la Propiedad Franquiciados (administradores de fincas que derivan operaciones)
- **Canal** — origen de la operación: directa, AAFF, prescriptor, compartida, porteros
- **Palancas** — las 5 métricas operativas que, bien gestionadas, producen el objetivo de Honorarios LAE generados (ver módulo Palancas más abajo — no es un semáforo genérico de cumplimiento)
- **Inmovilla** — CRM externo, fuente de verdad para cartera y captaciones (sync vía CSV manual, no automático todavía)
- **Atípicos** — ingresos no inmobiliarios: Mutua de propietarios, Hipotecas, Energía, Arbitraje notarial, Asesoramiento, Otros

---

## Módulos de la plataforma

### Dashboard General (`view-dashboard`)
- Tarjetas KPI en orden **bruto → LAE**: generado bruto, generado LAE, cobrado bruto, cobrado LAE, pendiente
- Tabla "Rendimiento por oficina" — **excluye Santander** — columnas: Oficina, Objetivo, Generado LAE, Prog. Generado LAE, Cobrado LAE, Prog. Cobrado LAE, Cierres, Captaciones periodo
  - Dos barras de progreso independientes (sobre generado y sobre cobrado), ambas vs. objetivo del período
  - **Captaciones periodo** y **Cierres** se filtran por el rango de fechas del topbar (no son totales acumulados ni solo "activas")
- Filtro de fecha global en topbar (rangos libres + atajos mes/trimestre/año)
- Cabeceras de tabla ordenables (clic en `<th>`, flecha ↑/↓)

### Ingresos — Resumen (`view-ingresos-resumen`)
- 5 tarjetas KPI: Honorarios brutos generados, Honorarios LAE generados, Honorarios brutos cobrados, Honorarios LAE cobrados, Honorarios pendientes de cobro
- Tabla "Operaciones por oficina — Venta / Alquiler / AAFF" en **número de operaciones**
- Tabla duplicada con el mismo desglose pero en **euros de honorarios LAE**
- Ambas respetan el filtro de fecha global

### Ingresos — Nueva operación (`view-nueva-op`)
Formulario largo de una sola página (ya no wizard de pasos), en este orden:
1. Tipo de ingreso: **inmobiliaria** u **atípico** (radio, `onTipoIngresoChange()`)
   - Si atípico → desplegable con Mutua de propietarios / Hipotecas / Energía / Arbitraje notarial / Asesoramiento / Otros, y el campo **Estado desaparece** (no aplica a atípicos)
   - Si inmobiliaria → también sin campo Estado visible; el estado se infiere (pipeline/cobrada) por el flujo, no se selecciona a mano
2. Tipo de operación (CV / alquiler / traspaso / alq. opción compra)
3. Datos de propiedad, oficina, comprador(es), vendedor(es)
4. Datos económicos: precio, % comisión, checkbox "compartida" con % split
5. Canal (`onCanalChange()`): directa / **AAFF** / **prescriptor** / **porteros**
   - AAFF: selector real de despachos (alimentado desde Gestión AAFF), % honorarios AAFF, campo **Honorarios AAFF** (= % × honorarios LAE). Si el % marcado es **50**, se abre un bloque extra con "% honorarios consultor" y "Gastos de gestión" — fórmula: `(honorarios_LAE − honorarios_LAE×%consultor/100 − gastos_gestión) × 50%`
   - Prescriptor / Porteros: nombre + % honorarios, igual de visibles e independientes de si hay AAFF (canal es single-select, así que solo uno de estos bloques se muestra a la vez)
6. Consultores intervinientes: **Captador, Vendedor, Coordinadora, Director de oficina** — los 4 selects deben tener `onchange="calcNuevaOp()"` y deben poblarse todos desde la lista de consultores en `initNuevaOp()` (bug corregido: coordinadora/director quedaban vacíos y sin refresco — ver sección de decisiones técnicas)
7. **"Relación de intervinientes y reparto"** al final del formulario: tabla real (no preview oculto) que lista a TODOS los intervinientes válidos — captador, vendedor, coordinadora, director, y según canal: AAFF/prescriptor/portero, más agencia externa si "compartida" — cada uno con rol, % y importe. Se recalcula con cualquier cambio del formulario, no solo cuando hay precio introducido.
- Todo el reparto (incluido coordinadora/director, antes no se guardaba) se persiste en BD al guardar — ver `calcularRepartoDetalle()` en `public/js/app.js` y columnas de `operaciones` más abajo

### Ingresos — Listado operaciones (`view-operaciones`)
- Filtros: fecha, oficina, canal, consultor, estado
- Columnas: ref, fecha, dirección, tipo, canal, compartida, captador, % capt., vendedor, % venta, precio, H. LAE, estado

### Repartos — AAFF 50/50 (`view-aaff50`)
- Vista dedicada al cálculo especial de honorarios AAFF al 50% (ver fórmula en Nueva operación, paso 5)
- Registrada en `src/index.js` — **ver advertencia en Convenciones técnicas sobre el bug del 404** si esta ruta deja de responder

### Captaciones — Resumen (`view-captaciones`)
- Banner con totales: captaciones, exclusivas, NE, valor cartera, honorarios potenciales
- KPIs: viviendas captadas, viviendas excl., viviendas NE, bloqueadas +7m, en revisión 5-7m
- Distribución por mandato y tipología, evolución mensual

### Captaciones — Matriz tipología × mandato (`view-cap-matriz`)
- Tabla cruzada: filas = tipología, columnas = exclusiva/NE, cada celda con nº + valor + honorarios potenciales
- **Filtro por oficina** (`<select id="cap-matriz-oficina">`)
- Vivienda marcada con ⭐ como tipología principal

### Captaciones — Por oficina (`view-cap-oficinas`)
- Tabla comparativa de captaciones activas por oficina + tabla de viviendas en exclusiva por oficina

### Gastos (`view-gastos`)
- Formulario: concepto, categoría, oficina/s (reparto multi-oficina), periodicidad, base imponible
- **Doble impuesto**: además del impuesto principal (texto libre + %), soporta un segundo impuesto opcional (`tipo_impuesto2_desc`, `pct_impuesto2`) con signo configurable **suma o resta** (`signo_impuesto2`) — para casos como IVA + retención IRPF
- Vencimiento contrato + toggle alerta autorenovación

### AAFF (`view-aaff`)
- Kanban Activos / Reactivar / Rescindir
- Tabla ranking: despacho, oficina, consultor responsable, captaciones, cierres, honorarios, % comisión, estado
- Fuente: Excel AAFF + Inmovilla. Los despachos activos alimentan el selector de AAFF en Nueva operación

### Reuniones (`view-reuniones`) y Compromisos (`view-compromisos`)
- Calendario mensual (no lista semanal), conclusiones + checklist de compromisos con responsable y plazo
- **Integración con Outlook**: pospuesta explícitamente por Joaquín ("lo dejamos para más tarde") — no tocar hasta que lo pida de nuevo

### Actividad Comercial (`view-actividad`)
- Datos de actividad de Inmovilla (no acotar por el filtro de fecha global 2026, ya que hay datos históricos 2024-2025 que se filtraban accidentalmente y la vista parecía vacía)

### Demandas / Leads (`view-demandas`)
- Importación vía `/api/import/demandas`, separada de la importación de propiedades

### Palancas (`view-palancas`) — rediseñado por completo
Las 5 palancas reales del negocio (definidas explícitamente por Joaquín, no inventar otras):
1. Ventas mes (operaciones cerradas en el mes)
2. Captaciones mes (nuevas captaciones en el mes)
3. Nº viviendas en exclusiva (cartera activa)
4. Valor de los inmuebles de la cartera de viviendas en exclusiva
5. Honorarios posibles de la cartera de viviendas en exclusiva

Estas 5 palancas existen para cumplir el objetivo de **Honorarios LAE generados**. Por eso hay 2 tarjetas y 2 columnas **adicionales**, bajo el epígrafe "Resultado de las palancas": **Generado LAE** (pipeline del mes) y **Nº AAFF** (despachos activos) — visualmente diferenciadas (borde/fondo navy) porque NO son palancas en sí, son la consecuencia de gestionar bien las 5 anteriores. No fusionar conceptualmente estas 2 con las 5 palancas reales.
- Excluye la oficina de Santander
- Sin las tarjetas/sección "oficinas que requieren atención" (eliminadas a petición expresa)

### Importar CSV (`view-importar`)
- Importación de Inmovilla (propiedades → capta/operaciones) y de demandas, por separado
- **Cada nueva importación reemplaza los datos de la importación anterior** (no se acumulan) — ver patrón `fuente` en Convenciones técnicas

### Marca y Recursos (`view-recursos`) y Actas (`view-actas`)
- Links a Google Drive / OneDrive, documentos y actas de reuniones

---

## Base de datos — Tablas PostgreSQL (estado actual)

```sql
oficinas (id, nombre, objetivo_anual, objetivo_<periodo>, ciudad)
consultores (id, nombre, oficina_id, email, activo)

operaciones (
  id, ref, fecha, tipo_operacion, tipo_ingreso, tipo_atipico,
  oficina_id, direccion, municipio,
  consultor_captador_id, pct_captador, importe_captador,
  consultor_vendedor_id, pct_vendedor, importe_vendedor,
  consultor_coordinadora_id, pct_coordinadora, importe_coordinadora,
  consultor_director_id, pct_director, importe_director,
  precio_inmueble, pct_comision, comision_bruta, honorarios_lae,
  canal, compartida, agencia_externa, split_pct, importe_agencia_externa,
  aaff_id, pct_aaff, importe_aaff,
  prescriptor_nombre, pct_prescriptor, importe_prescriptor,
  portero_nombre, pct_portero, importe_portero,
  estado, fecha_cobro, observaciones, fuente, created_at, updated_at
)
-- estado: 'pipeline' | 'cobrada' | 'pendiente_escritura'
-- fuente: 'manual' | 'inmovilla' (ver patrón de reemplazo en Convenciones técnicas)
-- IMPORTANTE: coordinadora/director/prescriptor/portero/agencia_externa se calculaban
-- en el formulario pero NO se persistían hasta que se detectó el bug — ahora sí, vía
-- migración idempotente en models/Operacion.js. Si se añade un nuevo tipo de interviniente,
-- replicar el mismo patrón (columna + INSERT + UPDATE permitidos + calcularRepartoDetalle).

captaciones (
  id, ref, fecha_captacion, direccion, municipio, provincia,
  oficina_id, consultor_id,
  mandato,          -- 'exclusiva' | 'nota_encargo'
  tipologia,        -- 'vivienda' | 'solar' | 'local' | 'garaje' | etc.
  tipo_operacion,   -- 'cv' | 'alquiler'
  precio_captacion, pct_honorarios, honorarios_potenciales,
  superficie, estado_inmueble, canal_captacion,
  duracion_mandato, fecha_vencimiento, estado, fuente,
  observaciones, created_at
)

gastos (
  id, concepto, categoria, fecha,
  periodicidad,     -- 'puntual' | 'mensual' | 'trimestral' | 'anual'
  base_imponible, tipo_impuesto_desc, pct_impuesto, total,
  tipo_impuesto2_desc, pct_impuesto2, signo_impuesto2,  -- 'suma' | 'resta' — segundo impuesto opcional
  fecha_vencimiento_contrato, alerta_renovacion,
  nota, created_at
)
gastos_oficinas (gasto_id, oficina_id)  -- reparto multi-oficina

aaff_despachos (
  id, nombre, oficina_id, consultor_responsable_id,
  estado,           -- 'activo' | 'reactivar' | 'rescindir'
  pct_comision, fecha_alta, ultima_actividad, observaciones
)

reuniones (id, oficina_id, fecha, tipo, conclusiones, created_at)
compromisos (id, reunion_id, descripcion, responsable, plazo, completado)
```

---

## Fuentes de datos

| Módulo | Fuente | Cómo llega |
|--------|--------|------------|
| Cartera / Captaciones | **Inmovilla** | CSV manual desde Importar (no hay sync automático todavía) |
| Honorarios / Operaciones | **Rodrigo** entrada manual | Formulario plataforma |
| Gastos | **Manual** | Formulario plataforma |
| AAFF despachos | **Excel AAFF + Inmovilla** | Upload CSV + merge |
| Reuniones / Compromisos | **Rodrigo** | Formulario plataforma |

---

## Identidad visual (IMPORTANTE — respetar siempre)

```
--navy:  #1B2A4A   (azul marino oscuro — color principal)
--gold:  #C9A84C   (dorado apagado — acento)
--cream: #F8F4EE   (crema — fondo)
--cd:    #EDE8DF   (borde suave)

Tipografías:
- Cormorant Garamond (serif) — títulos y display
- Jost (sans-serif) — cuerpo y UI
```

El prototipo completo está en `/lae_plataforma_v5.html` — úsalo como referencia visual exacta para cualquier vista nueva.

---

## Arquitectura Railway

- Un solo servicio Node.js + Express (lae-plataforma)
- PostgreSQL como plugin de Railway
- Variables de entorno: DATABASE_URL, PORT, SESSION_SECRET
- Deploy: push a GitHub `main` → Railway redeploy automático (~1-2 min, cold start 10-30s en Hobby plan)
- Puerto: process.env.PORT || 3000

---

## Convenciones de código

- Archivos de rutas: `/routes/operaciones.js`, `/routes/captaciones.js`, etc. Modelos (SQL): `/models/Operacion.js`, etc.
- SPA: una sola `public/index.html`, toda la lógica cliente en `public/js/app.js`, estilos en `public/css/app.css`. `nav(viewId)` cambia de vista.
- API REST: prefijo `/api/`. Respuestas JSON: `{ success: true, data: [...] }` o `{ success: false, error: '...' }`
- Fechas: ISO en BD, `dd/mm/yyyy` en UI
- **Migraciones idempotentes inline**: cada modelo/ruta que necesita columnas nuevas ejecuta `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` al cargar el módulo, envuelto en `.catch(() => {})`. No usar un sistema de migraciones externo — este patrón ya está extendido por todo el código y debe mantenerse por consistencia.
- **Patrón `fuente`** (`'manual'` vs `'inmovilla'`): permite que una reimportación de CSV borre e inserte solo los registros marcados `fuente='inmovilla'` sin tocar los introducidos a mano. Cualquier nueva importación masiva debe seguir este patrón en vez de un TRUNCATE genérico.
- **Cabeceras de tabla ordenables**: patrón `sortXxx(col)` + `renderXxx()` + `<span id="xxx-sort-col">` con flecha ↑/↓. Ya extendido a casi todas las tablas de análisis — replicar el mismo patrón en vistas nuevas, no inventar otro.
- **Cálculo de reparto centralizado**: `calcularRepartoDetalle(lae, bruta)` en `app.js` es la única fuente de verdad para la tabla de reparto en vivo Y el payload que se guarda en BD. Si se añade un interviniente nuevo, añadirlo ahí (no duplicar el cálculo en otro sitio).

### Cuidado — errores ya sufridos en producción

- **`src/index.js` debe estar siempre commiteado.** Un endpoint (AAFF 50/50) devolvía 404 en producción porque el registro de la ruta solo existía localmente sin commitear, no por un conflicto de rutas. Si una ruta nueva da 404 en Railway pero funciona en local, lo primero a comprobar es `git status` en este archivo.
- **No asumir "no carga" = bug de código.** Dos veces el síntoma fue en realidad un filtro de fecha global (año 2026) que excluía datos históricos 2024-2025 de Inmovilla. Antes de tocar código, comprobar con `curl` a la API en producción si la vista realmente devuelve datos fuera del rango por defecto.
- **Selects de formulario sin `onchange` se "rompen a medias".** Los selects de Captador/Vendedor/Coordinadora/Director en Nueva operación calculaban bien internamente pero no refrescaban la tabla de reparto hasta que el usuario tocaba otro campo — un bug fácil de pasar por alto porque "funciona si tocas algo más". Cualquier `<select>` que alimente un cálculo en vivo necesita su propio `onchange`, no basta con que el campo de `%` adyacente lo tenga.

---

## Próximos pasos / pendientes conocidos

- Confirmar con el usuario si la sincronización Inmovilla debe automatizarse (cron 08:00) o seguir siendo CSV manual — actualmente es manual.
- Integración de Reuniones con calendarios de Outlook: **pospuesta explícitamente**, no iniciar sin que el usuario lo pida.
- Generar PPT / Excel Jorge: botones existen en Dashboard pero la generación automática no está confirmada como implementada — verificar antes de asumir que funciona.
