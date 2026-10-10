import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

for (const [name, exportName] of [
  ["BumpArena", "bumpArenaAbi"],
  ["MockBUMP", "mockBumpAbi"],
]) {
  const artifact = JSON.parse(
    readFileSync(resolve(root, `out/${name}.sol/${name}.json`), "utf8"),
  );
  const body = `export const ${exportName} = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`;
  writeFileSync(resolve(root, `abi/${name}.ts`), body);
  console.log(`wrote abi/${name}.ts (${artifact.abi.length} entries)`);
}
