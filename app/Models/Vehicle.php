<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Vehicle extends Model
{
    use HasFactory;

    protected $primaryKey = 'vehicle_id';

    protected $fillable = [
        'platenumber',
        'owner',
        'address',
        'make',
        'color',
        'model',
        'year_model',
        'body_type',
        'engine_number',
        'chassis_number',
        'marking',
        'place_of_violation',
        'or_number',
        'cr_number',
        'registration_expiry',
        'is_archived',
        'archived_at',
        'archived_by',
    ];

    protected $casts = [
        'year_model'          => 'integer',
        'registration_expiry' => 'date',
        'is_archived'         => 'boolean',
        'archived_at'         => 'datetime',
    ];

    public function tickets()
    {
        return $this->hasMany(Ticket::class, 'vehicle_id', 'vehicle_id');
    }

    public function violators()
    {
        return $this->belongsToMany(Violator::class, 'violator_vehicles', 'vehicle_id', 'violator_id')
            ->withPivot('is_primary')
            ->withTimestamps();
    }

    public function archivedBy()
    {
        return $this->belongsTo(User::class, 'archived_by', 'user_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_archived', false);
    }

    public function scopeArchived($query)
    {
        return $query->where('is_archived', true);
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
}
