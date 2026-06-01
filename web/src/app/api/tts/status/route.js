import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { list } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session || !session.user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;

        const result = await db.execute(sql`
      SELECT id, status, finished_chunks, total_chunks, time_taken, error_message 
      FROM tts_jobs 
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 1
    `);

        if (!result.rows || result.rows.length === 0) {
            return Response.json({ status: 'idle' }, { status: 200 });
        }

        const job = result.rows[0];
        let audioUrl = null;

        if (job.status === 'completed') {
            const fileName = `tts-${userId}.mp3`;
            const { blobs } = await list({ prefix: fileName });
            const existingFile = blobs.find(file => file.pathname === fileName);

            if (existingFile) {
                audioUrl = existingFile.url;
            }
        }

        return Response.json({
            jobId: job.id,
            status: job.status,
            finishedChunks: job.finished_chunks,
            totalChunks: job.total_chunks,
            timeTaken: job.time_taken,
            errorMessage: job.error_message,
            audioUrl
        }, { status: 200 });

    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}