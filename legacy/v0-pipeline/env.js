import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Load SERPAPI_KEY from (in order): process env, ./.env, ../hermes-os/.env.local
export function loadEnv() {
  const sources = [join(ROOT, ".env"), join(ROOT, "..", "hermes-os", ".env.local")];
  const env = { ...process.env };
  for (const file of sources) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

export { ROOT };
