'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FaGithub } from 'react-icons/fa'
import { authClient } from "@/lib/auth-client";
import toast from 'react-hot-toast'

const inputClass = 'w-full h-10 border border-border bg-background px-3 text-sm outline-none focus:border-primary'

export default function AuthButtons() {
    const router = useRouter()
    const [view, setView] = useState('signin')
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [githubLoading, setGithubLoading] = useState(false)
    const [needsVerification, setNeedsVerification] = useState(false)

    const isSignUp = view === 'signup'
    const isForgotPassword = view === 'forgot'
    const title = useMemo(() => {
        if (isForgotPassword) return 'Reset password'
        return isSignUp ? 'Create account' : 'Sign in'
    }, [isForgotPassword, isSignUp])

    const helpText = useMemo(() => {
        if (isForgotPassword) return 'Enter your email and we will send a reset link.'
        if (isSignUp) return 'Use email and password or continue with GitHub.'
        return 'Use your Voxly account to continue.'
    }, [isForgotPassword, isSignUp])

    const resetTransientState = () => {
        setNeedsVerification(false)
        setPassword('')
    }

    const setAuthView = (nextView) => {
        resetTransientState()
        setView(nextView)
    }

    const handleGithubLogin = async () => {
        setGithubLoading(true)
        await authClient.signIn.social({
            provider: 'github',
            callbackURL: '/',
        })
        setTimeout(() => {
            setGithubLoading(false)
        }, 5000)
    }

    const handleEmailAuth = async (event) => {
        event.preventDefault()
        setNeedsVerification(false)

        if (!email.trim()) return toast.error('Enter your email.')

        if (isForgotPassword) {
            await requestPasswordReset()
            return
        }

        if (password.length < 8) return toast.error('Password must be at least 8 characters.')
        if (isSignUp && !name.trim()) return toast.error('Enter your name.')

        setLoading(true)

        try {
            if (isSignUp) {
                const { error } = await authClient.signUp.email({
                    name: name.trim(),
                    email: email.trim(),
                    password,
                    callbackURL: '/',
                })

                if (error) {
                    toast.error(error.message || 'Could not create account.')
                    return
                }

                toast.success('Account created. Check your email to verify it.')
                setAuthView('signin')
                return
            }

            const { error } = await authClient.signIn.email({
                email: email.trim(),
                password,
                callbackURL: '/',
            })

            if (error) {
                const shouldVerify = error.status === 403 || /verify|verification/i.test(error.message || '')
                setNeedsVerification(shouldVerify)
                toast.error(shouldVerify ? 'Please verify your email before signing in.' : (error.message || 'Could not sign in.'))
                return
            }

            router.push('/')
        } catch (error) {
            console.error('Email auth error:', error)
            toast.error('Authentication failed.')
        } finally {
            setLoading(false)
        }
    }

    const requestPasswordReset = async () => {
        setLoading(true)

        try {
            const { error } = await authClient.requestPasswordReset({
                email: email.trim(),
                redirectTo: `${window.location.origin}/reset-password`,
            })

            if (error) {
                toast.error(error.message || 'Could not send reset email.')
                return
            }

            toast.success('Password reset email sent.')
            setAuthView('signin')
        } catch (error) {
            console.error('Password reset request error:', error)
            toast.error('Could not send reset email.')
        } finally {
            setLoading(false)
        }
    }

    const handleSendVerification = async () => {
        if (!email.trim()) return toast.error('Enter the email for your account.')

        setLoading(true)

        try {
            const { error } = await authClient.sendVerificationEmail({
                email: email.trim(),
                callbackURL: '/',
            })

            if (error) {
                toast.error(error.message || 'Could not send verification email.')
                return
            }

            toast.success('Verification email sent.')
        } catch (error) {
            console.error('Verification email error:', error)
            toast.error('Could not send verification email.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full flex flex-col gap-5">
            <div className="text-center">
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="text-xs text-muted-foreground mt-1">{helpText}</p>
            </div>

            <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
                {isSignUp && (
                    <input
                        className={inputClass}
                        placeholder="Name"
                        value={name}
                        onChange={event => setName(event.target.value)}
                        autoComplete="name"
                    />
                )}

                <input
                    className={inputClass}
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={event => {
                        setEmail(event.target.value)
                        setNeedsVerification(false)
                    }}
                    autoComplete="email"
                />

                {!isForgotPassword && (
                    <input
                        className={inputClass}
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={event => setPassword(event.target.value)}
                        autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    />
                )}

                <Button type="submit" size="lg" disabled={loading} className="rounded-none">
                    {loading ? 'Please wait...' : (isForgotPassword ? 'Send reset link' : title)}
                </Button>
            </form>

            {needsVerification && (
                <div className="border border-border px-3 py-3 text-sm">
                    <p className="text-muted-foreground">Your account needs email verification.</p>
                    <button
                        type="button"
                        className="mt-2 text-xs underline underline-offset-4 hover:text-foreground"
                        onClick={handleSendVerification}
                        disabled={loading}
                    >
                        Send verification email
                    </button>
                </div>
            )}

            {!isForgotPassword && (
                <>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="h-px flex-1 bg-border" />
                        <span>or</span>
                        <div className="h-px flex-1 bg-border" />
                    </div>

                    <Button variant="outline" size="lg" className="gap-3 rounded-none" onClick={handleGithubLogin} disabled={githubLoading || loading}>
                        <FaGithub size={18} />
                        {githubLoading ? 'Redirecting...' : 'Continue with GitHub'}
                    </Button>
                </>
            )}

            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs">
                {!isSignUp && !isForgotPassword && (
                    <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground underline underline-offset-4"
                        onClick={() => setAuthView('signup')}
                    >
                        Create an account
                    </button>
                )}

                {isSignUp && (
                    <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground underline underline-offset-4"
                        onClick={() => setAuthView('signin')}
                    >
                        Already have an account?
                    </button>
                )}

                {!isSignUp && (
                    <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground underline underline-offset-4"
                        onClick={() => setAuthView(isForgotPassword ? 'signin' : 'forgot')}
                    >
                        {isForgotPassword ? 'Back to sign in' : 'Forgot password?'}
                    </button>
                )}
            </div>
        </div>
    )
}
