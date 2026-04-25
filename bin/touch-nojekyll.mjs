#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { chdir } from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

chdir(join(__dirname, "..", "dist", "public"));

await writeFile(".nojekyll", "", "utf-8");
