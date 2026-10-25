import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./pw",
  reporter: "list",
  use: { baseURL: "http://localhost:4173" },
  webServer: { command: "node server.mjs", url: "http://localhost:4173/test/harness.html", reuseExistingServer: true },
});
