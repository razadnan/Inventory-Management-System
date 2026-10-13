import fs from "node:fs";
import dotenv from "dotenv";

const shellValue = process.env.DATABASE_URL; // value set in the terminal session, if any
const hasFile = fs.existsSync(".env");

console.log("");
console.log("Folder  :", process.cwd());
console.log(".env file:", hasFile ? "found" : "NOT FOUND in this folder");

let fileValue;

if (hasFile) {
  const buffer = fs.readFileSync(".env");
  const encoding =
    buffer[0] === 0xff && buffer[1] === 0xfe ? "UTF-16 (wrong - re-save as UTF-8)"
    : buffer[0] === 0xef && buffer[1] === 0xbb ? "UTF-8 with BOM (re-save as plain UTF-8)"
    : "UTF-8 (ok)";
  const parsed = dotenv.parse(buffer);

  console.log("Encoding:", encoding);
  console.log("Names found in .env:", Object.keys(parsed).map((k) => JSON.stringify(k)).join(", ") || "(none)");
  fileValue = parsed.DATABASE_URL;
}

function describe(label, value) {
  console.log("");
  console.log(label);

  if (value === undefined) {
    console.log("  not set");
    return;
  }

  const host = (value.match(/@([^/?:]+)/) || [])[1] ?? "(no host found)";
  const queryKeys = value.includes("?")
    ? value.split("?")[1].split("&").map((part) => part.split("=")[0])
    : [];

  console.log("  starts with postgresql:// or postgres://  :", /^postgres(ql)?:\/\//.test(value));
  console.log("  starts with the word psql                 :", /^\s*psql\b/i.test(value));
  console.log("  contains the text DATABASE_URL=           :", /DATABASE_URL\s*=/.test(value));
  console.log("  contains spaces or line breaks            :", /\s/.test(value));
  console.log("  contains quote characters                 :", /["'`\u2018\u2019\u201C\u201D]/.test(value));
  console.log("  contains non-standard characters          :", /[^\x20-\x7E]/.test(value));
  console.log("  host                                      :", host);
  console.log("  host is the pooled one (-pooler)          :", host.includes("-pooler"));
  console.log("  options after ?                           :", queryKeys.join(", ") || "(none)");
}

describe("Value in your terminal session ($env:DATABASE_URL):", shellValue);
describe("Value in the .env file:", fileValue);

console.log("");
if (shellValue !== undefined) {
  console.log("RESULT: a terminal-session value exists and OVERRIDES .env. Run: Remove-Item Env:DATABASE_URL");
} else if (fileValue === undefined) {
  console.log("RESULT: no DATABASE_URL in .env. Add the line (see the guide).");
} else {
  console.log("RESULT: Prisma will use the .env value shown above.");
}
console.log("");