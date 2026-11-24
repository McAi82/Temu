<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Ticket extends Model
{
    use HasFactory;

    protected $primaryKey = 'ticket_id';

    public const PAYMENT_DUE_DAYS = 3; // legacy – kept for compatibility
    public const PAYMENT_DUE_HOURS = 72;          // business hours (Sat/Sun excluded)
    public const WARRANT_AFTER_MONTHS = 2;        // unpaid this long after deadline → warrant visit
    public const WARNING_COOLDOWN_HOURS = 24;     // don't re-email the same ticket within this window

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
        'warning_sent_at',
        'warning_count',
        'warrant_status',
        'warrant_flagged_at',
        'warrant_visited_at',
    ];

    protected $casts = [
        'violation_datetime' => 'datetime',
        'payment_due_at'     => 'datetime',
        'latitude'           => 'decimal:8',
        'longitude'          => 'decimal:8',
        'is_archived'        => 'boolean',
        'archived_at'        => 'datetime',
        'warning_sent_at'    => 'datetime',
        'warrant_flagged_at' => 'datetime',
        'warrant_visited_at' => 'datetime',
    ];

    protected $appends = [
        'total_fine',
        'total_demerit_points',
        'qr_code_url',
        'days_until_due',
        'is_overdue',
        'is_due_soon',
        'warrant_eligible_at',
    ];

    protected static function booted(): void
    {
        static::creating(function (Ticket $ticket) {
            if (!$ticket->payment_due_at) {
                $base = $ticket->created_at
                    ? \Carbon\Carbon::parse($ticket->created_at)
                    : now();
                $ticket->payment_due_at = self::addBusinessHours($base);
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
        if ($this->status === 'paid') return false;
        return $this->payment_due_at->isPast();
    }

    /** Nearly due = 24 business hours (or less) left before the 72h deadline. */
    public function getIsDueSoonAttribute(): bool
    {
        if (!$this->payment_due_at || $this->status !== 'issued') return false;
        if ($this->payment_due_at->isPast()) return false;
        $left = self::businessSecondsBetween(now(), $this->payment_due_at);
        return $left <= 24 * 3600;
    }

    /** When an unpaid ticket becomes eligible for a warrant visit. */
    public function getWarrantEligibleAtAttribute()
    {
        return $this->payment_due_at
            ? $this->payment_due_at->copy()->addMonths(self::WARRANT_AFTER_MONTHS)
            : null;
    }

    /* ---------------- Business-hours deadline (Sat/Sun excluded) ---------------- */

    /** Add N business hours to a moment, skipping Saturdays and Sundays. */
    public static function addBusinessHours(\DateTimeInterface $from, int $hours = self::PAYMENT_DUE_HOURS): \Carbon\Carbon
    {
        $cursor    = \Carbon\Carbon::instance($from)->setTimezone(config('app.timezone'));
        $remaining = $hours * 3600;

        while ($remaining > 0) {
            if ($cursor->isWeekend()) {
                $cursor = $cursor->copy()->next(\Carbon\Carbon::MONDAY)->startOfDay();
                continue;
            }
            $endOfDay  = $cursor->copy()->addDay()->startOfDay();
            $available = $endOfDay->timestamp - $cursor->timestamp;

            if ($available >= $remaining) {
                return $cursor->copy()->addSeconds($remaining);
            }
            $remaining -= $available;
            $cursor     = $endOfDay;
        }
        return $cursor;
    }

    /** Seconds between two moments, not counting Saturdays and Sundays. */
    public static function businessSecondsBetween(\DateTimeInterface $from, \DateTimeInterface $to): int
    {
        $tz     = config('app.timezone');
        $cursor = \Carbon\Carbon::instance($from)->setTimezone($tz);
        $end    = \Carbon\Carbon::instance($to)->setTimezone($tz);
        $total  = 0;

        while ($cursor->lt($end)) {
            if ($cursor->isWeekend()) {
                $cursor = $cursor->copy()->next(\Carbon\Carbon::MONDAY)->startOfDay();
                continue;
            }
            $endOfDay   = $cursor->copy()->addDay()->startOfDay();
            $segmentEnd = $endOfDay->lt($end) ? $endOfDay : $end->copy();
            $total     += $segmentEnd->timestamp - $cursor->timestamp;
            $cursor     = $segmentEnd;
        }
        return $total;
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