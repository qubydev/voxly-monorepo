import { pgTable, text, timestamp, boolean, uuid, varchar, integer, numeric, pgEnum } from "drizzle-orm/pg-core";

export const jobStatus = pgEnum('job_status', ['pending', 'processing', 'completed', 'failed']);

export const user = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("emailVerified").notNull(),
    image: text("image"),
    createdAt: timestamp("createdAt").notNull(),
    updatedAt: timestamp("updatedAt").notNull(),
});

export const session = pgTable("session", {
    id: text("id").primaryKey(),
    userId: text("userId")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expiresAt").notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt").notNull(),
    updatedAt: timestamp("updatedAt").notNull(),
});

export const account = pgTable("account", {
    id: text("id").primaryKey(),
    userId: text("userId")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
    scope: text("scope"),
    idToken: text("idToken"),
    password: text("password"),
    createdAt: timestamp("createdAt").notNull(),
    updatedAt: timestamp("updatedAt").notNull(),
});

export const verification = pgTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").notNull(),
    updatedAt: timestamp("updatedAt").notNull(),
});

export const ttsJobs = pgTable("tts_jobs", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    textContent: text("text_content"),
    voice: varchar("voice", { length: 100 }),
    status: jobStatus("status").default('pending'),
    fileName: text("file_name"),
    finishedChunks: integer("finished_chunks").default(0),
    totalChunks: integer("total_chunks").default(0),
    timeTaken: numeric("time_taken", { precision: 10, scale: 2 }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const subscription = pgTable("subscription", {
    userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
    balance: integer("balance").notNull().default(0),
    isUnlimited: boolean("is_unlimited").notNull().default(false),
    planType: varchar("plan_type", { length: 20 }).notNull().default('NONE'),
    cycleEndsAt: timestamp("cycle_ends_at").notNull(),
    subscriptionEndsAt: timestamp("subscription_ends_at").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});