<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory;

    protected $primaryKey = 'user_id';
    protected $table = 'users';

    protected $fillable = [
        'email',
        'password_hash',
        'firstname',
        'middlename',
        'lastname',
        'suffix',
        'role',
        'contact_number',
        'is_active',
        'profile_image',
        'has_face_registered',
        'active_device_id',
        'device_switch_available_at',
        'is_archived',
        'archived_at',
        'archived_by',
    ];

    protected $hidden = ['password_hash'];

    protected $casts = [
        'is_active'                  => 'boolean',
        'has_face_registered'        => 'boolean',
        'device_switch_available_at' => 'datetime',
        'is_archived'                => 'boolean',
        'archived_at'                => 'datetime',
    ];

    protected static function booted(): void
    {
        static::updated(function (User $user) {
            if ($user->wasChanged('is_archived') && $user->is_archived) {
                $user->tokens()->delete();
            }
        });
    }

    /* ---------------- Role helpers ---------------- */

    public function isAdmin()
    {
        return $this->role === 'admin';
    }

    public function isStaff()
    {
        return $this->role === 'staff';
    }

    public function isEnforcer()
    {
        return $this->role === 'enforcer';
    }

    public function hasWebAccess()
    {
        return in_array($this->role, ['admin', 'staff']);
    }

    public function hasMobileAccess()
    {
        return $this->role === 'enforcer';
    }

    /* ---------------- Relations ---------------- */

    public function tickets()
    {
        return $this->hasMany(Ticket::class, 'enforcer_id', 'user_id');
    }

    public function faces()
    {
        return $this->hasMany(Face::class, 'user_id', 'user_id');
    }

    public function face()
    {
        return $this->hasOne(Face::class, 'user_id', 'user_id');
    }

    public function archivedBy()
    {
        return $this->belongsTo(User::class, 'archived_by', 'user_id');
    }

    /* ---------------- Device switching ---------------- */

    public function canSwitchDevice(): bool
    {
        if (!$this->device_switch_available_at) {
            return true;
        }
        return $this->device_switch_available_at->isPast();
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
