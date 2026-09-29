<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ViolationType extends Model
{
    use HasFactory;

    protected $primaryKey = 'violation_id';
    protected $table = 'violation_types';
    
    protected $fillable = [
        'violation_code', 'violation_name', 'description', 
        'fine_amount', 'demerit_points', 'is_active', 'category'
    ];

    protected $casts = [
        'fine_amount' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function tickets()
    {
        return $this->belongsToMany(Ticket::class, 'ticket_violations', 'violation_id', 'ticket_id')
                    ->withPivot('fine_amount', 'demerit_points')
                    ->withTimestamps();
    }

    public function ticketViolations()
    {
        return $this->hasMany(TicketViolation::class, 'violation_id', 'violation_id');
    }
}