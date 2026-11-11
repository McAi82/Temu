<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Ticket extends Model
{
    use HasFactory;

    protected $primaryKey = 'ticket_id';

    public const PAYMENT_DUE_DAYS = 3;

    protected $fillable = [
        'ticket_number',
        'idempotency_key',
        'violator_id',
        'vehicle_id',
        'enforcer_id',
        'location',
        'latitude',
        'longitude',
        'violation_datetime',
        'payment_due_at',
        'remarks',
        'status',
        'qr_code',
        'pdf_path',
        'is_archived',
        'archived_at',
        'archived_by',
    ];

    protected $casts = [
        'violation_datetime' => 'datetime',
        'payment_due_at'     => 'datetime',
        'latitude'           => 'decimal:8',
        'longitude'          => 'decimal:8',
        'is_archived'        => 'boolean',
        'archived_at'        => 'datetime',
    ];

    protected $appends = [
        'total_fine',
        'total_demerit_points',
        'qr_code_url',
        'days_until_due',
        'is_overdue',
        'is_due_soon',
    ];

    protected static function booted(): void
    {
        static::creating(function (Ticket $ticket) {
            if (!$ticket->payment_due_at) {
                $base = $ticket->created_at
                    ? \Carbon\Carbon::parse($ticket->created_at)
                    : now();
                $ticket->payment_due_at = $base->copy()->addDays(self::PAYMENT_DUE_DAYS);
            }
        });
    }

    /* ---------------- Relations ---------------- */

    public function violator()
    {
        return $this->belongsTo(Violator::class, 'violator_id', 'violator_id');
    }

    public function vehicle()
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id', 'vehicle_id');
    }

    public function enforcer()
    {
        return $this->belongsTo(User::class, 'enforcer_id', 'user_id');
    }

    public function violations()
    {
        return $this->hasMany(TicketViolation::class, 'ticket_id', 'ticket_id');
    }

    public function payments()
    {
        return $this->hasMany(Payment::class, 'ticket_id', 'ticket_id');
    }

    public function appeal()
    {
        return $this->hasOne(Appeal::class, 'ticket_id', 'ticket_id');
    }

    public function archivedBy()
    {
        return $this->belongsTo(User::class, 'archived_by', 'user_id');
    }

    /* ---------------- Accessors ---------------- */

    public function getTotalFineAttribute()
    {
        return $this->violations ? $this->violations->sum('fine_amount') : 0;
    }

    public function getTotalDemeritPointsAttribute()
    {
        return $this->violations ? $this->violations->sum('demerit_points') : 0;
    }

    public function getQrCodeUrlAttribute()
    {
        if ($this->qr_code) {
            return asset('storage/' . $this->qr_code);
        }
        return null;
    }

    /**
     * Whole calendar days remaining until payment is due.
     * Negative = overdue, 0 = due today.
     */
    public function getDaysUntilDueAttribute(): ?int
    {
        if (!$this->payment_due_at) return null;
        return now()->startOfDay()->diffInDays(
            $this->payment_due_at->copy()->startOfDay(),
            false,
        );
    }

    public function getIsOverdueAttribute(): bool
    {
        if (!$this->payment_due_at) return false;
        if (in_array($this->status, ['paid', 'dismissed'], true)) return false;
        return $this->payment_due_at->isPast();
    }

    public function getIsDueSoonAttribute(): bool
    {
        if (!$this->payment_due_at || $this->status !== 'issued') return false;
        $days = $this->days_until_due;
        return $days !== null && $days >= 0 && $days <= 1;
    }

    /* ---------------- Archive ---------------- */

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