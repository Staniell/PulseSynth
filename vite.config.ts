import { defineConfig } from "vite";
import { resolve } from "path";
import { copyFileSync, mkdirSync, readdirSync, existsSync, rmSync } from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Copy static files after build
function copyStaticFiles() {
  return {
    name: "copy-static-files",
    closeBundle() {
      // Copy manifest.json
      copyFileSync("manifest.json", "dist/manifest.json");
      console.log("Copied manifest.json");

      // Copy icons
      if (!existsSync("dist/icons")) {
        mkdirSync("dist/icons", { recursive: true });
      }
      const icons = readdirSync("icons");
      for (const icon of icons) {
        copyFileSync(`icons/${icon}`, `dist/icons/${icon}`);
      }
      console.log("Copied icons");

      // Copy offscreen.html
      copyFileSync("src/offscreen.html", "dist/offscreen.html");
      console.log("Copied offscreen.html");

      // Copy popup folder
      if (!existsSync("dist/popup")) {
        mkdirSync("dist/popup", { recursive: true });
      }
      copyFileSync("src/popup/popup.html", "dist/popup/popup.html");
      console.log("Copied popup.html");
    },
  };
}

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true, // Fixed: was emptyDirOnBuild
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background.ts"),
        offscreen: resolve(__dirname, "src/offscreen.ts"),
        popup: resolve(__dirname, "src/popup/popup.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  plugins: [copyStaticFiles()],
});
