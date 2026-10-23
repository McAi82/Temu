<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ViolationName extends Model
{
    use HasFactory;

    protected $primaryKey = 'violation_id';
    protected $table = 'violation_types';

    protected $fillable = [
        'violation_code',
        'violation_name',
        'description',
        'fine_amount',
        'demerit_points',
        'is_active',
        'category',
        'is_archived',
        'archived_at',
        'archived_by',
    ];

    protected $casts = [
        'fine_amount' => 'decimal:2',
        'is_active'   => 'boolean',
        'is_archived' => 'boolean',
        'archived_at' => 'datetime',
    ];

    public function tickets()
    {
        return $this->belongsToMany(Ticket::class, 'ticket_violations', 'violation_id', 'ticket_id')
            ->withPivot('fine_amount', 'demerit_points')
            ->withTimestamps();
    }

    public function ticketViolations()
    {
        return $this->hasMany(TicketViolation::class, 'violation_id', 'violation_id');
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
