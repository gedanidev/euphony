# Euphony — UI Style (MVP)

Guía inicial de estilo visual basada en los mockups compartidos (tema oscuro + acento morado). Este documento define **tokens**, **componentes** y **patrones** para implementar la UI del MVP con consistencia.

---

## Objetivos

- **Consistencia**: mismos colores, radios, spacing, jerarquía tipográfica.
- **Claridad**: tablas legibles, filtros simples, estados visibles (éxito/error/progreso).
- **Escalabilidad**: que el sistema soporte después mapa de relaciones, letras (LRC), y búsqueda avanzada.

---

## Tokens de diseño

> Los valores son una propuesta inicial. Ajustables cuando tengamos UI real en pantalla.

### Colores

**Base / superficies**
- **bg-0 (app)**: `#0B0B10` (fondo principal)
- **bg-1 (panel)**: `#101018` (cards, panels)
- **bg-2 (elevated)**: `#161624` (hover/selected)
- **border**: `#24243A` (bordes sutiles)

**Texto**
- **text-1 (primary)**: `#F2F2F7`
- **text-2 (secondary)**: `#B6B6C7`
- **text-3 (muted)**: `#7E7E95`

**Acento (marca)**
- **primary-500**: `#8B5CF6` (acciones principales)
- **primary-600**: `#7C3AED` (hover)
- **primary-700**: `#6D28D9` (active)
- **primary-glow**: `rgba(139, 92, 246, 0.25)` (brillo suave)

**Estados**
- **success-500**: `#22C55E`
- **warning-500**: `#F59E0B`
- **danger-500**: `#EF4444`
- **info-500**: `#3B82F6`

### Tipografía (escala sugerida)

- **H1**: 28–32px / 700 / tracking -0.02
- **H2**: 20–24px / 650–700
- **H3**: 16–18px / 650
- **Body**: 14–15px / 450–500
- **Caption**: 12–13px / 450

**Fuente**: sistema (San Francisco en macOS) inicialmente. Más adelante: Inter o una sans similar.

### Radios / bordes / sombras

- **Radius**:
  - **sm**: 10px (chips, botones pequeños)
  - **md**: 14px (cards, inputs)
  - **lg**: 18px (panels grandes)
- **Bordes**: 1px con `border` (no usar sombras fuertes; preferir contraste).
- **Glow** (solo en CTA primario / foco): contorno suave con `primary-glow`.

### Espaciado

- Unidad base: **4px**
- Gaps comunes: 12 / 16 / 24 / 32
- Padding cards: 16–20
- Altura input: 40–44
- Altura row de tabla: 44–52

---

## Layout & navegación

### App shell

- **Sidebar** fija (ancho 240–280px).
- **Header** contextual opcional (en Library/Artists/Playlists) con búsqueda + filtros.
- **Contenido**: max-width amplio; evitar columnas demasiado estrechas en tablas.

### Sidebar

- Ícono + label (14–15px) por item.
- Estado activo: **pill** o highlight con `primary-500` + fondo `bg-2`.
- Secciones sugeridas (MVP):
  - **Library**
  - **Playlists**
  - **Artists**
  - **Albums** (opcional, si lo agregamos como vista)
  - **Import** (antes “Upload”)
  - **Settings**

### Copy (MVP, sin “Walkman”)

- “Upload Music” → **Importar música**
- “Sync to Walkman” → **Exportar** / **Compartir** (según fase)
- “NW-A307 Connected” → **Fuente: Local** (placeholder)

---

## Componentes UI

### Botones

**Primary**
- Fondo: `primary-500`
- Hover: `primary-600`
- Texto: `text-1`
- Radio: md
- Uso: acciones principales (Crear, Guardar, Importar, Exportar)

**Secondary**
- Fondo: `bg-1` / `bg-2` en hover
- Borde: `border`
- Texto: `text-1`
- Uso: acciones secundarias (Shuffle, Añadir, Filtros)

