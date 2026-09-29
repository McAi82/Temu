<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Vehicle extends Model
{
    use HasFactory;

    protected $primaryKey = 'vehicle_id';
    
    protected $fillable = [
        'platenumber', 'owner', 'address', 'make', 'color', 'model', 'year_model',
        'body_type', 'engine_number', 'chassis_number', 'marking', 'place_of_violation',
        'or_number', 'cr_number', 'registration_expiry'
    ];

    protected $casts = [
        'year_model' => 'integer',
        'registration_expiry' => 'date',
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
}