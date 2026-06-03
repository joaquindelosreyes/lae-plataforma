# LAE HOMES — Plataforma de Gestión

## Contexto del proyecto

**Cliente:** Joaquín, Director General de LAE HOMES  
**Producto:** Plataforma web de gestión interna para la red inmobiliaria  
**Stack:** Node.js + Express + PostgreSQL + Railway (Hobby plan) + GitHub (deploy automático)  
**Estado actual:** Scaffold creado, base de datos definida, prototipo HTML completo de referencia visual

---

## La red

10 oficinas: Alicante, Barcelona, Castellón, Jaén, Madrid, Málaga, Marbella, San Sebastián, Sevilla, Valencia  
Objetivo red 2026: 2.500.000€ en honorarios LAE  
Personas clave:
- **Joaquín** — Director General, usuario principal de la plataforma
- **Rodrigo Güelfo** — Adjunto a dirección, introduce datos operativos (honorarios, reuniones, compromisos)
- **Inés Bilbao** — Administración, gestión AAFF (ve solo datos administrativos, no comerciales)
- **Jorge** — Recibe informes Excel periódicos

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
- **Canal** — origen de la operación: directa, AAFF, prescriptor, compartida
- **Palancas** — indicadores clave de rendimiento por oficina vs ritmo esperado
- **Inmovilla** — CRM externo, fuente de verdad para cartera y captaciones (sync diario)

---

## Módulos de la plataforma (17 vistas)

### Dashboard General
- KPIs: honorarios LAE, honorarios brutos, generado LAE, generado bruto, pendiente LAE, pendiente bruto
- Cartera activa: exclusivas, NE, viviendas exclusiva, viviendas NE, valor total, honorarios potenciales
- AAFF activos/total con ratio %
- Tabla semáforo de todas las oficinas (verde/ámbar/rojo)
- Alertas activas (cartera bloqueada, AAFF sin actividad, oficinas con ritmo bajo)
- Filtro de fecha global en topbar (rangos libres dd/mm/aaaa + atajos mes/trimestre/año/años anteriores)
- Botones: Generar PPT, Excel Jorge

### Ingresos — Resumen
- Chips multi-selección de oficinas para comparativa
- Dos tipos separados: operaciones inmobiliarias y atípicos
- KPIs: honor. LAE, honor. brutos, pipeline LAE, pendiente (importe + número de ops)
- Gráficos por canal (directa/AAFF/prescriptor/compartida)

### Ingresos — Nueva formalización (7 pasos)
- Paso 0: tipo de ingreso (inmobiliaria / atípico)
- Paso 1: tipo de operación (CV / alquiler / traspaso / alq. opción compra)
- Paso 2: datos propiedad
- Paso 3: comprador/es (múltiples)
- Paso 4: vendedor/es (múltiples)
- Paso 5: datos económicos (precio, % comisión, checkbox compartida con split %)
- Paso 6: agentes intervinientes — captador + % + vendedor + % + AAFF/prescriptor con sus % y destino (nómina/factura)
- Paso 7: repartos calculados automáticamente con nombre de cada agente y total neto LAE

### Ingresos — Listado operaciones
- Filtros: fecha, oficina, canal, consultor, estado
- Columnas: ref, fecha, dirección, tipo, canal, compartida, captador, % capt., vendedor, % venta, precio, H. LAE, estado

### Repartos — Nóminas consultores
- Desglose variable por consultor: ops como captador + % + importe / ops como vendedor + % + importe

### Repartos — Facturas AAFF / Prescriptores
- Tabla separada por tipo, con estado de recepción de factura

### Captaciones — Resumen
- Banner con totales: captaciones, exclusivas, NE, valor cartera, honorarios potenciales
- KPIs: viviendas captadas, viviendas excl., viviendas NE, bloqueadas +7m, en revisión 5-7m
- Distribución por mandato y tipología
- Evolución mensual 2026

### Captaciones — Matriz tipología × mandato
- Tabla cruzada: filas = tipología, columnas = exclusiva/NE
- Cada celda: nº captaciones + valor + honorarios potenciales
- Vivienda marcada con ⭐ como tipología principal

### Captaciones — Por oficina
- Filtros: mandato, tipología
- Tabla comparativa con chips multi-selección

### Captaciones — Listado
- Filtros: mandato, tipología, tipo operación (CV/alquiler), antigüedad (0-3m/4-6m/+7m), oficina
- Columnas incluyen: fecha captación (de Inmovilla), tipo operación CV/alquiler
- Análisis viviendas excl. por tramo de antigüedad con acción recomendada

### Captaciones — Nueva captación
- Paso 1: tipo mandato (exclusiva/NE) con info sobre % honorarios
- Paso 2: tipología con iconos (el % se ajusta automáticamente por tipología)
- Paso 3: datos inmueble + tipo operación (CV/alquiler)
- Paso 4: propietario/s
- Paso 5: datos económicos + honorarios potenciales calculados en tiempo real

### Gastos
- Formulario: concepto libre, categoría, oficina/s (reparto multi-oficina flexible — subconjunto), periodicidad (puntual/mensual/trimestral/anual), base imponible, tipo impuesto LIBRE (texto + %), total auto
- Vencimiento contrato + toggle alerta autorenovación
- Listado con filtros y gráfico comparativo

