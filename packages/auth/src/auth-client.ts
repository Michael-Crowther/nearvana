import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: "http://localhost:8080/api/auth",
});

export const { useSession, signIn, signOut, signUp } = authClient;
