import { defineConfig } from "@playwright/test";

// End-to-end tests (npm run test:e2e): the built plugin in a real page, posting to the test server
// in test/e2e/server.mjs. JQUERY_FILE picks the jQuery build, JQUERY_FORM_DIST the plugin build.
// Firefox runs only with JQUERY_FORM_FIREFOX=1 (scripts/test-docker.sh --e2e runs it in Docker).
const port = Number(process.env.E2E_PORT || 4310);
const browsers = ["chromium", "webkit"];
if (process.env.JQUERY_FORM_FIREFOX === "1") {
  browsers.push("firefox");
}

export default defineConfig({
  testDir: "test/e2e",
  testMatch: "*.spec.mjs",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: { baseURL: `http://127.0.0.1:${port}` },
  projects: browsers.map((name) => ({ name, use: { browserName: name } })),
  webServer: {
    command: "node test/e2e/server.mjs",
    url: `http://127.0.0.1:${port}/page`,
    reuseExistingServer: false,
  },
});
