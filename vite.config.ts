import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Load server-only variables for Nitro without copying them into the client bundle.
const serverEnvPlugin: Plugin = {
  name: "server-env",
  config(_config, { mode }) {
    Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  },
};

export default defineConfig({
  resolve: {
    alias: {
      // React Email/htmlparser2 needs entities v4.5.0; pin the hoisted copy.
      "entities/lib/decode.js": path.resolve(dirname, "node_modules/entities/lib/decode.js"),
      "entities/lib/encode.js": path.resolve(dirname, "node_modules/entities/lib/encode.js"),
      entities: path.resolve(dirname, "node_modules/entities"),
    },
    dedupe: ["react", "react-dom", "@tanstack/react-router"],
  },
  plugins: [
    serverEnvPlugin,
    tanstackStart({ server: { entry: "server" } }),
    nitro({ preset: process.env.NITRO_PRESET ?? "node-server" }),
    tailwindcss(),
    tsConfigPaths(),
    viteReact(),
  ],
});
