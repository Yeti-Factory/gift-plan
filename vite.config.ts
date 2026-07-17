// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Loads non-VITE_ server secrets (e.g. LOVABLE_API_KEY, SUPABASE_SERVICE_ROLE_KEY, STRIPE_*)
// into process.env so that server routes and server functions can read them at runtime.
// These secrets are NOT added to the client bundle define.
const serverEnvPlugin = {
  name: "server-env",
  config(_config: unknown, { mode }: { mode: string }) {
    const serverEnv = loadEnv(mode, process.cwd(), "");
    Object.assign(process.env, serverEnv);
  },
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: {
        // React Email/htmlparser2 needs entities v4.5.0; pin hoisted copy for bun/pnpm.
        "entities/lib/decode.js": path.resolve(__dirname, "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(__dirname, "node_modules/entities/lib/encode.js"),
        entities: path.resolve(__dirname, "node_modules/entities"),
      },
    },
    plugins: [serverEnvPlugin],
  },
});
