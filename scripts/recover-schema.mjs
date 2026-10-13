import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

if (!fs.existsSync(".next")) {
  console.log("No .next folder here, so there is nothing to search.");
  process.exit(0);
}

fs.mkdirSync("recovered-schema", { recursive: true });

const seen = new Set();
let saved = 0;

for (const file of walk(".next")) {
  if (!file.endsWith(".js")) continue;

  const text = fs.readFileSync(file, "utf8");
  let from = 0;

  while (true) {
    const hit = text.indexOf("model Organization", from);
    if (hit === -1) break;
    from = hit + 1;

    const start = text.lastIndexOf("generator client", hit);
    if (start === -1) continue;

    // The schema sits inside a double-quoted string: stop at the first unescaped quote.
    let end = hit;
    while (end < text.length && !(text[end] === '"' && text[end - 1] !== "\\")) end += 1;

    let schema;
    try {
      schema = JSON.parse('"' + text.slice(start, end) + '"');
    } catch {
      continue;
    }

    const id = crypto.createHash("sha1").update(schema).digest("hex").slice(0, 8);
    if (seen.has(id)) continue;
    seen.add(id);

    saved += 1;
    const target = path.join("recovered-schema", `schema-${saved}.prisma`);
    fs.writeFileSync(target, schema);
    console.log(`Saved ${target}  (${schema.split("\n").length} lines)  from ${file}`);
  }
}

if (saved === 0) console.log("No copy of your old schema was found in .next.");