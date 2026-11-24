<p align="center"><img src="src/assets/everend-compendium-icon.png" width="112" alt="Icono de Compendium"></p>

<h1 align="center">Everend Compendium</h1>
<p align="center">Publicador gratuito y open source para crear enciclopedias y lecturas estáticas desde tus mundos y narrativas.</p>

<p align="center"><a href="README.md">English</a> · <a href="https://github.com/SoleipDreams/everend-forge-compendium/releases/latest">Descargar gratis</a> · <a href="https://website-everend-forge.pages.dev/">Conocer la Suite integrada</a></p>

## Uso rápido

```sh
npm install
npm run init -- /ruta/a/tu/universo
npx tsx cli/cli.ts build /ruta/a/tu/universo --out=dist
npm run site:dev -- /ruta/a/tu/universo
```

Compendium genera una web estática y de solo lectura. El canon Markdown sigue siendo la fuente original; la compilación no escribe cambios en el universo. Los perfiles de publicación determinan qué información se expone.

Consulta [la guía de producto](docs/PRODUCT_DIRECTION.md) y [las opciones de publicación](docs/compendium.md).

## Licencia y marca

El código se ofrece bajo MIT o Apache-2.0; la documentación bajo CC BY 4.0 cuando así se indica. Conserva los avisos legales al redistribuir. Consulta [LICENSE](LICENSE), [MIT](LICENSE-MIT), [Apache-2.0](LICENSE-APACHE), [CC BY 4.0](LICENSE-CC-BY-4.0) y la [política de marca](TRADEMARKS.md).

Compendium es gratuita por separado. La Suite comercial la integra con las otras aplicaciones, pero no elimina ni sustituye sus licencias open source.
