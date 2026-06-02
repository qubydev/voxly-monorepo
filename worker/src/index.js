require('dotenv').config();
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { processTTS } = require('./ttsService');
const db = require('./db');
const { supabase } = require('./supabase');
const { QUEUE_NAME } = require('./config');
const { sql } = require('drizzle-orm');

const redisConnection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    tls: { rejectUnauthorized: false }
});

const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
        const startTime = Date.now();
        const { text, voice, databaseId, userId } = job.data;
        const cost = text?.length || 0;

        console.log(`[${new Date().toISOString()}] [INFO] [Job ${job.id}] Initializing job. User ID: ${userId} | Database ID: ${databaseId} | Voice: ${voice} | Characters: ${cost}`);

        const deductResult = await db.execute(sql`
            UPDATE subscription
            SET balance = CASE WHEN is_unlimited = true THEN balance ELSE balance - ${cost} END,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ${userId}
              AND subscription_ends_at >= CURRENT_TIMESTAMP
              AND (is_unlimited = true OR balance >= ${cost})
            RETURNING user_id
        `);

        const rows = deductResult.rows || deductResult;

        if (!rows || rows.length === 0) {
            throw new Error("INSUFFICIENT_CREDITS");
        }

        console.log(`[${new Date().toISOString()}] [INFO] [Job ${job.id}] Deducted ${cost} credits from user ${userId}.`);

        try {
            await db.execute(sql`UPDATE tts_jobs SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ${databaseId}`);
            console.log(`[${new Date().toISOString()}] [INFO] [Job ${job.id}] Database marked as 'processing'.`);
        } catch (dbError) {
            console.error(`[${new Date().toISOString()}] [ERROR] [Job ${job.id}] Failed updating status to 'processing' in database.`, dbError.stack);
            throw dbError;
        }

        console.log(`[${new Date().toISOString()}] [INFO] [Job ${job.id}] Processing audio generation chunks.`);
        const finalAudioBuffer = await processTTS(text, voice, async (finished, total) => {
            const percentage = total > 0 ? Math.floor((finished / total) * 90) : 0;
            await job.updateProgress(percentage);

            try {
                await db.execute(sql`UPDATE tts_jobs SET finished_chunks = ${finished}, total_chunks = ${total}, updated_at = CURRENT_TIMESTAMP WHERE id = ${databaseId}`);
            } catch (dbError) {
                console.error(`[${new Date().toISOString()}] [ERROR] [Job ${job.id}] Failed updating progress chunks in database.`, dbError.stack);
            }
        });

        console.log(`[${new Date().toISOString()}] [INFO] [Job ${job.id}] Audio generation complete. Buffer size: ${finalAudioBuffer.length} bytes.`);

        await job.updateProgress(95);

        const bucket = 'tts-audio';
        const fileName = `tts-${userId}-${databaseId}.mp3`;

        console.log(`[${new Date().toISOString()}] [INFO] [Job ${job.id}] Uploading filename '${fileName}' to Supabase Storage.`);

        let fileUrl;
        try {
            const { data, error } = await supabase.storage
                .from(bucket)
                .upload(fileName, finalAudioBuffer, {
                    contentType: 'audio/mpeg',
                    upsert: false
                });

            if (error) {
                throw error;
            }

            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(data.path);

            fileUrl = publicUrl;
            console.log(`[${new Date().toISOString()}] [INFO] [Job ${job.id}] Supabase Storage upload successful. URL: ${fileUrl}`);
        } catch (uploadError) {
            console.error(`[${new Date().toISOString()}] [ERROR] [Job ${job.id}] Supabase Storage upload failure.`, uploadError.stack);
            throw uploadError;
        }

        const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);

        await job.updateProgress(100);

        try {
            await db.execute(sql`UPDATE tts_jobs SET status = 'completed', file_name = ${fileName}, time_taken = ${timeTaken}, updated_at = CURRENT_TIMESTAMP WHERE id = ${databaseId}`);
            console.log(`[${new Date().toISOString()}] [INFO] [Job ${job.id}] Database status updated to 'completed'.`);
        } catch (dbError) {
            console.error(`[${new Date().toISOString()}] [ERROR] [Job ${job.id}] Failed updating status to 'completed' in database.`, dbError.stack);
            throw dbError;
        }

        return {
            status: 'success',
            timeTaken,
            databaseId,
            url: fileUrl
        };
    },
    { connection: redisConnection }
);

worker.on('ready', () => {
    console.log(`[${new Date().toISOString()}] [INFO] Worker connected and listening to Upstash Redis queue: ${QUEUE_NAME}`);
});

worker.on('active', (job) => {
    console.log(`[${new Date().toISOString()}] [INFO] [Job ${job.id}] BullMQ active event received.`);
});

worker.on('completed', (job) => {
    console.log(`[${new Date().toISOString()}] [SUCCESS] [Job ${job.id}] Finished production in ${job.returnvalue.timeTaken}s. Asset location: ${job.returnvalue.url}`);
});

worker.on('failed', async (job, err) => {
    const errorMessage = err?.message || String(err) || "Unknown Error";
    console.error(`[${new Date().toISOString()}] [CRITICAL] [Job ${job?.id || 'UNKNOWN'}] Process execution failed: ${errorMessage}`, err?.stack || err);

    if (job?.data?.userId && errorMessage !== "INSUFFICIENT_CREDITS") {
        const cost = job.data.text?.length || 0;
        try {
            await db.execute(sql`
                UPDATE subscription
                SET balance = CASE WHEN is_unlimited = true THEN balance ELSE balance + ${cost} END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ${job.data.userId}
            `);
            console.log(`[${new Date().toISOString()}] [INFO] [Job ${job.id}] Refunded ${cost} credits to user ${job.data.userId}.`);
        } catch (refundError) {
            console.error(`[${new Date().toISOString()}] [ERROR] [Job ${job.id}] Failed to refund credits.`, refundError.stack);
        }
    }

    if (job?.data?.databaseId) {
        try {
            await db.execute(sql`UPDATE tts_jobs SET status = 'failed', error_message = ${errorMessage}, updated_at = CURRENT_TIMESTAMP WHERE id = ${job.data.databaseId}`);
            console.log(`[${new Date().toISOString()}] [INFO] [Job ${job.id}] Database successfully updated with failure trace.`);
        } catch (dbError) {
            console.error(`[${new Date().toISOString()}] [ERROR] [Job ${job.id}] Database write failed during error handler execution.`, dbError.stack);
        }
    }
});