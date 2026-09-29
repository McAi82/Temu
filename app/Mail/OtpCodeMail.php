<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OtpCodeMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param User   $user       The recipient. Used for name + first name in the body.
     * @param string $code       The plaintext 6-digit code. Only exists here in memory.
     * @param string $purpose    'login' or 'password_reset'.
     * @param int    $ttlMinutes Minutes until the code expires. Rendered in the body.
     */
    public function __construct(
        public User $user,
        public string $code,
        public string $purpose,
        public int $ttlMinutes,
    ) {
    }

    public function envelope(): Envelope
    {
        $subject = $this->purpose === 'password_reset'
            ? 'TEMU — Password Reset Code'
            : 'TEMU — Login Verification Code';

        // Explicit From address. Even if MAIL_FROM_ADDRESS is set in .env,
        // setting it here guarantees a valid sender and avoids the
        // "An email must have a From header" exception in environments
        // where the .env value is empty or misconfigured.
        $fromAddress = config('mail.from.address') ?: 'noreply@temu.gov.ph';
        $fromName = config('mail.from.name') ?: 'TEMU Traffic System';

        return new Envelope(
            from: new Address($fromAddress, $fromName),
            subject: $subject,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.otp-code',
            with: [
                'user' => $this->user,
                'code' => $this->code,
                'purpose' => $this->purpose,
                'ttlMinutes' => $this->ttlMinutes,
                'firstName' => $this->user->firstname,
            ],
        );
    }

    /**
     * No file attachments. Kept as an explicit method so a future
     * addition (e.g. an audit PDF) has a natural home.
     */
    public function attachments(): array
    {
        return [];
    }
}