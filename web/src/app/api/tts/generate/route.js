import { db } from '@/lib/db';
import { ttsJobs, subscription } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { ttsQueue } from '@/lib/queue';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(req) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session || !session.user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;
        const { text, voice } = await req.json();

        if (!text) {
            return Response.json({ error: 'Text is required' }, { status: 400 });
        }

        const cost = text.length;

        const subData = await db
            .select({
                unlimited: subscription.unlimited,
                balance: subscription.balance,
                endsAt: subscription.endsAt
            })
            .from(subscription)
            .where(eq(subscription.userId, userId))
            .limit(1);

        const sub = subData[0];
        const hasActivePlan = Boolean(
            sub &&
            sub.endsAt &&
            new Date(sub.endsAt) > new Date() &&
            (sub.unlimited || sub.balance > 0)
        );
        const isUnlimited = hasActivePlan && sub.unlimited;

        if (!hasActivePlan || (!isUnlimited && sub.balance < cost)) {
            return Response.json({ error: 'Insufficient credits.' }, { status: 403 });
        }

        const activeJobs = await db
            .select({ id: ttsJobs.id })
            .from(ttsJobs)
            .where(
                and(
                    eq(ttsJobs.userId, userId),
                    inArray(ttsJobs.status, ['pending', 'processing'])
                )
            )
            .limit(1);

        if (activeJobs.length > 0) {
            return Response.json({
                error: 'A generation is already in progress. Please wait until it completes.'
            }, { status: 400 });
        }

        const result = await db
            .insert(ttsJobs)
            .values({
                userId: userId,
                textContent: text,
                voice: voice || 'en-US-EmmaMultilingualNeural',
                status: 'pending'
            })
            .returning({ id: ttsJobs.id });

        const databaseId = result[0].id;

        const job = await ttsQueue.add(
            'generate-tts',
            {
                text,
                voice: voice || 'en-US-EmmaMultilingualNeural',
                databaseId,
                userId
            },
            {
                removeOnComplete: { age: 3600, count: 1000 },
                removeOnFail: { age: 86400, count: 1000 }
            }
        );

        return Response.json({
            success: true,
            jobId: databaseId,
            job: {
                id: job.id,
                databaseId,
                status: 'pending'
            }
        }, { status: 201 });

    } catch (error) {
        console.error('TTS Error:', error);
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
