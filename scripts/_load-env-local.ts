import fs from "node:fs";
import path from "node:path";

export function loadEnvLocal(rootDir: string) {
  const envFiles = [".env.local", "env.local"];

  for (const file of envFiles) {
    const target = path.join(rootDir, file);
    if (!fs.existsSync(target)) continue;

    for (const line of fs.readFileSync(target, "utf8").split("\n")) {
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator === -1) continue;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
}
