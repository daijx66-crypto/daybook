import { readFile, writeFile } from "node:fs/promises";

const css = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const data = await readFile(new URL("../src/data.js", import.meta.url), "utf8");
const projection = await readFile(new URL("../src/projection.js", import.meta.url), "utf8");
const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

function stripModuleSyntax(source) {
  // The bundle concatenates modules into one scope, so imports are dropped and
  // exports are unwrapped. Aliased named imports (`X as Y`) would leave `Y`
  // undefined in the bundle — reject them loudly so standalone.html never
  // silently breaks (use the original export name across modules instead).
  const importBlocks = source.match(/^import[\s\S]*?;\n/gm) || [];
  for (const block of importBlocks) {
    if (/\bas\b/.test(block)) {
      throw new Error(`build-standalone: aliased import is not bundle-safe:\n${block.trim()}`);
    }
  }
  return source
    .replace(/^import[\s\S]*?;\n/gm, "")
    .replace(/^export\s+/gm, "");
}

const html_title = "Agent 夜谈台 · daybook";

const js = [
  stripModuleSyntax(data),
  stripModuleSyntax(projection),
  stripModuleSyntax(app)
].join("\n\n");

const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${html_title}</title>
    <style>${css}</style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module">${js}</script>
  </body>
</html>
`;

await writeFile(new URL("../standalone.html", import.meta.url), html);
console.log("built standalone.html");
