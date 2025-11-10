import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const devPort = Number(process.env.VITE_DEV_SERVER_PORT ?? "4000");

export default defineConfig({
  plugins: [react()],
  root: "src/renderer",
  base: "",
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true
  },
  server: { port: devPort }
});