### Estado Cartera (fuente: Inmovilla sync diario 08:00)
- Filtros: mandato, tipología, tipo operación, semáforo, oficina
- KPIs: excl. activas, NE, viviendas excl., valor, bloqueadas, en revisión
- Tabla bloqueada destacada (+7 meses) con fecha captación y visitas
- Sync automático desde Inmovilla (CSV o webhook)

### AAFF
- Chips multi-selección de oficinas
- KPIs: activos/total (ratio %), captaciones, cierres, facturación, requieren acción
- Kanban: Activos / Reactivar / Rescindir
- Tabla ranking con: nombre despacho, oficina, **consultor responsable**, captaciones, cierres, honorarios captaciones, honorarios cierres, % comisión, a facturar, último contacto, estado
- Fuente: Excel AAFF + Inmovilla

### Reuniones
- Calendario mensual (NO lista semanal)
- Reuniones periódicas + extraordinarias + urgentes (colores distintos)
- Al abrir una reunión: fecha + conclusiones (textarea) + compromisos (checklist con responsable y plazo)

### Palancas (módulo independiente — datos automáticos sin entrada manual)
- Matriz: filas = oficinas, columnas = palancas (Honor. LAE, Captac. excl., Cierres, AAFF activos, Cartera excl.)
- Cada celda: % cumplimiento vs ritmo esperado, coloreada (↑ verde / → ámbar / ↓ rojo)
- Ritmo esperado calculado dinámicamente según el período seleccionado
- Resumen por palanca (media de red)
- Detalle de oficinas por debajo con acción recomendada

### Marca y Recursos
- Links a Google Drive / OneDrive (no gestor de archivos propio)
- Documentos: Manual Coordinadora, Guía Comprador, Guía Vendedor, Propuesta de Valor, Planes de oficina 2026

---

## Base de datos — Tablas PostgreSQL

```sql
-- Tablas principales
oficinas (id, nombre, objetivo_anual, ciudad)
consultores (id, nombre, oficina_id, email, activo)

operaciones (
  id, ref, fecha, tipo_operacion, tipo_ingreso,
  oficina_id, 
  consultor_captador_id, pct_captador,
  consultor_vendedor_id, pct_vendedor,
  precio_inmueble, pct_comision, comision_bruta, honorarios_lae,
  canal, compartida, agencia_externa, split_pct,
  estado, observaciones, created_at
)

captaciones (
  id, ref, fecha_captacion, direccion, municipio, provincia,
  oficina_id, consultor_id,
  mandato,          -- 'exclusiva' | 'nota_encargo'
  tipologia,        -- 'vivienda' | 'solar' | 'local' | 'garaje' | etc.
  tipo_operacion,   -- 'cv' | 'alquiler'
  precio_captacion, pct_honorarios, honorarios_potenciales,
  superficie, estado_inmueble, canal_captacion,
  duracion_mandato, fecha_vencimiento,
  observaciones, created_at
)

gastos (
  id, concepto, categoria, fecha,
  periodicidad,     -- 'puntual' | 'mensual' | 'trimestral' | 'anual'
  base_imponible, tipo_impuesto_desc, pct_impuesto, total,
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
| Cartera / Captaciones | **Inmovilla** | CSV diario o webhook, cron job 08:00 |
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

El prototipo completo está en `/lae_plataforma_v5.html` — úsalo como referencia visual exacta para cualquier vista que desarrolles.

---

## Arquitectura Railway

- Un solo servicio Node.js + Express (lae-plataforma)
- PostgreSQL como plugin de Railway
- Variables de entorno: DATABASE_URL, PORT, SESSION_SECRET
- Deploy: push a GitHub main → Railway redeploy automático
- Puerto: process.env.PORT || 3000

---

## Convenciones de código

- Archivos de rutas: `/routes/operaciones.js`, `/routes/captaciones.js`, etc.
- Modelos (queries SQL): `/models/Operacion.js`, etc.
- Vistas: HTML con los mismos estilos CSS del prototipo v5
- API REST: prefijo `/api/` para todos los endpoints
- Respuestas JSON: `{ success: true, data: [...] }` o `{ success: false, error: '...' }`
- Fechas: siempre en formato ISO en BD, formato `dd/mm/yyyy` en UI

---

## Estado actual del desarrollo

- [x] Prototipo HTML completo (17 vistas, diseño definitivo) → `lae_plataforma_v5.html`
- [x] Scaffold del proyecto creado (package.json, server.js, db.js, schema.sql)
- [ ] Módulo Ingresos — CRUD operaciones
- [ ] Módulo Captaciones — CRUD + sync Inmovilla
- [ ] Módulo Gastos — CRUD con periodicidad
- [ ] Módulo AAFF — kanban + ranking
- [ ] Módulo Reuniones — calendario + compromisos
- [ ] Módulo Palancas — cálculo automático
- [ ] Dashboard — agregación de todos los módulos
- [ ] Deploy Railway + dominio

---

## Próximos pasos (en orden)

1. Módulo Ingresos completo (CRUD + nóminas calculadas)
2. Módulo Captaciones + parser CSV Inmovilla
3. Gastos + AAFF + Reuniones
4. Dashboard + Palancas
5. Deploy Railway + PPT automático para Jorge
