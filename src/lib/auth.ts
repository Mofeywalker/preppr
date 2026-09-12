import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";
import { db, schema } from "@/db/client";
import { claimOrphanRecipesForFirstUser } from "@/lib/migration-claim";
import { headers } from "next/headers";
import { randomBytes } from "node:crypto";

// Ensure a secret is always available. If BETTER_AUTH_SECRET is not set,
// generate a random one per process start. Sessions will NOT survive restarts
// in that case, so we log a loud warning.
let authSecret = process.env.BETTER_AUTH_SECRET;
if (!authSecret) {
  authSecret = randomBytes(32).toString("base64");
  console.warn(
    "\n" +
      "╔══════════════════════════════════════════════════════════════╗\n" +
      "║  ⚠️  BETTER_AUTH_SECRET is not set!                         ║\n" +
      "║  A random secret has been generated for this process.       ║\n" +
      "║  Sessions will NOT persist across server restarts.          ║\n" +
      "║                                                             ║\n" +
      "║  Generate a permanent secret:                               ║\n" +
      '║    openssl rand -base64 32                                  ║\n' +
      "║  Then add it to your .env file as BETTER_AUTH_SECRET=...    ║\n" +
      "╚══════════════════════════════════════════════════════════════╝\n",
  );
}

const plugins = [];

if (process.env.OIDC_CLIENT_ID) {
  plugins.push(
    genericOAuth({
      config: [
        {
          providerId: "oidc",
          name: process.env.OIDC_PROVIDER_NAME || "OpenID Connect",
          discoveryUrl: process.env.OIDC_DISCOVERY_URL,
          authorizationUrl: process.env.OIDC_AUTHORIZATION_URL,
          tokenUrl: process.env.OIDC_TOKEN_URL,
          userInfoUrl: process.env.OIDC_USERINFO_URL,
          clientId: process.env.OIDC_CLIENT_ID,
          clientSecret: process.env.OIDC_CLIENT_SECRET,
          scopes: process.env.OIDC_SCOPES
            ? process.env.OIDC_SCOPES.split(" ")
            : ["openid", "profile", "email"],
          overrideUserInfo: true,
          mapProfileToUser: (profile) => {
            return {
              image:
                (profile.picture as string | undefined) ||
                (profile.avatar_url as string | undefined) ||
                (profile.avatar as string | undefined) ||
                (profile.image as string | undefined) ||
                undefined,
            };
          },
        },
      ],
    })
  );
}

const hasOidc = !!process.env.OIDC_CLIENT_ID;
const disableEmailAuth =
  hasOidc &&
  (process.env.AUTH_DISABLE_EMAIL_LOGIN === "true" ||
    process.env.AUTH_DISABLE_EMAIL_PASSWORD === "true");
const disableEmailSignUp =
  disableEmailAuth || process.env.AUTH_DISABLE_REGISTER === "true";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000",
  secret: authSecret,
  emailAndPassword: {
    enabled: !disableEmailAuth,
    disableSignUp: disableEmailSignUp,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await claimOrphanRecipesForFirstUser(user.id);
        },
      },
    },
  },
  plugins,
});

export type Session = typeof auth.$Infer.Session;

export async function getSession() {
  const reqHeaders = await headers();
  return auth.api.getSession({
    headers: reqHeaders,
  });
}
