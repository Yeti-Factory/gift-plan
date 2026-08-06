import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Pool } from "pg";

import { readCsv } from "./csv.mjs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BOOLEAN_COLUMNS = new Set([
  "emailVerified",
  "email_searchable",
  "maintenance_mode",
  "id:boolean",
]);
const NUMBER_COLUMNS = new Set(["onboarding_version", "attempt_count", "price"]);

const TABLES = [
  { file: "users.csv", table: "user", required: true, transform: transformUser },
  { file: "profiles.csv", table: "profiles", required: true, conflict: ["id"] },
  { file: "circles.csv", table: "circles" },
  { file: "circle_members.csv", table: "circle_members" },
  { file: "circle_bans.csv", table: "circle_bans" },
  { file: "circle_activity.csv", table: "circle_activity" },
  { file: "join_attempts.csv", table: "join_attempts" },
  { file: "lists.csv", table: "lists" },
  { file: "list_circle_access.csv", table: "list_circle_access" },
  { file: "gifts.csv", table: "gifts" },
  { file: "reservations.csv", table: "reservations" },
  { file: "profile_access_requests.csv", table: "profile_access_requests" },
  { file: "profile_share_links.csv", table: "profile_share_links" },
  { file: "profile_share_link_lists.csv", table: "profile_share_link_lists" },
  { file: "storage_deletions_queue.csv", table: "storage_deletions_queue" },
  { file: "app_admins.csv", table: "app_admins" },
  { file: "app_settings.csv", table: "app_settings", conflict: ["id"] },
];

function quoteIdentifier(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Identifiant SQL refusé : ${identifier}`);
  }
  return `"${identifier}"`;
}

function parseBoolean(value, column) {
  if (value === "true" || value === "t" || value === "1") return true;
  if (value === "false" || value === "f" || value === "0") return false;
  throw new Error(`Valeur booléenne invalide pour ${column}`);
}

function normalizeValue(column, value) {
  if (value === "" || value === "NULL" || value === "null") return null;
  if (BOOLEAN_COLUMNS.has(column)) return parseBoolean(value, column);
  if (NUMBER_COLUMNS.has(column)) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`Valeur numérique invalide pour ${column}`);
    return number;
  }
  return value;
}

function transformUser(source) {
  const id = source.id?.trim();
  const email = source.email?.trim().toLowerCase();
  if (!id || !UUID_PATTERN.test(id)) throw new Error("users.csv contient un UUID invalide");
  if (!email || !email.includes("@")) throw new Error(`users.csv : email manquant pour ${id}`);

  return {
    id,
    name: source.name?.trim() || source.display_name?.trim() || email.split("@")[0],
    email,
    emailVerified: parseBoolean(
      source.email_verified || source.emailVerified || "true",
      "emailVerified",
    ),
    image: source.image?.trim() || source.avatar_url?.trim() || null,
    createdAt: source.created_at || source.createdAt || new Date().toISOString(),
    updatedAt: source.updated_at || source.updatedAt || new Date().toISOString(),
    username: source.username?.trim().toLowerCase() || null,
    displayUsername: source.display_username?.trim() || source.displayUsername?.trim() || null,
  };
}

async function fileExists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function insertRow(client, definition, source) {
  const transformed = definition.transform ? definition.transform(source) : source;
  const entries = Object.entries(transformed).map(([column, value]) => [
    column,
    normalizeValue(column, value),
  ]);
  const columns = entries.map(([column]) => column);
  const values = entries.map(([, value]) => value);
  const placeholders = values.map((_, index) => `$${index + 1}`);
  const conflictColumns = definition.conflict ?? [];
  const updateColumns = columns.filter((column) => !conflictColumns.includes(column));
  const conflict =
    conflictColumns.length === 0
      ? "ON CONFLICT DO NOTHING"
      : `ON CONFLICT (${conflictColumns.map(quoteIdentifier).join(", ")}) DO UPDATE SET ${updateColumns
          .map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`)
          .join(", ")}`;

  await client.query(
    `INSERT INTO ${quoteIdentifier(definition.table)} (${columns.map(quoteIdentifier).join(", ")}) VALUES (${placeholders.join(", ")}) ${conflict}`,
    values,
  );
}

function parseArguments() {
  const directoryFlag = process.argv.indexOf("--dir");
  const directory = directoryFlag >= 0 ? process.argv[directoryFlag + 1] : undefined;
  if (!directory) throw new Error("Usage : bun run selfhost:import --dir C:\\chemin\\exports");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL est obligatoire");
  return { directory: path.resolve(directory), dryRun: process.argv.includes("--dry-run") };
}

async function main() {
  const { directory, dryRun } = parseArguments();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const imported = {};

  try {
    await client.query("BEGIN");
    for (const definition of TABLES) {
      const file = path.join(directory, definition.file);
      if (!(await fileExists(file))) {
        if (definition.required) throw new Error(`${definition.file} est obligatoire`);
        continue;
      }

      const rows = await readCsv(file);
      for (const row of rows) await insertRow(client, definition, row);
      imported[definition.table] = rows.length;
      console.log(`${definition.table}: ${rows.length} ligne(s)`);
    }

    if (dryRun) {
      await client.query("ROLLBACK");
      console.log("Import vérifié puis annulé (--dry-run). Aucune donnée n'a été modifiée.");
    } else {
      await client.query("COMMIT");
      console.log("Import terminé.");
    }
    console.log(JSON.stringify({ dryRun, imported }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
