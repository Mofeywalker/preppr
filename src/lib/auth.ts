import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";
import { db, schema } from "@/db/client";
import { claimOrphanRecipesForFirstUser } from "@/lib/migration-claim";
import { headers } from "next/headers";

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
        },
      ],
    })
  );
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000",
  secret:
    process.env.BETTER_AUTH_SECRET ||
    "preppr-default-secret-key-change-in-production-32-chars-long",
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
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
