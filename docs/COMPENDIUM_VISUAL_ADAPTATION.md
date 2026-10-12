# Adaptación visual de Compendium

Registro de implementación y comprobación: 9 de octubre de 2026.

## Alcance

Fuentes independientes de Compendium y consumo desde el perfil `sources` de
Suite. La salida estática publicada, los formatos portables, los contratos
públicos y los vendors no se modificaron en esta entrega. El repositorio ya
contenía cambios locales en esas áreas; se conservaron.

## Inventario de equivalencia

Se revisaron los componentes y callbacks existentes antes de reorganizar cada
superficie. La presentación utiliza `forgeUi.css` y estilos aislados por
`.forge-compendium`.

| Superficie                | Controles, datos y estados conservados                                                                                                            | Presentación resultante                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Inicio y barra superior   | Abrir carpeta, recientes, continuar, identidad, revelar carpeta, ajustes, diagnóstico, comentarios, tema, lectura Web/Libro, controles de ventana | Acciones de apertura y tarjetas de recientes; búsqueda y opciones de lectura en la barra superior existente               |
| Navegación                | Rutas de portada, fichas, historias, eventos, grafo, mapas y cronología; orden de tipos configurado                                               | Explorador con barra de 40 px y panel de 280 px, grupos plegables, contadores y selección visible                         |
| Búsqueda                  | Coincidencia por nombre/tipo, fichas y eventos; límite de ocho resultados                                                                         | Combobox/listbox, flechas, Enter, Escape, resultado activo y estado vacío                                                 |
| Portada y fichas          | Imagen, descripción, retrato, etiquetas, enlaces, entidades destacadas, relaciones y apariciones                                                  | Categorías abren su grupo en el índice; artículo y paneles relacionados separados, apilados al faltar espacio             |
| Historias                 | Orden de historias/secuencias/eventos, enlaces a canon y navegación anterior/siguiente                                                            | Jerarquía en el explorador y superficies de lectura uniformes                                                             |
| Vistas                    | Grafo existente, mapas/imágenes/pines, entradas fechadas de cronología, Libro «Próximamente»                                                      | Grafo y mapas pliegan temporalmente el panel; conserva el estado para volver a lectura                                    |
| Perfiles                  | Crear, duplicar, guardar, activar, eliminar (conservando al menos uno), preview                                                                   | Una cabecera; acción principal «Guardar y activar»; borrar y ajustes secundarios en grupo avanzado                        |
| Selección de publicación  | Estados automáticos, tipos, carpetas, etiquetas, búsqueda, incluir/excluir explícito, jerarquía narrativa, política de dependencias               | Nombre y selección visibles; reglas, ajustes e IDs técnicos desplegables; valores originales conservados en ambos idiomas |
| Diagnóstico y exportación | Resumen de fichas/historias/dependencias/exclusiones/assets/enlaces, advertencias, comando ZIP                                                    | Avisos y resumen comunes; «Copiar comando ZIP» con estado de éxito separado de los errores                                |
| Correcciones y diálogos   | Markdown original/propuesto, motivo, diferencia, revisión, errores y restricciones durante el guardado                                            | Estilo común, foco contenido y restauración; campos dentro de grupos cerrados excluidos del recorrido de Tab              |

`CompendiumWorkspace` mantiene las secciones montadas. Publicación también
permanece montada mientras se consulta lectura, conservando el borrador. Cambiar,
crear o duplicar otro perfil con cambios pendientes ofrece guardar, descartar
explícitamente o cancelar. Un error mantiene el borrador y bloquea los guards.

Las preferencias opcionales `settings.explorer` contienen sección, apertura,
ancho y grupos plegados. Se recuperan desde localStorage con valores compatibles
(Índice abierto, 280 px; ancho permitido de 220 a 420 px). Los desplegables de
contenido utilizan sessionStorage. Ninguna de esas operaciones escribe el canon
ni los perfiles de publicación. Los idiomas de interfaz ES/EN no traducen
contenido del universo, tipos personalizados, nombres, IDs ni rutas.

## Comprobaciones automatizadas

- Compendium: `npm run build` (incluye `typecheck`) y `npm test`: 12 suites,
  65 pruebas, incluyendo publicación, assets, foco, preferencias y guards.
- Suite: `npm run build:sources` (incluye `typecheck:sources`),
  `verify:suite-navigation` (6 checks) y `verify:suite-library` (8 checks).
- Rust: `cargo check --manifest-path src-tauri/Cargo.toml` en Compendium y
  `cargo check --manifest-path apps/suite/src-tauri/Cargo.toml` en Suite.
- Permanecen advertencias de tamaño de bundles y de importación dinámica de PB;
  Rust de Suite conserva advertencias de helpers de menú sin uso.

## Tauri real y evidencias locales

