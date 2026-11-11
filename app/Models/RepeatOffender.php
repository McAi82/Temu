<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RepeatOffender extends Model
{
    use HasFactory;

    protected $primaryKey = 'offender_id';
    
    protected $fillable = [
        'violator_id', 'total_violations', 'total_demerit_points',
        'total_fines', 'last_violation_date', 'is_flagged', 'flag_reason'
    ];

    protected $casts = [
        'total_fines' => 'decimal:2',
        'last_violation_date' => 'datetime',
        'is_flagged' => 'boolean',
    ];

    public function violator()
    {
        return $this->belongsTo(Violator::class, 'violator_id', 'violator_id');
    }
}