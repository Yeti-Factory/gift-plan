import process from "node:process";
import { Pool } from "pg";

const TABLES = [
  "user",
  "profiles",
  "circles",
  "circle_members",
  "lists",
  "gifts",
  "reservations",
  "profile_access_requests",
];

const INVARIANTS = [
  {
    name: "utilisateurs sans profil",
    query:
      'SELECT count(*)::int AS count FROM "user" u LEFT JOIN profiles p ON p.id = u.id WHERE p.id IS NULL',
  },
  {
    name: "profils sans utilisateur",
    query:
      'SELECT count(*)::int AS count FROM profiles p LEFT JOIN "user" u ON u.id = p.id WHERE u.id IS NULL',
  },
  {
    name: "cadeaux sans liste",
    query:
      "SELECT count(*)::int AS count FROM gifts g LEFT JOIN lists l ON l.id = g.list_id WHERE l.id IS NULL",
  },
  {
    name: "réservations du propriétaire de l'objet",
    query:
      "SELECT count(*)::int AS count FROM reservations r JOIN gifts g ON g.id = r.gift_id WHERE r.buyer_id = g.owner_id",
  },
  {
    name: "cercles sans administrateur",
    query:
      "SELECT count(*)::int AS count FROM circles c WHERE NOT EXISTS (SELECT 1 FROM circle_members cm WHERE cm.circle_id = c.id AND cm.role = 'admin')",
  },
];

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL est obligatoire");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let valid = true;

  try {
    const counts = {};
    for (const table of TABLES) {
      const result = await pool.query(
        `SELECT count(*)::int AS count FROM ${quoteIdentifier(table)}`,
      );
      counts[table] = result.rows[0].count;
    }

    const invariants = {};
    for (const invariant of INVARIANTS) {
      const result = await pool.query(invariant.query);
      const count = result.rows[0].count;
      invariants[invariant.name] = count;
      if (count !== 0) valid = false;
    }

    console.log(JSON.stringify({ valid, counts, invariants }, null, 2));
  } finally {
    await pool.end();
  }

  if (!valid) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
