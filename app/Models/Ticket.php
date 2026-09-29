<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Ticket extends Model
{
    use HasFactory;

    protected $primaryKey = 'ticket_id';

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
        'remarks',
        'status',
        'qr_code',
        'pdf_path'
    ];

    protected $casts = [
        'violation_datetime' => 'datetime',
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
    ];

    protected $appends = ['total_fine', 'qr_code_url'];

    // Relationships
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

    // Accessor for total fine
    public function getTotalFineAttribute()
    {
        return $this->violations ? $this->violations->sum('fine_amount') : 0;
    }

    // Accessor for total demerit points
    public function getTotalDemeritPointsAttribute()
    {
        return $this->violations ? $this->violations->sum('demerit_points') : 0;
    }

    // ✅ Accessor for QR code URL
    public function getQrCodeUrlAttribute()
    {
        if ($this->qr_code) {
            return asset('storage/' . $this->qr_code);
        }
        return null;
    }
}
