<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FaceTakeoverRequest extends Model
{
    use HasFactory;

    protected $primaryKey = 'request_id';

    protected $fillable = [
        'requester_user_id',
        'existing_registration_id',
        'current_owner_user_id',
        'device_id',
        'similarity',
        'requester_front_encoding',
        'requester_left_encoding',
        'requester_right_encoding',
        'requester_front_image',
        'requester_left_image',
        'requester_right_image',
        'status',
        'reviewed_by',
        'review_notes',
        'reviewed_at',
        'consumed_at',
    ];

    protected $casts = [
        'requester_front_encoding' => 'array',
        'requester_left_encoding'  => 'array',
        'requester_right_encoding' => 'array',
        'similarity'  => 'float',
        'reviewed_at' => 'datetime',
        'consumed_at' => 'datetime',
    ];

    protected $hidden = [
        'requester_front_encoding',
        'requester_left_encoding',
        'requester_right_encoding',
    ];

    public function requester()
    {
        return $this->belongsTo(User::class, 'requester_user_id', 'user_id');
    }

    public function currentOwner()
    {
        return $this->belongsTo(User::class, 'current_owner_user_id', 'user_id');
    }

    public function existingRegistration()
    {
        return $this->belongsTo(
            FaceRegistration::class,
            'existing_registration_id',
            'face_registration_id',
        );
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by', 'user_id');
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    public function scopeRejected($query)
    {
        return $query->where('status', 'rejected');
    }
}
