<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EnforcerSchedule extends Model
{
    use HasFactory;

    protected $primaryKey = 'schedule_id';

    protected $fillable = [
        'enforcer_id',
        'duty_location_id',
        'schedule_date',
        'start_time',
        'end_time',
        'shift_type',
        'duties',
        'status',
        'notes',
        'is_recurring',
        'recurrence_pattern',
        'is_archived',
        'archived_at',
        'archived_by',
    ];

    protected $casts = [
        'schedule_date' => 'date',
        'start_time'    => 'datetime',
        'end_time'      => 'datetime',
        'is_recurring'  => 'boolean',
        'is_archived'   => 'boolean',
        'archived_at'   => 'datetime',
    ];

    public function enforcer()
    {
        return $this->belongsTo(User::class, 'enforcer_id', 'user_id');
    }

    public function dutyLocation()
    {
        return $this->belongsTo(DutyLocation::class, 'duty_location_id', 'id');
    }

    public function archivedBy()
    {
        return $this->belongsTo(User::class, 'archived_by', 'user_id');
    }

    public function scopeToday($query)
    {
        return $query->whereDate('schedule_date', now()->toDateString());
    }

    public function scopeUpcoming($query)
    {
        return $query->whereDate('schedule_date', '>=', now()->toDateString());
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
