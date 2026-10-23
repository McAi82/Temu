<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EnforcerAttendance extends Model
{
    use HasFactory;

    protected $primaryKey = 'attendance_id';
    protected $table = 'enforcer_attendance';

    protected $fillable = [
        'enforcer_id', 'date', 'time_in', 'time_out',
        'time_in_photo', 'time_out_photo', 'time_in_location',
        'time_out_location', 'status', 'late_minutes',
        'overtime_minutes', 'notes'
    ];

    protected $casts = [
        'date' => 'date',
        'time_in' => 'datetime',
        'time_out' => 'datetime',
    ];

    public function enforcer()
    {
        return $this->belongsTo(User::class, 'enforcer_id', 'user_id');
    }

    // Accessor for time_in_photo full URL
    public function getTimeInPhotoUrlAttribute()
    {
        if ($this->time_in_photo) {
            return asset('storage/' . $this->time_in_photo);
        }
        return null;
    }

    // Accessor for time_out_photo full URL
    public function getTimeOutPhotoUrlAttribute()
    {
        if ($this->time_out_photo) {
            return asset('storage/' . $this->time_out_photo);
        }
        return null;
    }
}