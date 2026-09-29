<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class UserCreatedMail extends Mailable
{
    use Queueable, SerializesModels;

    public $user;
    public $password;

    public function __construct($user, $password)
    {
        $this->user = $user;
        $this->password = $password;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Welcome to TEMU Traffic System',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.user-created',
            with: [
                'user' => $this->user,
                'password' => $this->password,
                'loginUrl' => config('app.url') . '/login',
            ],
        );
    }
}