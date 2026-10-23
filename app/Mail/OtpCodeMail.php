<?php

namespace App\Mail;

use App\Models\OtpCode;
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
        return new Envelope(
            subject: $this->subjectForPurpose(),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.otp-code',
            with: [
                'user'       => $this->user,
                'code'       => $this->code,
                'purpose'    => $this->purpose,
                'intro'      => $this->introForPurpose(),
                'ttlMinutes' => $this->ttlMinutes,
            ],
        );
    }

    private function subjectForPurpose(): string
    {
        return match ($this->purpose) {
            OtpCode::PURPOSE_LOGIN          => 'Your TEMU sign-in code',
            OtpCode::PURPOSE_PASSWORD_RESET => 'Your TEMU password reset code',
            OtpCode::PURPOSE_DEVICE_SWITCH  => 'Your TEMU device switch code',
            default                         => 'Your TEMU verification code',
        };
    }

    private function introForPurpose(): string
    {
        return match ($this->purpose) {
            OtpCode::PURPOSE_LOGIN =>
                'Use this code to finish signing in to TEMU.',
            OtpCode::PURPOSE_PASSWORD_RESET =>
                'Use this code to reset your TEMU password.',
            OtpCode::PURPOSE_DEVICE_SWITCH =>
                'Use this code to move your TEMU account to a new device. ' .
                'Signing in on the new device will sign out your previous device, ' .
                "and you won't be able to switch devices again for 12 hours.",
            default =>
                'Use this code to continue.',
        };
    }
}