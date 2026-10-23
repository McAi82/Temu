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
        'is_archived',
        'archived_at',
        'archived_by',
    ];

    protected $casts = [
        'latitude'    => 'float',
        'longitude'   => 'float',
        'radius'      => 'integer',
        'is_active'   => 'boolean',
        'is_archived' => 'boolean',
        'archived_at' => 'datetime',
    ];

    public function enforcer()
    {
        return $this->belongsTo(User::class, 'enforcer_id', 'user_id');
    }

    public function archivedBy()
    {
        return $this->belongsTo(User::class, 'archived_by', 'user_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_archived', false)->where('is_active', true);
    }

    public function scopeArchived($query)
    {
        return $query->where('is_archived', true);
    }

    public function scopeForEnforcer($query, $enforcerId)
    {
        return $query->where('enforcer_id', $enforcerId);
    }

    public function archive(?int $userId = null): void
    {
        $this->is_archived = true;
        $this->archived_at = now();
        $this->archived_by = $userId;
        $this->save();
    }

    public function restoreArchive(): void
    {
        $this->is_archived = false;
        $this->archived_at = null;
        $this->archived_by = null;
        $this->save();
    }

    public static function getNearby($lat, $lng, $radius = 1000)
    {
        return self::selectRaw(
            "*, (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude)))) AS distance",
            [$lat, $lng, $lat]
        )
            ->where('is_archived', false)
            ->having('distance', '<', $radius / 1000)
            ->orderBy('distance')
            ->with('enforcer')
            ->get();
    }
}
