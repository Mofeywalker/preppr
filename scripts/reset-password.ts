import { hashPassword } from "@better-auth/utils/password";
import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.log("Usage: npx tsx scripts/reset-password.ts <email> <newPassword>");
  process.exit(1);
}

if (newPassword.length < 8) {
  console.error("Error: Password must be at least 8 characters long.");
  process.exit(1);
}

const dbPath = process.env.DATABASE_PATH || path.resolve(process.cwd(), "dev.db");
const db = new Database(dbPath);

async function main() {
  const user = db.prepare("SELECT id, email, name FROM user WHERE email = ?").get(email) as
    | { id: string; email: string; name: string }
    | undefined;

  if (!user) {
    console.error(`User with email "${email}" not found in database.`);
    process.exit(1);
  }

  const hash = await hashPassword(newPassword);
  const now = Date.now();

  const account = db
    .prepare("SELECT id FROM account WHERE user_id = ? AND provider_id = 'credential'")
    .get(user.id) as { id: string } | undefined;

  if (account) {
    db.prepare("UPDATE account SET password = ?, updated_at = ? WHERE id = ?").run(
      hash,
      now,
      account.id
    );
  } else {
    const accountId = crypto.randomBytes(16).toString("base64url");
    db.prepare(
      "INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (?, ?, 'credential', ?, ?, ?, ?)"
    ).run(accountId, user.id, user.id, hash, now, now);
  }

  // Clear stale sessions
  db.prepare("DELETE FROM session WHERE user_id = ?").run(user.id);

  console.log(`✓ Password successfully updated for ${user.email} (${user.name}).`);
  console.log(`✓ Old sessions cleared. You can now log in at /login with your new password.`);
}

main().catch((err) => {
  console.error("Failed to reset password:", err);
  process.exit(1);
});
