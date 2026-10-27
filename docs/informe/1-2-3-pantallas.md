---
seccion: "1.2.3"
titulo: "Pantallas y Reportes"
nivel: 3
fase: A
estado: borrador
actualizado: 2026-10-27
---

# 1.2.3 Pantallas y Reportes

Las fuentes de esta sección son la configuración visual del frontend ([`index.css`](../../frontend/src/index.css), [`tailwind.config.ts`](../../frontend/tailwind.config.ts) e [`index.html`](../../frontend/index.html)) y las clases de Tailwind usadas en `frontend/src/`. Las citas `archivo:línea` remiten a la línea donde empieza el elemento citado. La columna Muestra solo se ve en el sitio web: GitHub no muestra estilos en línea.

## 1.2.3.1 Paleta de Colores

### Tokens

Los colores se definen como variables CSS con los tres canales RGB ([`index.css:7`](../../frontend/src/index.css#L7)), y Tailwind los expone como clases con opacidad configurable, por ejemplo `bg-ink/10` ([`tailwind.config.ts:4-6`](../../frontend/tailwind.config.ts#L4-L6)). Las clases por defecto de Tailwind siguen disponibles, porque la configuración extiende el tema en lugar de reemplazarlo ([`tailwind.config.ts:11`](../../frontend/tailwind.config.ts#L11)).

| Muestra | Variable CSS | Clase Tailwind | RGB | Hex | Uso | Apariciones | Fuente |
|---|---|---|---|---|---|---|---|
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#1B2430"></span> | `--color-ink` | `ink` | 27 36 48 | #1B2430 | Texto base (`body`), contorno de foco, botón principal, burbuja de chat propia y fondo de capas modales (`bg-ink/40`) ([`index.css:36`](../../frontend/src/index.css#L36), [`index.css:64`](../../frontend/src/index.css#L64), [`buttonClasses.ts:7`](../../frontend/src/components/ui/buttonClasses.ts#L7)) | 106 | [`index.css:8`](../../frontend/src/index.css#L8), [`tailwind.config.ts:13`](../../frontend/tailwind.config.ts#L13) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#5B6675"></span> | `--color-ink-muted` | `ink-muted` | 91 102 117 | #5B6675 | Texto secundario, placeholder y borde de campo al pasar el puntero; punto de estado del chat desconectado ([`index.css:93`](../../frontend/src/index.css#L93), [`ChatWindow.tsx:50`](../../frontend/src/components/chat/ChatWindow.tsx#L50)) | 110 | [`index.css:9`](../../frontend/src/index.css#L9), [`tailwind.config.ts:13`](../../frontend/tailwind.config.ts#L13) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#DDE2E8"></span> | `--color-line` | `line` | 221 226 232 | #DDE2E8 | Bordes de campos, tarjetas y botón secundario ([`index.css:93`](../../frontend/src/index.css#L93), [`index.css:101`](../../frontend/src/index.css#L101), [`buttonClasses.ts:8`](../../frontend/src/components/ui/buttonClasses.ts#L8)) | 42 | [`index.css:10`](../../frontend/src/index.css#L10), [`tailwind.config.ts:14`](../../frontend/tailwind.config.ts#L14) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#F3F5F7"></span> | `--color-surface` | `surface` | 243 245 247 | #F3F5F7 | Fondo de la página y del botón secundario al pasar el puntero ([`index.css:31`](../../frontend/src/index.css#L31), [`index.css:36`](../../frontend/src/index.css#L36), [`buttonClasses.ts:8`](../../frontend/src/components/ui/buttonClasses.ts#L8)) | 29 | [`index.css:11`](../../frontend/src/index.css#L11), [`tailwind.config.ts:15`](../../frontend/tailwind.config.ts#L15) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#FFFFFF"></span> | `--color-paper` | `paper` | 255 255 255 | #FFFFFF | Fondo de campos, tarjetas, `select` y botón secundario ([`index.css:69`](../../frontend/src/index.css#L69), [`index.css:93`](../../frontend/src/index.css#L93), [`index.css:101`](../../frontend/src/index.css#L101)) | 24 | [`index.css:12`](../../frontend/src/index.css#L12), [`tailwind.config.ts:16`](../../frontend/tailwind.config.ts#L16) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#FFCE3A"></span> | `--color-signal` | `signal` | 255 206 58 | #FFCE3A | Botón de acción destacada y avisos (`border-signal`, `bg-signal/15`) ([`buttonClasses.ts:10`](../../frontend/src/components/ui/buttonClasses.ts#L10), [`EmailNotVerifiedNotice.tsx:18`](../../frontend/src/components/auth/EmailNotVerifiedNotice.tsx#L18)) | 27 | [`index.css:13`](../../frontend/src/index.css#L13), [`tailwind.config.ts:17`](../../frontend/tailwind.config.ts#L17) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#F0B814"></span> | `--color-signal-deep` | `signal-deep` | 240 184 20 | #F0B814 \* | Hover del botón `signal` (comentario del token); punto de estado del chat conectando o reconectando ([`buttonClasses.ts:10`](../../frontend/src/components/ui/buttonClasses.ts#L10), [`ChatWindow.tsx:47`](../../frontend/src/components/chat/ChatWindow.tsx#L47)) | 4 | [`index.css:14`](../../frontend/src/index.css#L14), [`tailwind.config.ts:17`](../../frontend/tailwind.config.ts#L17) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#D93636"></span> | `--color-danger` | `danger` | 217 54 54 | #D93636 | Botón de peligro, borde de campo inválido, texto de error y etiqueta "Perdido" de la tarjeta ilustrativa de la portada ([`buttonClasses.ts:9`](../../frontend/src/components/ui/buttonClasses.ts#L9), [`index.css:93`](../../frontend/src/index.css#L93), [`Home.tsx:26`](../../frontend/src/pages/Home.tsx#L26)) | 20 | [`index.css:15`](../../frontend/src/index.css#L15), [`tailwind.config.ts:18`](../../frontend/tailwind.config.ts#L18) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#FDECEC"></span> | `--color-danger-soft` | `danger-soft` | 253 236 236 | #FDECEC \* | Fondo del ícono de error ([`ErrorBoundary.tsx:12`](../../frontend/src/components/common/ErrorBoundary.tsx#L12)) | 1 | [`index.css:16`](../../frontend/src/index.css#L16), [`tailwind.config.ts:18`](../../frontend/tailwind.config.ts#L18) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#1F8A5B"></span> | `--color-success` | `success` | 31 138 91 | #1F8A5B | Punto de estado del chat conectado ([`ChatWindow.tsx:48`](../../frontend/src/components/chat/ChatWindow.tsx#L48)) | 1 | [`index.css:17`](../../frontend/src/index.css#L17), [`tailwind.config.ts:19`](../../frontend/tailwind.config.ts#L19) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#176B47"></span> | `--color-success-ink` | `success-ink` | 23 107 71 | #176B47 \* | Texto chico sobre blanco con contraste AA (comentario del token); mensajes de éxito ([`Login.tsx:39`](../../frontend/src/pages/auth/Login.tsx#L39)) | 14 | [`index.css:18`](../../frontend/src/index.css#L18), [`tailwind.config.ts:19`](../../frontend/tailwind.config.ts#L19) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#E6F5EE"></span> | `--color-success-soft` | `success-soft` | 230 245 238 | #E6F5EE \* | Fondo de los mensajes de éxito ([`Login.tsx:39`](../../frontend/src/pages/auth/Login.tsx#L39)) | 6 | [`index.css:19`](../../frontend/src/index.css#L19), [`tailwind.config.ts:19`](../../frontend/tailwind.config.ts#L19) |

Tabla 1.2.3-1. Tokens de color del frontend. Fuente: `frontend/src/index.css` y `frontend/tailwind.config.ts`; apariciones con el comando de abajo.

\* Hex calculado a partir de los canales RGB; el resto figura como comentario en `index.css`.

Apariciones: cantidad de clases que usan el token (`bg-`, `text-`, `border-`, `ring-`, `divide-`, `accent-`), incluidas las variantes como `hover:` o con opacidad, en `frontend/src/` sin contar las pruebas. Comando, desde `frontend/`:

```bash
rg -o -N -I -e '\b(bg|text|border|ring|outline|divide|fill|stroke|placeholder|accent|shadow)-(ink-muted|ink|line|surface|paper|signal-deep|signal|danger-soft|danger|success-soft|success-ink|success)\b' src -g '!*.test.*' | sort | uniq -c
```

### Colores fuera de los tokens

Valores de color escritos en el código sin pasar por un token. No se encontraron valores arbitrarios de color de Tailwind (`bg-[#...]`) ni colores en `hsl()`.

| Muestra | Valor | Uso | Ubicación |
|---|---|---|---|
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#FFFFFF"></span> | `#FFFFFF` | Texto sobre fondos `ink`, `danger` y etiquetas de color, con la clase `text-white` de la paleta por defecto de Tailwind (12 apariciones) | [`index.css:106`](../../frontend/src/index.css#L106), [`buttonClasses.ts:7`](../../frontend/src/components/ui/buttonClasses.ts#L7), [`buttonClasses.ts:9`](../../frontend/src/components/ui/buttonClasses.ts#L9), [`Badge.tsx:17`](../../frontend/src/components/ui/Badge.tsx#L17), [`MessageBubble.tsx:20`](../../frontend/src/components/chat/MessageBubble.tsx#L20), [`MessageBubble.tsx:36`](../../frontend/src/components/chat/MessageBubble.tsx#L36), [`FeedPage.tsx:41`](../../frontend/src/pages/reports/FeedPage.tsx#L41), [`Home.tsx:71`](../../frontend/src/pages/Home.tsx#L71), [`MainLayout.tsx:140`](../../frontend/src/layouts/MainLayout.tsx#L140), [`MapView.tsx:60`](../../frontend/src/components/reports/MapView.tsx#L60), [`FilterBar.tsx:62`](../../frontend/src/components/reports/FilterBar.tsx#L62), [`NotificationBell.tsx:42`](../../frontend/src/components/notifications/NotificationBell.tsx#L42) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#F3F5F7"></span> | `#F3F5F7` | `theme-color` del navegador; mismo valor que `surface`, escrito como literal | [`index.html:7`](../../frontend/index.html#L7) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:rgb(27 36 48 / 0.3)"></span> | `rgb(27 36 48 / 0.3)` | Sombra de `.tag-sticker`; valor de `ink` escrito como literal | [`index.css:107`](../../frontend/src/index.css#L107) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:rgb(27 36 48 / 0.12)"></span> | `rgb(27 36 48 / 0.12)` | Sombra `shadow-sheet`; valor de `ink` escrito como literal | [`tailwind.config.ts:45`](../../frontend/tailwind.config.ts#L45) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:rgb(27 36 48 / 0.16)"></span> | `rgb(27 36 48 / 0.16)` | Sombra `shadow-pop`; valor de `ink` escrito como literal | [`tailwind.config.ts:46`](../../frontend/tailwind.config.ts#L46) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#D93636"></span> | `#D93636` | Pastilla "Perdido" de una coincidencia; mismo valor que `danger`, escrito como literal | [`MatchCard.tsx:25`](../../frontend/src/components/reports/MatchCard.tsx#L25) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#2563EB"></span> | `#2563EB` | Pastilla "Encontrado" de una coincidencia | [`MatchCard.tsx:26`](../../frontend/src/components/reports/MatchCard.tsx#L26) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#176B47"></span> | `#176B47` | Pastilla "Coincidencia confirmada"; mismo valor que `success-ink`, escrito como literal | [`MatchCard.tsx:29`](../../frontend/src/components/reports/MatchCard.tsx#L29) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#a16207"></span> | `#a16207` | Estado `pending` en el panel de moderación | [`ReportFlagList.tsx:9`](../../frontend/src/components/moderation/ReportFlagList.tsx#L9) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#15803d"></span> | `#15803d` | Estado `published` en el panel de moderación | [`ReportFlagList.tsx:10`](../../frontend/src/components/moderation/ReportFlagList.tsx#L10) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#b91c1c"></span> | `#b91c1c` | Estado `rejected` en el panel de moderación | [`ReportFlagList.tsx:11`](../../frontend/src/components/moderation/ReportFlagList.tsx#L11) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#1d4ed8"></span> | `#1d4ed8` | Estado `resolved` en el panel de moderación | [`ReportFlagList.tsx:12`](../../frontend/src/components/moderation/ReportFlagList.tsx#L12) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#EF4444"></span> | `#EF4444` | Etiqueta PERDIDO de un reporte, definida en el backend; el frontend la pinta en la tarjeta y en el detalle del reporte, y el flyer la usa en la banda superior y el pie | [`reports.service.ts:39`](../../backend/src/services/reports.service.ts#L39), [`ReportCard.tsx:38`](../../frontend/src/components/reports/ReportCard.tsx#L38), [`ReportDetailPage.tsx:159`](../../frontend/src/pages/reports/ReportDetailPage.tsx#L159), [`flyer.service.ts:130`](../../backend/src/services/flyer.service.ts#L130) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#3B82F6"></span> | `#3B82F6` | Etiqueta ENCONTRADO de un reporte; mismos usos que PERDIDO | [`reports.service.ts:40`](../../backend/src/services/reports.service.ts#L40) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#22C55E"></span> | `#22C55E` | Etiqueta RESUELTO de un reporte; mismos usos que PERDIDO | [`reports.service.ts:41`](../../backend/src/services/reports.service.ts#L41) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#111827"></span> | `#111827` | Fondo y panel de datos del flyer | [`flyer.service.ts:108`](../../backend/src/services/flyer.service.ts#L108), [`flyer.service.ts:140`](../../backend/src/services/flyer.service.ts#L140) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#D1D5DB"></span> | `#D1D5DB` | Descripción en el flyer | [`flyer.service.ts:151`](../../backend/src/services/flyer.service.ts#L151) |
| <span style="display:inline-block;width:1.5em;height:1.5em;border:1px solid #5B6675;background:#9CA3AF"></span> | `#9CA3AF` | Texto secundario del flyer | [`flyer.service.ts:159`](../../backend/src/services/flyer.service.ts#L159) |

Tabla 1.2.3-2. Colores fuera de los tokens. Fuente: `rg -n -e '#[0-9A-Fa-f]{3,8}\b' -e 'rgba?\(' -e 'hsla?\(' -e '\btext-white' frontend/src frontend/index.html backend/src -g '!*.test.*'`.

- Las etiquetas de estado de un reporte usan tres juegos de colores distintos: los tokens (`bg-danger` en la tarjeta ilustrativa de la portada, [`Home.tsx:26`](../../frontend/src/pages/Home.tsx#L26)), los literales de `MatchCard.tsx` y los colores que envía el backend ([`reports.service.ts:38-42`](../../backend/src/services/reports.service.ts#L38-L42)).
- El flyer es una imagen PNG que genera el backend; además de los colores de la tabla, usa `#FFFFFF` para los textos ([`flyer.service.ts:132`](../../backend/src/services/flyer.service.ts#L132)).
- El ícono del sitio, [`public/favicon.svg`](../../frontend/public/favicon.svg) (enlazado en [`index.html:5`](../../frontend/index.html#L5)), usa `#863bff`, `#7e14ff`, `#ede6ff` y `#47bfff`, que no forman parte de la paleta.

## 1.2.3.2 Fuentes

### Familias

| Familia | Uso | Pesos cargados | Carga | Fuente |
|---|---|---|---|---|
| Atkinson Hyperlegible | Clase `font-sans`: texto general (`body`) | 400 y 700 | Google Fonts, hoja de estilos en `index.html` con `preconnect` y `display=swap` | [`tailwind.config.ts:23`](../../frontend/tailwind.config.ts#L23), [`index.css:36`](../../frontend/src/index.css#L36), [`index.html:9-14`](../../frontend/index.html#L9-L14) |
| Bricolage Grotesque | Clase `font-display`: títulos `h1` a `h4` y escala `display-*`; 43 apariciones de la clase | 600, 700 y 800, con eje de tamaño óptico (`opsz`) de 12 a 96 | Google Fonts, misma hoja de estilos | [`tailwind.config.ts:22`](../../frontend/tailwind.config.ts#L22), [`index.css:41-47`](../../frontend/src/index.css#L41-L47), [`index.html:13`](../../frontend/index.html#L13) |
| Monoespaciada del sistema | Clase `font-mono`: códigos de recuperación, configuración de 2FA y detalle de error | No se carga ninguna fuente | Pila por defecto de Tailwind (`ui-monospace`, `SFMono-Regular`, `Menlo`, `Monaco`, `Consolas`, ...) | [`RecoveryCodesModal.tsx:93`](../../frontend/src/components/account/RecoveryCodesModal.tsx#L93), [`TwoFactorSetupPanel.tsx:51`](../../frontend/src/components/account/TwoFactorSetupPanel.tsx#L51), [`ErrorBoundary.tsx:26`](../../frontend/src/components/common/ErrorBoundary.tsx#L26) |
| Inter (flyer) | Textos del flyer que genera el backend | 400 y 700 | Paquete `@fontsource/inter` ^5.3.0, registrado con `@napi-rs/canvas` | [`package.json:28`](../../backend/package.json#L28), [`flyer.service.ts:42-47`](../../backend/src/services/flyer.service.ts#L42-L47) |

Tabla 1.2.3-3. Familias tipográficas. Fuente: archivos de la columna Fuente.

- Si una fuente de Google Fonts no carga, ambas familias caen en la pila sans-serif por defecto de Tailwind (`ui-sans-serif`, `system-ui`, `sans-serif`, ...) ([`tailwind.config.ts:22-23`](../../frontend/tailwind.config.ts#L22-L23)).
- Pesos usados en el código: `font-bold` (700) en 75 apariciones y `font-extrabold` (800) en 2, ambas con `font-display` ([`MainLayout.tsx:58`](../../frontend/src/layouts/MainLayout.tsx#L58), [`NotFound.tsx:12`](../../frontend/src/pages/NotFound.tsx#L12)). Los tamaños `display-*` fijan su propio peso (Tabla 1.2.3-4).
- El peso 600 de Bricolage Grotesque se carga, pero ninguna clase ni estilo del frontend lo usa: no hay `font-semibold` ni `font-weight: 600` en `frontend/src/`.

### Escala tipográfica

| Clase | Tamaño | Interlineado | Espaciado entre letras | Peso | Apariciones | Fuente |
|---|---|---|---|---|---|---|
| `text-display-xl` | 2.75rem (44 px) | 1.02 | -0.03em | 800 | 2, ambas desde el breakpoint `sm:` | [`tailwind.config.ts:27`](../../frontend/tailwind.config.ts#L27) |
| `text-display-lg` | 2rem (32 px) | 1.08 | -0.025em | 800 | 12 | [`tailwind.config.ts:28`](../../frontend/tailwind.config.ts#L28) |
| `text-display-md` | 1.5rem (24 px) | 1.15 | -0.02em | 700 | 8 | [`tailwind.config.ts:29`](../../frontend/tailwind.config.ts#L29) |
| `text-display-sm` | 1.125rem (18 px) | 1.25 | -0.01em | 700 | 16 | [`tailwind.config.ts:30`](../../frontend/tailwind.config.ts#L30) |
| `text-xl` | 1.25rem (20 px) | 1.75rem | — | — | 1 | Tailwind por defecto |
| `text-lg` | 1.125rem (18 px) | 1.75rem | — | — | 3 | Tailwind por defecto |
| `text-base` | 1rem (16 px) | 1.5rem | — | — | 12, 2 de ellas desde `lg:` | Tailwind por defecto; cuerpo en [`index.css:36`](../../frontend/src/index.css#L36) |
| `text-sm` | 0.875rem (14 px) | 1.25rem | — | — | 81 | Tailwind por defecto |
| `text-xs` | 0.75rem (12 px) | 1rem | — | — | 8 | Tailwind por defecto |

Tabla 1.2.3-4. Escala tipográfica usada en el frontend. Fuente: `frontend/tailwind.config.ts` y los valores por defecto de `tailwindcss/defaultTheme` (Tailwind CSS ^3.4.19, [`package.json:54`](../../frontend/package.json#L54)); apariciones en `frontend/src/` sin contar las pruebas.

- El cuerpo es de 16 px ([`tailwind.config.ts:26`](../../frontend/tailwind.config.ts#L26)). Los campos de formulario usan `text-base` para que iOS no amplíe la pantalla al enfocarlos ([`index.css:91-93`](../../frontend/src/index.css#L91-L93)).
- Tamaños fuera de la escala: `text-[6rem]` en la página 404 ([`NotFound.tsx:12`](../../frontend/src/pages/NotFound.tsx#L12)) y `text-[11px]` en el número de cada paso de la portada ([`Home.tsx:71`](../../frontend/src/pages/Home.tsx#L71)) y en el contador de notificaciones ([`NotificationBell.tsx:42`](../../frontend/src/components/notifications/NotificationBell.tsx#L42)).
- El flyer usa Inter en 64, 56 y 34 px con peso 700 y en 36, 32 y 26 px con peso 400 ([`flyer.service.ts:133`](../../backend/src/services/flyer.service.ts#L133), [`flyer.service.ts:144`](../../backend/src/services/flyer.service.ts#L144), [`flyer.service.ts:150`](../../backend/src/services/flyer.service.ts#L150), [`flyer.service.ts:158`](../../backend/src/services/flyer.service.ts#L158), [`flyer.service.ts:167`](../../backend/src/services/flyer.service.ts#L167), [`flyer.service.ts:169`](../../backend/src/services/flyer.service.ts#L169)).

## 1.2.3.3 Pantallas

Pendiente: las capturas se agregan después de integrar #208 y #211, que modifican las pantallas de reportes y comercios.
