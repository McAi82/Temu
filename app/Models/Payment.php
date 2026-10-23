<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasFactory;

    protected $primaryKey = 'payment_id';

    protected $fillable = [
        'ticket_id',
        'payment_reference',
        'amount_paid',
        'payment_date',
        'payment_method',
        'payment_status',
        'transaction_id',
        'receipt_number',
        'receipt_path',
        'paid_by',
        'notes',
        'is_archived',
        'archived_at',
        'archived_by',
    ];

    protected $casts = [
        'payment_date' => 'datetime',
        'amount_paid'  => 'decimal:2',
        'is_archived'  => 'boolean',
        'archived_at'  => 'datetime',
    ];

    public function ticket()
    {
        return $this->belongsTo(Ticket::class, 'ticket_id', 'ticket_id');
    }

    public function archivedBy()
    {
        return $this->belongsTo(User::class, 'archived_by', 'user_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_archived', false);
    }

    public function scopeArchived($query)
    {
        return $query->where('is_archived', true);
    }

    public function archive(?int $userId = null): void
    {
        $this->is_archived = true;
        $this->archived_at = now();
        $this->archived_by = $userId;
        $this->save();
    }

    public function restoreArchive(): void
    {
        $this->is_archived = false;
        $this->archived_at = null;
        $this->archived_by = null;
        $this->save();
    }
}
