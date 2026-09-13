import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  role: text("role").default("user"),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

export const recipes = sqliteTable("recipes", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  visibility: text("visibility", { enum: ["private", "shared"] }).notNull().default("shared"),
  sourceType: text("source_type", { enum: ["manual", "youtube", "tandoor", "website"] }).notNull(),
  sourceUrl: text("source_url"),
  language: text("language", { enum: ["de", "en"] }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  servings: integer("servings").notNull().default(4),
  prepTimeMin: integer("prep_time_min"),
  cookTimeMin: integer("cook_time_min"),
  imageUrl: text("image_url"),
  calories: integer("calories"),
  proteinG: real("protein_g"),
  carbsG: real("carbs_g"),
  fatG: real("fat_g"),
  fiberG: real("fiber_g"),
  isCooked: integer("is_cooked", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
});

export const ingredients = sqliteTable("ingredients", {
  id: text("id").primaryKey(),
  recipeId: text("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: real("quantity"),
  unit: text("unit"),
  order: integer("order").notNull(),
});

export const steps = sqliteTable("steps", {
  id: text("id").primaryKey(),
  recipeId: text("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  text: text("text").notNull(),
});

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
export type Account = typeof account.$inferSelect;
export type Verification = typeof verification.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type Ingredient = typeof ingredients.$inferSelect;
export type Step = typeof steps.$inferSelect;

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

export const recipeTags = sqliteTable(
  "recipe_tags",
  {
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.recipeId, t.tagId] }),
  ],
);

export type Tag = typeof tags.$inferSelect;
export type RecipeTag = typeof recipeTags.$inferSelect;
