import { db, schema } from "@/db/client";
import { isNull, eq, sql } from "drizzle-orm";

export async function claimOrphanRecipesForFirstUser(userId: string) {
  try {
    const userCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.user)
      .get();

    const userCount = userCountResult?.count ?? 0;

    // If this is the only registered user, grant admin role and assign existing unowned recipes
    if (userCount <= 1) {
      await db
        .update(schema.user)
        .set({ role: "admin" })
        .where(eq(schema.user.id, userId));

      await db
        .update(schema.recipes)
        .set({ userId })
        .where(isNull(schema.recipes.userId));
    }
  } catch (error) {
    console.error("Failed to claim orphan recipes for first user:", error);
  }
}
