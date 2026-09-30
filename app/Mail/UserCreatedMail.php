<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class UserCreatedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public string $plainPassword,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Your TEMU Account Has Been Created',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.user-created',
            with: [
                'user'          => $this->user,
                'plainPassword' => $this->plainPassword,
                'loginUrl'      => config('app.frontend_url', config('app.url')),
            ],
        );
    }
}