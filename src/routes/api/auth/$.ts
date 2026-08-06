import { createFileRoute } from "@tanstack/react-router";

import { getAuth } from "@/lib/self-hosted/auth.server";

async function handle(request: Request) {
  return getAuth().handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
