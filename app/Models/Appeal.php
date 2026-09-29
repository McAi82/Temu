<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Appeal extends Model
{
    use HasFactory;

    protected $primaryKey = 'appeal_id';
    
    protected $fillable = [
        'ticket_id', 'violator_id', 'appeal_reason', 'supporting_documents',
        'status', 'reviewed_by', 'review_notes', 'decision_date'
    ];

    protected $casts = [
        'decision_date' => 'datetime',
    ];

    public function ticket()
    {
        return $this->belongsTo(Ticket::class, 'ticket_id', 'ticket_id');
    }

    public function violator()
    {
        return $this->belongsTo(Violator::class, 'violator_id', 'violator_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by', 'user_id');
    }
}