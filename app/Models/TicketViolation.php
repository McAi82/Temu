<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TicketViolation extends Model
{
    use HasFactory;

    protected $primaryKey = 'ticket_violation_id';
    
    protected $fillable = [
        'ticket_id', 'violation_id', 'fine_amount', 'demerit_points'
    ];

    public function ticket()
    {
        return $this->belongsTo(Ticket::class, 'ticket_id', 'ticket_id');
    }

    public function violationType()
    {
        return $this->belongsTo(ViolationType::class, 'violation_id', 'violation_id');
    }
}