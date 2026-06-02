import Image from 'next/image'
import AuthButtons from '@/components/auth-buttons'

export default function LoginPage() {

    return (
        <div className="min-h-screen grid md:grid-cols-2">

            <div className="hidden md:block relative">
                <Image
                    src="/login.jpg"
                    alt="Login visual"
                    fill
                    sizes="50vw"
                    className="object-cover"
                />
            </div>

            <div className="flex flex-col items-center justify-center px-8 py-16 bg-background">
                <div className="w-full max-w-sm flex flex-col items-center gap-8">

                    <div className="flex flex-col items-center gap-2 text-center">
                        <span className="text-4xl font-bold">voxly</span>
                        <p className="text-muted-foreground text-sm">Sign in to continue</p>
                    </div>

                    <AuthButtons />

                    <p className="text-xs text-muted-foreground text-center">
                        By continuing, you agree to our{' '}
                        <a href="#" className="underline underline-offset-4 hover:text-foreground transition-colors">Terms</a>
                        {' '}and{' '}
                        <a href="#" className="underline underline-offset-4 hover:text-foreground transition-colors">Privacy Policy</a>
                    </p>

                </div>
            </div>

        </div>
    )
}
