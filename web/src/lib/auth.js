import { betterAuth } from "better-auth";
import { db } from "@/lib/db";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: schema,
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        sendResetPassword: async ({ user, url }) => {
            await sendEmail({
                to: user.email,
                subject: "Reset your Voxly password",
                text: `Reset your Voxly password: ${url}`,
                html: `
                    <p>Reset your Voxly password using the link below:</p>
                    <p><a href="${url}">Reset password</a></p>
                    <p>If you did not request this, you can ignore this email.</p>
                `,
            });
        },
    },
    emailVerification: {
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url }) => {
            await sendEmail({
                to: user.email,
                subject: "Verify your Voxly email",
                text: `Verify your Voxly email: ${url}`,
                html: `
                    <p>Welcome to Voxly. Verify your email using the link below:</p>
                    <p><a href="${url}">Verify email</a></p>
                    <p>If you did not create this account, you can ignore this email.</p>
                `,
            });
        },
    },
    socialProviders: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
        }
    }
});
