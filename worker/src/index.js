require('dotenv').config();
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { put, list, del } = require('@vercel/blob');
const crypto = require('crypto');
const { processTTS } = require('./ttsService');
const db = require('./db');
const { QUEUE_NAME } = require('./config');

const redisConnection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    tls: { rejectUnauthorized: false }
});

const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
        const startTime = Date.now();
        const { text, voice, databaseId, userId } = job.data;

        console.log(`[${new Date().toISOString()}] [INFO] [Job ${job.id}] Initializing job. User ID: ${userId} | Database ID: ${databaseId} | Voice: ${voice} | Characters: ${text?.length || 0}`);

        try {
            await db.query(
                `UPDATE tts_jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                ['processing', databaseId]
            );
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
                await db.query(
                    `UPDATE tts_jobs SET finished_chunks = $1, total_chunks = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
                    [finished, total, databaseId]
                );
            } catch (dbError) {
                console.error(`[${new Date().toISOString()}] [ERROR] [Job ${job.id}] Failed updating progress chunks in database.`, dbError.stack);
            }
        });

        console.log(`[${new Date().toISOString()}] [INFO] [Job ${job.id}] Audio generation complete. Buffer size: ${finalAudioBuffer.length} bytes.`);

        await job.updateProgress(95);

        try {
            const { blobs } = await list({ prefix: `tts-${userId}-` });
            if (blobs.length > 0) {
                const urlsToDelete = blobs.map(b => b.url);
                console.log(`[${new Date().toISOString()}] [INFO] [Job ${job.id}] Found ${blobs.length} existing blobs. Deleting...`);
                await del(urlsToDelete);
            }
        } catch (cleanupError) {
            console.error(`[${new Date().toISOString()}] [ERROR] [Job ${job.id}] Failed to clean up existing blobs.`, cleanupError.stack);
        }

        const uniqueId = crypto.randomUUID();
        const fileName = `tts-${userId}-${uniqueId}.mp3`;
        console.log(`[${new Date().toISOString()}] [INFO] [Job ${job.id}] Uploading filename '${fileName}' to Vercel Blob.`);

        let blob;
        try {
            blob = await put(fileName, finalAudioBuffer, {
                access: 'public',
                contentType: 'audio/mpeg',
                addRandomSuffix: false,
                allowOverwrite: true,
                cacheControlMaxAge: 0
            });
            console.log(`[${new Date().toISOString()}] [INFO] [Job ${job.id}] Vercel Blob upload successful. URL: ${blob.url}`);
        } catch (uploadError) {
            console.error(`[${new Date().toISOString()}] [ERROR] [Job ${job.id}] Vercel Blob upload failure.`, uploadError.stack);
            throw uploadError;
        }

        const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);

        await job.updateProgress(100);

        try {
            await db.query(
                `UPDATE tts_jobs SET status = $1, time_taken = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
                ['completed', timeTaken, databaseId]
            );
            console.log(`[${new Date().toISOString()}] [INFO] [Job ${job.id}] Database status updated to 'completed'.`);
        } catch (dbError) {
            console.error(`[${new Date().toISOString()}] [ERROR] [Job ${job.id}] Failed updating status to 'completed' in database.`, dbError.stack);
            throw dbError;
        }

        return {
            status: 'success',
            timeTaken,
            databaseId,
            url: blob.url
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
    const errorMessage = err?.message || err || "Unknown Error";
    console.error(`[${new Date().toISOString()}] [CRITICAL] [Job ${job?.id || 'UNKNOWN'}] Process execution failed: ${errorMessage}`, err?.stack || err);

    if (job?.data?.databaseId) {
        try {
            await db.query(
                `UPDATE tts_jobs SET status = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
                ['failed', errorMessage, job.data.databaseId]
            );
            console.log(`[${new Date().toISOString()}] [INFO] [Job ${job.id}] Database successfully updated with failure trace.`);
        } catch (dbError) {
            console.error(`[${new Date().toISOString()}] [ERROR] [Job ${job.id}] Database write failed during error handler execution.`, dbError.stack);
        }
    }
});