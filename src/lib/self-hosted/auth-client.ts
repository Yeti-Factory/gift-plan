import { createAuthClient } from "better-auth/react";
import { usernameClient, inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [
    usernameClient(),
    inferAdditionalFields({ user: { birthday: { type: "string", required: false } } }),
  ],
});
