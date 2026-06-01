import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

const noStoreHeaders = { 'Cache-Control': 'no-store' };

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
      SELECT id, status, finished_chunks, total_chunks, time_taken, audio_url, error_message 
      FROM tts_jobs 
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 1
    `);

        if (!result.rows || result.rows.length === 0) {
            return Response.json({ status: 'idle' }, { status: 200, headers: noStoreHeaders });
        }

        const job = result.rows[0];
        let audioUrl = null;

        if (job.status === 'completed') {
            audioUrl = job.audio_url;
        }

        return Response.json({
            jobId: job.id,
            status: job.status,
            finishedChunks: job.finished_chunks,
            totalChunks: job.total_chunks,
            timeTaken: job.time_taken,
            errorMessage: job.error_message,
            audioUrl
        }, { status: 200, headers: noStoreHeaders });

    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
