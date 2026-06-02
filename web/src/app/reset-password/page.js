'use client'

import React, { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'

const inputClass = 'w-full h-10 border border-border bg-background px-3 text-sm outline-none focus:border-primary'

function ResetPasswordForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = useMemo(() => searchParams.get('token'), [searchParams])
    const error = searchParams.get('error')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (event) => {
        event.preventDefault()

        if (!token) return toast.error('Reset token is missing or expired.')
        if (password.length < 8) return toast.error('Password must be at least 8 characters.')
        if (password !== confirmPassword) return toast.error('Passwords do not match.')

        setLoading(true)

        try {
            const { error: resetError } = await authClient.resetPassword({
                token,
                newPassword: password,
            })

            if (resetError) {
                toast.error(resetError.message || 'Could not reset password.')
                return
            }

            toast.success('Password updated. Please sign in.')
            router.push('/login')
        } catch (err) {
            console.error('Password reset error:', err)
            toast.error('Could not reset password.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-6">
            <div className="w-full max-w-sm flex flex-col gap-6">
                <div className="text-center">
                    <h1 className="text-2xl font-semibold">Reset password</h1>
                    <p className="text-sm text-muted-foreground mt-2">
                        Enter a new password for your Voxly account.
                    </p>
                </div>

                {error && (
                    <div className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        This reset link is invalid or expired.
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <input
                        className={inputClass}
                        type="password"
                        placeholder="New password"
                        value={password}
                        onChange={event => setPassword(event.target.value)}
                        autoComplete="new-password"
                    />
                    <input
                        className={inputClass}
                        type="password"
                        placeholder="Confirm password"
                        value={confirmPassword}
                        onChange={event => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                    />
                    <Button type="submit" disabled={loading || !token} className="rounded-none">
                        {loading ? 'Updating...' : 'Update password'}
                    </Button>
                </form>
            </div>
        </div>
    )
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={null}>
            <ResetPasswordForm />
        </Suspense>
    )
}
