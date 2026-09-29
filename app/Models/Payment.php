<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasFactory;

    protected $primaryKey = 'payment_id';
    
    protected $fillable = [
        'ticket_id', 'payment_reference', 'amount_paid', 'payment_date',
        'payment_method', 'payment_status', 'transaction_id', 'receipt_number',
        'receipt_path', 'paid_by', 'notes'
    ];

    protected $casts = [
        'payment_date' => 'datetime',
        'amount_paid' => 'decimal:2',
    ];

    public function ticket()
    {
        return $this->belongsTo(Ticket::class, 'ticket_id', 'ticket_id');
    }
}