Playwright CLI conectado al WebView2 de Compendium (CDP 9225) y Suite (CDP 9223).
Se utilizó un universo desechable en `output/playwright/compendium-visual-vault`,
con 38 fichas, un índice extenso, títulos largos, enlaces, dos mapas (uno sin
imagen), fechas y una historia con dos eventos. Los cambios de perfiles y la
propuesta de corrección se hicieron únicamente en ese universo.

Las capturas de portada, artículo y publicación usan el mismo universo en
1440×900, 1280×720, 1100×720 y 900×700, ES/EN y Forge claro/oscuro:

- `output/playwright/cp-cover-{ancho}-{es|en}-{forge-mono-dark|forge-mono-light}.png`
- `output/playwright/cp-article-{ancho}-{es|en}-{forge-mono-dark|forge-mono-light}.png`
- `output/playwright/cp-publication-{ancho}-{es|en}-{forge-mono-dark|forge-mono-light}.png`
- `output/playwright/cp-reduced-motion-{es|en}.png`

No se detectaron errores de ejecución durante las matrices finales. El log de
desarrollo conserva errores transitorios de HMR de ediciones anteriores; no
se interpreta ese histórico como aceptación ni como un fallo del build final.
Las capturas intermedias y snapshots se conservan para comparación, pero no hay
una matriz completa anterior al cambio con este mismo universo de prueba.

| Ventana                             | Ancho real de Compendium | Ancho disponible de lectura | Panel superpuesto |
| ----------------------------------- | ------------------------ | --------------------------- | ----------------- |
| Standalone 1440 / 1280 / 1100 / 900 | 1440 / 1280 / 1100 / 900 | 1096 / 936 / 756 / 836      | Solo 900          |
| Suite 1440 / 1280 / 1100 / 900      | 1384 / 1224 / 1044 / 844 | 1040 / 880 / 700 / 780      | Solo 900          |

El umbral se calcula con ResizeObserver sobre el espacio real de la aplicación,
descontando el marco, la barra de 40 px y el panel, para conservar 560 px de
contenido antes de pasar a superposición. Las mediciones con panel superpuesto
corresponden a lectura con el panel cerrado.

Flujos comprobados en Compendium nativo:

- Perfil pendiente → cancelar transición / volver a lectura y Publicación →
  guardar y activar → recargar → mismo nombre y selección.
- Fallo real de escritura: sustitución temporal de un archivo de perfil de
  prueba por una carpeta. El error conserva borrador y bloquea Inicio/cambio de
  universo. Se restauró el archivo y se verificó un guardado posterior correcto.
- Copiar comando ZIP: operación nativa de escritura al portapapeles confirmada
  por el estado de éxito. No se generó un ZIP desde la GUI.
- Grafo con canvas dimensionado y panel plegado; mapas → pin → ficha;
  cronología de entradas fechadas; historia → evento → canon.
- Búsqueda con ocho resultados, flechas y Enter; menú Vista con Escape y foco;
  Libro mantiene su estado «Próximamente».
- Corrección → archivo de propuesta para revisión; canon sin modificación.
- Recuperación de la sección Publicación al recargar; vuelta a lectura actualiza
  la preferencia local. Inicio conserva continuar y recientes.
- Ruta de universo inexistente: error visible, universo anterior y recientes
  conservados.
- Redimensionado por teclado de 280 a 300 px, plegar/reabrir y recargar sin
  perder el ancho: `cp-native-index-resized.png`.

Capturas adicionales: `cp-native-write-failure-and-guard.png`,
`cp-native-zip-command.png`, `cp-native-graph.png`, `cp-native-map.png`,
`cp-native-timeline.png`, `cp-native-event.png`, `cp-native-correction.png`,
`cp-native-home.png` y `cp-native-inaccessible.png`, bajo `output/playwright/`.
Las evidencias y el universo de prueba permanecen locales, fuera de Git.

## Límites de aceptación de Suite

La ventana de Suite está compartida con otro chat. Se comprobó el Compendium
integrado en sus cuatro tamaños sin cambiar su universo ni sus preferencias, y
se restauró su viewport: `output/playwright/cp-suite-{ancho}-es-dark.png` en el
repositorio de Suite. La revisión automática de permisos rechazó lanzar una
segunda instancia aislada con «blocked by policy», sin explicación adicional.

Queda pendiente repetir en una Suite dedicada la matriz ES/EN, claro/oscuro y
los flujos de borradores/fallos de guardado ya verificados en standalone. Los
checks de integración cubren el orden de guards y la conservación de rutas y
recientes ante cancelaciones y fallos. No se presenta esa cobertura como una
aceptación manual completa de todos los flujos en Suite.

No se sincronizaron vendors, no se integraron releases y no se crearon commits.
Se conserva el trabajo local previo; los cambios de esta entrega quedan sin
commit para revisión.
