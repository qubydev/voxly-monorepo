import { db } from '@/lib/db';
import { ttsJobs } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { supabase } from '@/lib/supabase';
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

        const result = await db
            .select({
                id: ttsJobs.id,
                status: ttsJobs.status,
                fileName: ttsJobs.fileName,
                finishedChunks: ttsJobs.finishedChunks,
                totalChunks: ttsJobs.totalChunks,
                timeTaken: ttsJobs.timeTaken,
                errorMessage: ttsJobs.errorMessage,
            })
            .from(ttsJobs)
            .where(eq(ttsJobs.userId, userId))
            .orderBy(desc(ttsJobs.createdAt))
            .limit(1);

        if (!result || result.length === 0) {
            return Response.json({ status: 'idle' }, { status: 200 });
        }

        const job = result[0];
        let audioUrl = null;

        if (job.status === 'completed' && job.fileName) {
            const { data, error } = await supabase.storage
                .from('tts-audio')
                .createSignedUrl(job.fileName, 3600);

            if (!error && data) {
                audioUrl = data.signedUrl;
            }
        }

        return Response.json({
            jobId: job.id,
            status: job.status,
            finishedChunks: job.finishedChunks,
            totalChunks: job.totalChunks,
            timeTaken: job.timeTaken,
            errorMessage: job.errorMessage,
            audioUrl
        }, { status: 200 });

    } catch (error) {
        console.error('TTS Status Error:', error);
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}