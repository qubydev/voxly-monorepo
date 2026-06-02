const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
}

const client = postgres(connectionString, {
    prepare: false,
    max: 20,
    idle_timeout: 30,
    connect_timeout: 10,
});

const db = drizzle(client);

module.exports = db;