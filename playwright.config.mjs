import { defineConfig } from "@playwright/test";
import fs from "node:fs";
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
export default defineConfig({
  testDir: "test/browser",
  workers: 1,
  reporter: "list",
  use: {
    headless: true,
    viewport: { width: 1500, height: 1000 },
    launchOptions: fs.existsSync(edge) ? { executablePath: edge } : {},
  },
});
