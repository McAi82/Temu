<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Violator extends Model
{
    use HasFactory;

    protected $primaryKey = 'violator_id';

    protected $fillable = [
        'firstname',
        'middlename',
        'lastname',
        'suffix',
        'license',
        'expiry',
        'birthday',
        'height',
        'gender',
        'prof_non_prof',
        'nationality',
        'weight',
        'restriction',
        'email',
        'contact_number',
        'address',
        'profile_photo',
    ];

    protected $casts = [
        'expiry' => 'date',
        'birthday' => 'date',
    ];

    public function tickets()
    {
        return $this->hasMany(Ticket::class, 'violator_id', 'violator_id');
    }

    public function vehicles()
    {
        return $this->belongsToMany(Vehicle::class, 'violator_vehicles', 'violator_id', 'vehicle_id')
            ->withPivot('is_primary')
            ->withTimestamps();
    }

    public function repeatOffender()
    {
        return $this->hasOne(RepeatOffender::class, 'violator_id', 'violator_id');
    }

    public function appeals()
    {
        return $this->hasMany(Appeal::class, 'violator_id', 'violator_id');
    }

    // Accessor for full name
    public function getFullNameAttribute()
    {
        $name = trim("{$this->firstname} {$this->middlename} {$this->lastname}");
        if ($this->suffix) {
            $name .= " {$this->suffix}";
        }
        return $name;
    }
}