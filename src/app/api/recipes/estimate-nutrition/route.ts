import { NextRequest } from "next/server";
import { z } from "zod";
import { estimateRecipeNutrition } from "@/lib/ai";
import { auth } from "@/lib/auth";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const estimateBodySchema = z.object({
  title: z.string().default("Recipe"),
  servings: z.number().int().min(1).default(1),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.number().nullable().optional(),
        unit: z.string().nullable().optional(),
      }),
    )
    .min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 20 nutrition estimates per minute per user
  const rl = rateLimit(`nutrition:${session.user.id}`, 20, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json({ error: "ai-config" }, { status: 503 });
  }

  try {
    const json = await req.json();
    const parsed = estimateBodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "invalid-request", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const nutrition = await estimateRecipeNutrition(parsed.data);
    return Response.json({ success: true, nutrition });
  } catch (err) {
    console.error("Failed to estimate recipe nutrition:", err);
    return Response.json(
      { error: "server-error" },
      { status: 500 },
    );
  }
}
