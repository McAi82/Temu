<?php

namespace App\Mail;

use App\Models\Ticket;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OverdueTicketWarning extends Mailable
{
    use SerializesModels;

    public function __construct(
        public Ticket $ticket,
        public float $balance,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Payment Overdue – Ticket {$this->ticket->ticket_number}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.overdue-ticket-warning',
            with: [
                'ticket'    => $this->ticket,
                'balance'   => $this->balance,
                'name'      => trim(($this->ticket->violator->firstname ?? '') . ' ' . ($this->ticket->violator->lastname ?? '')),
                'dueAt'     => $this->ticket->payment_due_at,
                'warrantAt' => $this->ticket->payment_due_at->copy()->addMonths(Ticket::WARRANT_AFTER_MONTHS),
            ],
        );
    }
}