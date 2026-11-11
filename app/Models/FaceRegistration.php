<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FaceRegistration extends Model
{
    use HasFactory;

    protected $primaryKey = 'face_registration_id';

    protected $fillable = [
        'user_id',
        'front_encoding',
        'left_encoding',
        'right_encoding',
        'front_image',
        'left_image',
        'right_image',
        'device_id',
        'app_version',
        'threshold_used',
        'is_active',
        'replaced_at',
        'replaced_by_registration_id',
    ];

    protected $casts = [
        'front_encoding' => 'array',
        'left_encoding'  => 'array',
        'right_encoding' => 'array',
        'threshold_used' => 'float',
        'is_active'      => 'boolean',
        'replaced_at'    => 'datetime',
    ];

    /**
     * Encodings are hidden by default to avoid shipping 3 × 192-float
     * arrays to the admin UI on every list request. Controllers that
     * actually need them use ->makeVisible([...]) or ->toArray() with
     * a manual override.
     */
    protected $hidden = [
        'front_encoding',
        'left_encoding',
        'right_encoding',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    public function replacedBy()
    {
        return $this->belongsTo(
            FaceRegistration::class,
            'replaced_by_registration_id',
            'face_registration_id',
        );
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeArchived($query)
    {
        return $query->where('is_active', false);
    }
}