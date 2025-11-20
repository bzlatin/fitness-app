#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, "..");
const targetPath = path.join(
  root,
  "node_modules",
  "react-native",
  "src",
  "private",
  "specs",
  "components",
  "DebuggingOverlayNativeComponent.js",
);

if (!fs.existsSync(targetPath)) {
  console.warn(
    "DebuggingOverlay patch skipped: target file not found (react-native not installed).",
  );
  process.exit(0);
}

let fileContents = fs.readFileSync(targetPath, "utf8");
const replacements = [
  {
    match: "updates: $ReadOnlyArray<TraceUpdate>",
    replace: "updates: Array<TraceUpdate>",
  },
  {
    match: "elements: $ReadOnlyArray<ElementRectangle>",
    replace: "elements: Array<ElementRectangle>",
  },
];

let patched = fileContents;
replacements.forEach(({match, replace}) => {
  if (patched.includes(match)) {
    patched = patched.replace(match, replace);
  }
});

if (patched === fileContents) {
  console.info("DebuggingOverlay patch already applied.");
  process.exit(0);
}

fs.writeFileSync(targetPath, patched);
console.info("Applied DebuggingOverlayNativeComponent patch.");
