<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ViolatorVehicle extends Model
{
    use HasFactory;

    protected $primaryKey = 'violator_vehicle_id';
    protected $table = 'violator_vehicles';
    
    protected $fillable = [
        'violator_id', 'vehicle_id', 'is_primary'
    ];

    protected $casts = [
        'is_primary' => 'boolean',
    ];

    public function violator()
    {
        return $this->belongsTo(Violator::class, 'violator_id', 'violator_id');
    }

    public function vehicle()
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id', 'vehicle_id');
    }
}