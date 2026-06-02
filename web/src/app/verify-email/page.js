'use client'

import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import Loader from '@/components/loader'

function VerifyEmailContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = useMemo(() => searchParams.get('token'), [searchParams])
    const [message, setMessage] = useState('Verifying your email...')
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        let cancelled = false

        async function verifyEmail() {
            if (!token) {
                setFailed(true)
                setMessage('Verification link is missing a token.')
                return
            }

            const { error } = await authClient.verifyEmail({
                query: { token },
            })

            if (cancelled) return

            if (error) {
                setFailed(true)
                setMessage(error.message || 'Verification link is invalid or expired.')
                return
            }

            setMessage('Email verified. Taking you to your dashboard...')
            setTimeout(() => {
                router.replace('/')
            }, 900)
        }

        verifyEmail()

        return () => {
            cancelled = true
        }
    }, [router, token])

    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-6">
            <div className="w-full max-w-sm text-center flex flex-col items-center gap-4">
                {!failed && <Loader />}
                <div>
                    <h1 className="text-2xl font-semibold">
                        {failed ? 'Verification failed' : 'Verify email'}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-2">{message}</p>
                </div>
                {failed && (
                    <button
                        type="button"
                        className="text-sm underline underline-offset-4 hover:text-foreground"
                        onClick={() => router.replace('/login')}
                    >
                        Back to login
                    </button>
                )}
            </div>
        </div>
    )
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<Loader />}>
            <VerifyEmailContent />
        </Suspense>
    )
}
