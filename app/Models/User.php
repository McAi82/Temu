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
        'role',
        'contact_number',
        'is_active',
        'profile_image',
        'has_face_registered',
        'temp_password',
    ];

    protected $hidden = ['password_hash', 'temp_password',];

    protected $casts = [
        'is_active' => 'boolean',
        'has_face_registered' => 'boolean',
    ];

    // Helper methods
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
}