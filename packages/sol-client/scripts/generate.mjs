import { readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createFromRoot } from "codama";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";

const here = dirname(fileURLToPath(import.meta.url));
const idl = JSON.parse(readFileSync(join(here, "../../../solana/idl/bump_arena.json"), "utf8"));
const codama = createFromRoot(rootNodeFromAnchor(idl));
const root = join(here, "..");
rmSync(join(root, "src/generated"), { recursive: true, force: true });
await codama.accept(renderVisitor(root, { deleteFolder: false, syncPackageJson: false }));
