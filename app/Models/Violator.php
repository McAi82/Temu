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
        'is_archived',
        'archived_at',
        'archived_by',
    ];

    protected $casts = [
        'expiry'       => 'date',
        'birthday'     => 'date',
        'is_archived'  => 'boolean',
        'archived_at'  => 'datetime',
    ];

    /* ---------------- Relations ---------------- */

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

    public function archivedBy()
    {
        return $this->belongsTo(User::class, 'archived_by', 'user_id');
    }

    /* ---------------- Accessors ---------------- */

    public function getFullNameAttribute()
    {
        $name = trim("{$this->firstname} {$this->middlename} {$this->lastname}");
        if ($this->suffix) {
            $name .= " {$this->suffix}";
        }
        return $name;
    }

    /* ---------------- Archive ---------------- */

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
