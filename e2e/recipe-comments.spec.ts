import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/auth";

const recipeInput = (title: string) => ({
  sourceType: "manual",
  language: "de",
  title,
  servings: 1,
  ingredients: [{ name: "Rice", quantity: 1, unit: "cup" }],
  steps: ["Cook the rice."],
});

test.describe("Recipe comments", () => {
  test("keeps suggestions separate and enforces shared/private comment access", async ({
    page: ownerPage,
    browser,
  }) => {
    test.setTimeout(120_000);

    const owner = await registerUser(ownerPage);
    const ownerRecipeTitle = `Carrots ${Math.random().toString(36).slice(2, 8)}`;
    const createResponse = await ownerPage.request.post("/api/recipes", {
      data: {
        ...recipeInput(ownerRecipeTitle),
        servings: 2,
        ingredients: [{ name: "Karotten", quantity: 4, unit: "Stück" }],
        steps: ["Rösten, bis sie weich sind."],
      },
    });
    expect(createResponse.status()).toBe(201);
    const recipeId = (await createResponse.json()).id as string;
    const recipePath = `/de/recipes/${recipeId}`;
    await ownerPage.goto(recipePath);
    await expect(ownerPage.locator("h1")).toContainText(ownerRecipeTitle);
    await expect(ownerPage.getByText("Karotten", { exact: true })).toBeVisible();

    const guestPage = await browser.newPage();
    await guestPage.goto(recipePath);
    await expect(guestPage.getByRole("heading", { name: "Kommentare" })).toBeVisible();
    await expect(guestPage.getByText("Melde dich an, um einen Kommentar zu schreiben")).toBeVisible();
    expect((await guestPage.request.get(`/api/recipes/${recipeId}/comments`)).status()).toBe(200);
    const guestPost = await guestPage.request.post(`/api/recipes/${recipeId}/comments`, {
      data: { body: "Guest suggestion" },
    });
    expect(guestPost.status()).toBe(401);

    const writerPage = await browser.newPage();
    const writer = await registerUser(writerPage);
    await writerPage.goto(recipePath);
    const suggestion = "<script>alert('x')</script> Try adding zucchini";
    await writerPage.getByLabel("Dein Kommentar").fill(suggestion);
    await writerPage.getByRole("button", { name: "Kommentar veröffentlichen" }).click();
    await expect(writerPage.getByText(suggestion, { exact: true })).toBeVisible();
    await expect(writerPage.getByTestId("recipe-comment-list").locator("script")).toHaveCount(0);
    const authorBadge = writerPage.getByTestId("recipe-comment-author").first();
    await expect(authorBadge).toContainText(writer.name);
    await expect(authorBadge.locator("[aria-hidden='true']")).toBeVisible();
    await expect(writerPage.getByRole("status")).toContainText("Kommentar veröffentlicht.");
    await writerPage.reload();
    await expect(writerPage.getByText(suggestion, { exact: true })).toBeVisible();
    await expect(writerPage.getByText("Karotten", { exact: true })).toBeVisible();
    await expect(writerPage.getByText("Zucchini", { exact: true })).toHaveCount(0);

    const sourceComments = await (await writerPage.request.get(
      `/api/recipes/${recipeId}/comments`,
    )).json();
    const writerCommentId = sourceComments.comments.find(
      (comment: { id: string; authorName: string }) => comment.authorName === writer.name,
    ).id as string;
    const commentMenuName = `Weitere Aktionen für ${writer.name}`;
    await expect(writerPage.getByRole("button", { name: commentMenuName })).toBeVisible();
    await expect(writerPage.getByRole("button", {
      name: `Kommentar von ${writer.name} bearbeiten`,
    })).toHaveCount(0);
    await writerPage.getByRole("button", { name: commentMenuName }).click();
    await expect(writerPage.getByRole("group", { name: commentMenuName })).toBeVisible();
    await writerPage.keyboard.press("Escape");
    await expect(writerPage.getByRole("button", { name: commentMenuName })).toBeFocused();
    await writerPage.getByRole("button", { name: commentMenuName }).click();
    await expect(writerPage.getByRole("group", { name: commentMenuName })).toBeVisible();
    const editButton = writerPage.getByRole("button", {
      name: `Kommentar von ${writer.name} bearbeiten`,
    });
    await editButton.click();
    const editField = writerPage.getByLabel(`Kommentar von ${writer.name} bearbeiten`);
    const editedText = "Try zucchini, but keep it optional";
    await editField.fill(editedText);
    const saveButton = writerPage.getByRole("button", { name: "Speichern" });
    await writerPage.keyboard.press("Tab");
    await expect(saveButton).toBeFocused();
    await writerPage.keyboard.press("Enter");
    await expect(writerPage.getByText(editedText, { exact: true })).toBeVisible();
    await expect(writerPage.getByRole("status")).toContainText("Kommentar aktualisiert.");

    const forkResponse = await writerPage.request.post(`/api/recipes/${recipeId}/fork`);
    expect(forkResponse.status()).toBe(201);
    const forkedId = (await forkResponse.json()).id as string;
    await writerPage.goto(`/recipes/${forkedId}`);
    await expect(writerPage.getByText("Karotten", { exact: true })).toBeVisible();
    await expect(writerPage.getByText("Noch keine Kommentare. Teile eine Idee!")).toBeVisible();
    await expect(writerPage.getByText(editedText, { exact: true })).toHaveCount(0);
    await writerPage.click('a[href$="/edit"]');
    const forkedIngredientNames = writerPage.locator('input[placeholder="Name"]');
    await expect(forkedIngredientNames).toHaveCount(1);
    await expect(forkedIngredientNames.nth(0)).toHaveValue("Karotten");
    await writerPage.goto(recipePath);

    const secondRecipeResponse = await ownerPage.request.post("/api/recipes", {
      data: recipeInput("Other recipe for comment isolation"),
    });
    expect(secondRecipeResponse.status()).toBe(201);
    const secondRecipeId = (await secondRecipeResponse.json()).id as string;
    expect((await writerPage.request.patch(
      `/api/recipes/${secondRecipeId}/comments/${writerCommentId}`,
      { data: { body: "Wrong recipe" } },
    )).status()).toBe(404);
    expect((await writerPage.request.patch(
      `/api/recipes/${recipeId}/comments/${writerCommentId}`,
      { data: { body: " " } },
    )).status()).toBe(400);
    expect((await writerPage.request.post(`/api/recipes/${recipeId}/comments`, {
      data: { body: "x".repeat(1001) },
    })).status()).toBe(400);
    expect((await writerPage.request.post(`/api/recipes/${recipeId}/comments`, {
      data: "{",
      headers: { "Content-Type": "application/json" },
    })).status()).toBe(400);
    expect((await writerPage.request.post("/api/recipes/not-a-recipe/comments", {
      data: { body: "Unknown recipe" },
    })).status()).toBe(404);
    expect((await ownerPage.request.patch(
      `/api/recipes/${recipeId}/comments/${writerCommentId}`,
      { data: { body: "Owner cannot edit someone else's comment" } },
    )).status()).toBe(403);

    await ownerPage.reload();
    await ownerPage.getByLabel("Dein Kommentar").fill("Owner suggestion");
    await ownerPage.getByRole("button", { name: "Kommentar veröffentlichen" }).click();
    const ownerComments = await (await ownerPage.request.get(
      `/api/recipes/${recipeId}/comments`,
    )).json();
    const ownerCommentId = ownerComments.comments.find(
      (comment: { authorName: string }) => comment.authorName === owner.name,
    ).id as string;
    expect((await writerPage.request.delete(
      `/api/recipes/${recipeId}/comments/${ownerCommentId}`,
    )).status()).toBe(403);

    await ownerPage.reload();
    const writerMenuName = `Weitere Aktionen für ${writer.name}`;
    await ownerPage.getByRole("button", { name: writerMenuName }).click();
    const writerActionMenu = ownerPage.getByRole("group", { name: writerMenuName });
    await expect(writerActionMenu).toBeVisible();
    await writerActionMenu.getByRole("button", {
      name: `Kommentar von ${writer.name} löschen`,
    }).click();
    const confirmDialog = ownerPage.locator("dialog[open]");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Löschen" }).click();
    await expect(ownerPage.getByText(editedText, { exact: true })).toHaveCount(0);
    await expect(ownerPage.getByRole("status")).toContainText("Kommentar gelöscht.");


    await ownerPage.goto(recipePath);
    await ownerPage.click('a[href$="/edit"]');
    await ownerPage.locator("#visibility").selectOption("private");
    await ownerPage.click('button[type="submit"]:has-text("Speichern")');
    await ownerPage.waitForURL(new RegExp(`${recipePath}$`));
    await expect(ownerPage.getByText("Owner suggestion", { exact: true })).toBeVisible();
    expect((await guestPage.request.get(`/api/recipes/${recipeId}/comments`)).status()).toBe(404);
    expect((await writerPage.request.get(`/api/recipes/${recipeId}/comments`)).status()).toBe(404);
    expect((await writerPage.request.post(`/api/recipes/${recipeId}/comments`, {
      data: { body: "Private recipe comment" },
    })).status()).toBe(404);
    await guestPage.goto(recipePath);
    await expect(guestPage.getByRole("heading", { name: "404" })).toBeVisible();
    await ownerPage.setViewportSize({ width: 375, height: 812 });
    await ownerPage.reload();
    await expect(ownerPage.getByRole("heading", { name: "Kommentare" })).toBeVisible();
    expect(await ownerPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await ownerPage.keyboard.press("Tab");
    await expect(ownerPage.locator(":focus")).toBeVisible();

    await guestPage.close();
    await writerPage.close();
  });
});
