<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OtpCodeMail extends Mailable
{
    use Queueable, SerializesModels;

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

        return new Envelope(subject: $subject);
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
}