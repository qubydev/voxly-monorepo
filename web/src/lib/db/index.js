// import { drizzle } from "drizzle-orm/neon-http";
// import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

config({ path: ".env" });

// const sql = neon(process.env.DATABASE_URL);
// export const db = drizzle({ client: sql });
const client = postgres(process.env.DATABASE_URL);
export const db = drizzle({ client });
