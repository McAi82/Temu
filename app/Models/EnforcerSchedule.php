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
    ];

    protected $casts = [
        'schedule_date' => 'date',
        'start_time' => 'datetime',
        'end_time' => 'datetime',
        'is_recurring' => 'boolean',
    ];

    public function enforcer()
    {
        return $this->belongsTo(User::class, 'enforcer_id', 'user_id');
    }

    public function dutyLocation()
    {
        return $this->belongsTo(DutyLocation::class, 'duty_location_id', 'id');
    }

    // Scope for today's schedules
    public function scopeToday($query)
    {
        return $query->whereDate('schedule_date', now()->toDateString());
    }

    // Scope for upcoming schedules
    public function scopeUpcoming($query)
    {
        return $query->whereDate('schedule_date', '>=', now()->toDateString());
    }

    // Scope for active schedules
    public function scopeActive($query)
    {
        return $query->whereIn('status', ['scheduled', 'in_progress']);
    }
}