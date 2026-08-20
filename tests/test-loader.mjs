import { readFile } from "node:fs/promises";

export async function loadSourceModule(file, {
  replacements = [],
  globals = {},
  exports = [],
} = {}) {
  let source = await readFile(file, "utf8");

  for (const [pattern, replacement] of replacements) {
    source = source.replace(pattern, replacement);
  }

  source = source.replace(/export\s+(?=(?:async\s+)?function|const|let|class)/g, "");

  const returnStatement = `return { ${exports
    .map((name) => `${name}: typeof ${name} !== "undefined" ? ${name} : undefined`)
    .join(", ")} };`;
  const names = Object.keys(globals);
  const factory = new Function(...names, `${source}\n${returnStatement}`);

  return factory(...names.map((name) => globals[name]));
}
