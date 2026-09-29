<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DutyLocation extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'address',
        'latitude',
        'longitude',
        'enforcer_id',
        'schedule',
        'radius',
        'is_active',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'radius' => 'integer',
        'is_active' => 'boolean',
    ];

    public function enforcer()
    {
        return $this->belongsTo(User::class, 'enforcer_id', 'user_id');
    }

    // Scope for active locations
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    // Scope for locations assigned to a specific enforcer
    public function scopeForEnforcer($query, $enforcerId)
    {
        return $query->where('enforcer_id', $enforcerId);
    }

    // Calculate distance from a given point using Haversine formula
    public static function getNearby($lat, $lng, $radius = 1000)
    {
        return self::selectRaw(
            "*, (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude)))) AS distance",
            [$lat, $lng, $lat]
        )
            ->having('distance', '<', $radius / 1000)
            ->orderBy('distance')
            ->with('enforcer')
            ->get();
    }
}