**Tertiary / Ghost**
- Sin fondo, texto `text-2`
- Hover: fondo `bg-2`
- Uso: acciones inline (ver todo, abrir modal)

**Destructive**
- Fondo: `danger-500` (o borde + texto danger, según contexto)

### Inputs

- Fondo: `bg-1`, borde `border`, texto `text-1`
- Placeholder: `text-3`
- Foco: borde `primary-500` + glow suave

**Search**
- Ícono de lupa a la izquierda
- Atajo (opcional): `/` para enfocar búsqueda

### Chips / Badges

**Genre / Tag** (neutral)
- Fondo: `bg-2`, texto `text-2`, borde sutil

**Role badges**
- Principal: `primary-500`
- Colaboración: `info-500`
- Compositor: `warning-500`

**Version type badges**
- Cover / Remix / Remaster: neutral con borde + texto (o colores suaves por tipo)

**Status badges**
- Completed: success
- Failed: danger
- Uploading: primary

### Cards (playlist/album/artist)

- Fondo: `bg-1`, borde `border`, radio md/lg
- Hover: `bg-2`
- Imagen: cuadrada (playlist/album) o circular (artist)
- Meta: title (text-1), subinfo (text-3)

### Tabla / Track list

- Encabezado: texto `text-3`, uppercase suave (opcional), separación clara
- Row hover: fondo `bg-2`
- Selección: borde/indicador `primary-500`
- Acciones por fila: menú “…” o iconos (añadir a playlist, ver detalle)

Columnas recomendadas (Library/Playlist):
- **Título**
- **Artista(s)** (mostrar “X (feat. Y, Z)” visualmente, sin componer artista en DB)
- **Álbum**
- **Género(s)** (chip compacto o tooltip)
- **Duración**
- (Opcional) **Tipo** (badge: cover/remix/remaster)

### Importación (drag & drop + queue)

**Dropzone**
- Área grande con borde punteado `primary-500` a baja opacidad
- Icono central + CTA “Explorar archivos”
- Chips de formatos soportados (MP3, FLAC, etc.)

**Queue**
- Item con:
  - Nombre + tipo (chip)
  - Progreso (barra)
  - Estado (Uploading/Completed/Failed)
  - Acción “Reintentar” para fallos

---

## Patrones de interacción

### Modales

- Fondo overlay oscuro (60–70% opacidad)
- Modal con `bg-1`, borde `border`, radio lg
- Botones: Primary (confirmar), Secondary (cancelar)

Uso típico:
- Crear playlist
- Añadir canciones a playlist
- Seleccionar imagen (API results)
- Importar letras (fuente)

### Empty states

Siempre incluir:
- Mensaje corto
- 1 acción primaria (“Importar música”, “Crear playlist”, “Agregar artista”)
- Ilustración/ícono simple (opcional)

### Notificaciones

- Toasts arriba/derecha:
  - Success (verde)
  - Error (rojo)
  - Info (azul)
- Evitar bloquear el flujo; usar toasts + estados inline.

---

## Accesibilidad mínima (MVP)

- Contraste mínimo: texto `text-2` sobre `bg-1` debe ser legible.
- Estados no solo por color: acompañar con **icono** o **label**.
- Foco visible en inputs y botones (borde + glow).
- Tamaño click mínimo: 40px alto.

---

## Tailwind (guía para implementación)

Cuando se implemente Tailwind, mapear tokens a `tailwind.config`:
- `colors.bg.0/1/2`, `colors.text.1/2/3`, `colors.primary.500/600/700`, `colors.success`, etc.
- `borderRadius`: `sm/md/lg` como arriba.
- `boxShadow`: `glowPrimary` (suave).

---

## Checklist visual (para revisar PRs de UI)

- Botones primarios siempre usan `primary-500`.
- Bordes sutiles (no sombras pesadas).
- Hover consistente en cards/rows.
- Badges coherentes (rol, tipo de versión, estado).
- Sidebar: activo claramente distinguible.
- Copy sin referencias a “Sync to Walkman” mientras no exista.

