# Everend Compendium — Dirección de producto

Compendium es la superficie de lectura, consulta y publicación de Everend Forge. Reúne el canon de WorldNotion y las historias guardadas por PathBranching en ediciones claras para explorar y compartir un universo. Las fuentes siguen perteneciendo a las aplicaciones que las crean; Compendium las proyecta y publica sin reescribirlas.

## Hitos de Compendium

Estos hitos describen la oferta propia de Compendium. Son independientes del hito compartido **Forge 0.5** y de la versión del paquete (`0.2.4` en la rama actual).

| Hito                           | Oferta                                                                                                                                                                                                            | Límite de producto                                                                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1.0 — Wiki integral**        | Consulta local del canon y las historias de Everend. Perfiles reutilizables filtran lo que se publica. Las historias ofrecen rutas legibles cuando una transición tiene texto y destino narrativo.                | Las opciones condicionales se diagnostican y se omiten. El lector no ejecuta reglas, variables, consecuencias ni lógica de motores de juego.                                 |
| **2.0 — Ediciones para rol**   | Preparación de ediciones separadas para dirección y jugadores, cada una con su perfil, vista previa y salida como sitio o paquete independiente.                                                                  | Los secretos se separan al generar cada edición; no se protegen mediante cuentas o roles dentro de un mismo sitio estático.                                                  |
| **3.0 — Ensamblaje editorial** | Selección y orden de materiales Markdown de WorldNotion y textos de PathBranching. Cada edición puede fijar manualmente una ruta, añadir referencias al canon como notas o apéndice y elegir plantilla y formato. | Compendium organiza y publica. La escritura y edición del manuscrito permanecen en las fuentes. Los perfiles guardan referencias y preferencias, nunca copias del contenido. |

## Formatos previstos para 3.0

La familia inicial se limita a formatos con una salida definida por tipo de material:

| Material          | Formatos previstos                                                         |
| ----------------- | -------------------------------------------------------------------------- |
| Libros y novelas  | EPUB 3.3, DOCX y PDF de lectura; PDF con perfil configurable para imprenta |
| Guion audiovisual | Fountain y PDF                                                             |
| Teatro            | PDF o DOCX desde plantillas configurables                                  |

EPUB 3.3 es la base estable. Se revisará EPUB 3.4 cuando deje de ser borrador. Las publicaciones EPUB incluirán metadatos y validaciones de accesibilidad. PDF de imprenta tendrá ajustes configurables y no prometerá compatibilidad universal con editoriales o plataformas. DOCX seguirá Office Open XML. Fountain será una salida portable de guion, sin cubrir todas las funciones de producción ni prometer apertura directa en Final Draft. Teatro usará plantillas porque la presentación varía por editorial y convocatoria.

Referencias normativas y de formato: [EPUB 3.3](https://www.w3.org/TR/epub-33/), [estado de EPUB 3.4](https://www.w3.org/TR/epub-34/), [EPUB Accessibility](https://www.w3.org/TR/epub-a11y/), [ECMA-376](https://ecma-international.org/publications-and-standards/standards/ecma-376/), [Fountain](https://fountain.io/), [importación de Fountain en Final Draft](https://kb.finaldraft.com/hc/en-us/articles/15575076862228-Can-Final-Draft-import-a-file-written-in-a-Fountain-based-screenwriting-program) y [requisitos de presentación teatral](https://www.playwrightscanada.com/About-Us/Submissions).

## Hito compartido y principios

**Forge 0.5** cierra el circuito entre WorldNotion, PathBranching y Compendium para consultar el mismo universo y presentar sus historias. No cambia la numeración propia de Compendium.

Todos los hitos priorizan legibilidad, navegación, publicación controlada, portabilidad, accesibilidad y separación entre contenido fuente y proyecciones. Los perfiles de publicación que ya filtran la wiki son también la base para generar ediciones de rol y editoriales.

## Fuera de alcance

- Escribir o modificar manuscritos dentro de Compendium.
- Ejecutar historias, integrar motores de juego o exportar estado de runtime.
- Controlar acceso por cuentas dentro de una misma publicación estática.
- Prometer cualquier formato imaginable o compatibilidad universal de imprenta.

## Maqueta

`npm run dev` expone una maqueta de desarrollo en el inicio de la aplicación. Usa contenido sintético y tres vistas para explorar la wiki 1.0, las ediciones de rol 2.0 y el ensamblaje editorial 3.0. La maqueta no aparece en las publicaciones ni en el menú del producto compilado.
