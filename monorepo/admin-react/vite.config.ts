import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

/**
 * Canonical on-disk path (e.g. "E:\…" even when the shell started in "e:\…"). On Windows a drive-letter
 * case mismatch makes Vite serve sources via /@fs and load duplicate module instances after HMR —
 * which split auth state (header lost its nav/menu). Using the real path for root + alias prevents that.
 */
const canonicalRoot = fs.realpathSync.native(__dirname);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Dev server / build: canonical root. Tests (Vitest, mode "test") keep the shell's own path — mixing the
  // two there loads Vitest twice ("No test suite found") when the shell was started in "e:\…".
  const projectRoot = mode === "test" ? __dirname : canonicalRoot;
  return {
    root: projectRoot,
    plugins: [react()],
    resolve: { alias: { "@": path.join(projectRoot, "src") } },
    server: { port: 5173, host: true },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            charts: ["recharts"],
            forms: ["react-hook-form", "zod", "@hookform/resolvers"],
            radix: [
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-select",
              "@radix-ui/react-popover",
              "@radix-ui/react-tabs",
            ],
          },
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test-setup.ts"],
    },
  } as never;
});
