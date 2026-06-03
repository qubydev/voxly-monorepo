import { db } from '@/lib/db';
import { ttsJobs, subscription } from '@/lib/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import { supabase } from '@/lib/supabase';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session || !session.user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;
        const { searchParams } = new URL(req.url);
        const rawJobId = searchParams.get('jobId');
        const requestedJobId = rawJobId && UUID_PATTERN.test(rawJobId) ? rawJobId : null;

        const [jobResult, subResult] = await Promise.all([
            db
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
                .where(
                    requestedJobId
                        ? and(eq(ttsJobs.userId, userId), eq(ttsJobs.id, requestedJobId))
                        : eq(ttsJobs.userId, userId)
                )
                .orderBy(desc(ttsJobs.createdAt))
                .limit(1),
            db
                .select({
                    unlimited: subscription.unlimited,
                    balance: subscription.balance,
                    endsAt: subscription.endsAt,
                })
                .from(subscription)
                .where(eq(subscription.userId, userId))
                .limit(1)
        ]);

        const sub = subResult[0];
        const hasActivePlan = Boolean(
            sub &&
            sub.endsAt &&
            new Date(sub.endsAt) > new Date() &&
            (sub.unlimited || sub.balance > 0)
        );
        const isUnlimited = hasActivePlan && sub.unlimited;
        const credits = hasActivePlan ? sub.balance : 0;

        if (!jobResult || jobResult.length === 0) {
            return Response.json({
                status: 'idle',
                credits,
                isUnlimited
            }, { status: 200 });
        }

        const job = jobResult[0];
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
            audioUrl,
            credits,
            isUnlimited
        }, { status: 200 });

    } catch (error) {
        console.error('TTS Status Error:', error);
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
