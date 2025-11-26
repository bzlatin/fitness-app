/**
 * Copies exercise datasets into the built dist folder.
 * Works whether npm scripts run from repo root or server directory (Render uses repo root).
 */
const fs = require("fs");
const path = require("path");

const findServerRoot = () => {
  const candidates = [process.cwd(), path.join(process.cwd(), "server")];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "src", "data"))) {
      return candidate;
    }
  }
  throw new Error("Could not find server/src/data directory");
};

const copyDir = (src, dest) => {
  if (!fs.existsSync(src)) return;
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
};

(() => {
  const serverRoot = findServerRoot();
  const distRoot = path.join(serverRoot, "dist", "data");

  copyDir(path.join(serverRoot, "src", "data", "dist"), path.join(distRoot, "dist"));
  copyDir(path.join(serverRoot, "src", "data", "exercises"), path.join(distRoot, "exercises"));

  console.log("[copy-data] Copied exercise datasets into dist/data");
})();
