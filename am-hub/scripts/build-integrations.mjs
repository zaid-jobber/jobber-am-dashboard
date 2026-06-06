// Build the standalone Integrations Hub and drop its output into this app's
// public/integrations/ so AM Hub can serve it at /integrations/ — no second
// server, works in `vite dev` and in the production build (public/ is copied
// into dist/).
//
//   npm run build:integrations
//
// The Integrations Hub is a SEPARATE project/repo. Point at it with
// INTEGRATIONS_SRC; defaults to the sibling folder "../Integrations Hub".

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AMHUB = path.resolve(__dirname, "..");                       // am-hub/
const SRC = process.env.INTEGRATIONS_SRC
  || path.resolve(AMHUB, "../../Integrations Hub");                // sibling of "AM Hub"
const DEST = path.join(AMHUB, "public/integrations");

if (!fs.existsSync(path.join(SRC, "package.json"))) {
  console.error(`✖ Integrations Hub not found at: ${SRC}\n  Set INTEGRATIONS_SRC=/path/to/Integrations\\ Hub`);
  process.exit(1);
}

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: "inherit" });

console.log(`• Building Integrations Hub from: ${SRC}`);
if (!fs.existsSync(path.join(SRC, "node_modules"))) run("npm install", SRC);
run("npm run build", SRC);

console.log(`• Copying dist → ${path.relative(AMHUB, DEST)}`);
fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });
fs.cpSync(path.join(SRC, "dist"), DEST, { recursive: true });

console.log("✓ Done. AM Hub now serves it at /integrations/ (Resources → Integrations).");
