import { Resend } from 'resend';

function getResend() {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
        throw new Error('RESEND_API_KEY is required to send email');
    }

    return new Resend(apiKey);
}

export async function sendEmail({ to, subject, text, html }) {
    const from = process.env.RESEND_FROM || 'onboarding@resend.dev';
    const resend = getResend();

    const { error } = await resend.emails.send({
        from,
        to,
        subject,
        text,
        html,
    });

    if (error) {
        throw new Error(error.message || 'Failed to send email with Resend');
    }
}
