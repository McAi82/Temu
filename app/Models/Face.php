<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Face extends Model
{
    use HasFactory;

    protected $primaryKey = 'face_id';

    protected $fillable = [
        'user_id',
        'encoding',
        'confidence',
        'quality_score',
        'is_active',
    ];

    protected $casts = [
        'encoding' => 'array',
        'confidence' => 'float',
        'quality_score' => 'float',
        'is_active' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }
}