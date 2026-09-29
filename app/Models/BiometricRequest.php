<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BiometricRequest extends Model
{
    use HasFactory;

    protected $primaryKey = 'request_id';

    protected $fillable = [
        'user_id',
        'request_type',
        'source',
        'failure_count',
        'reason',
        'status',
        'reviewed_by',
        'review_notes',
        'reviewed_at',
    ];

    protected $casts = [
        'reviewed_at'   => 'datetime',
        'failure_count' => 'integer',
    ];

    public const TYPE_SWITCH_TO_FINGERPRINT = 'switch_to_fingerprint';
    public const TYPE_SWITCH_TO_FACE        = 'switch_to_face';
    public const TYPE_RESET_BIOMETRIC       = 'reset_biometric';

    public const STATUS_PENDING  = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    public const SOURCE_ATTENDANCE = 'attendance';
    public const SOURCE_LOGIN      = 'login';

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by', 'user_id');
    }

    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_PENDING);
    }
}
