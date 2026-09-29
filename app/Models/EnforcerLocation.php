<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EnforcerLocation extends Model
{
    use HasFactory;

    protected $primaryKey = 'location_id';
    protected $table = 'enforcer_locations';

    protected $fillable = [
        'enforcer_id',
        'latitude',
        'longitude',
        'accuracy',
        'speed',
        'last_updated',
        'is_online',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'accuracy' => 'float',
        'speed' => 'float',
        'last_updated' => 'datetime',
        'is_online' => 'boolean',
    ];

    public function enforcer()
    {
        return $this->belongsTo(User::class, 'enforcer_id', 'user_id');
    }

    // Scope for online enforcers (updated within last 2 minutes)
    public function scopeOnline($query)
    {
        return $query->where('is_online', true)
            ->where('last_updated', '>=', now()->subMinutes(2));
    }

    // Scope for offline enforcers
    public function scopeOffline($query)
    {
        return $query->where(function ($q) {
            $q->where('is_online', false)
                ->orWhere('last_updated', '<', now()->subMinutes(2));
        });
    }
}