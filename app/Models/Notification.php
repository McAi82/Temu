<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    use HasFactory;

    protected $primaryKey = 'notification_id';

    protected $fillable = [
        'user_id',
        'title',
        'message',
        'type',
        'is_read',
        'related_entity_type',
        'related_entity_id',
    ];

    protected $casts = [
        'is_read'    => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /* ---------------- Relations ---------------- */

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    /* ---------------- Scopes ---------------- */

    public function scopeUnread($query)
    {
        return $query->where('is_read', false);
    }

    public function scopeForUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    /* ---------------- Type constants ---------------- */

    public const TYPE_TICKET_CREATED         = 'ticket_created';
    public const TYPE_TICKET_PAID            = 'ticket_paid';
    public const TYPE_TICKET_CONTESTED       = 'ticket_contested';
    public const TYPE_TICKET_DISMISSED       = 'ticket_dismissed';
    public const TYPE_TICKET_PARTIAL_PAID    = 'ticket_partial_paid';
    public const TYPE_TICKET_OVERDUE         = 'ticket_overdue';
    public const TYPE_TICKET_DELETED         = 'ticket_deleted';

    public const TYPE_REPEAT_OFFENDER        = 'repeat_offender';
    public const TYPE_APPEAL_FILED           = 'appeal_filed';
    public const TYPE_APPEAL_DECIDED         = 'appeal_decided';

    public const TYPE_PAYMENT_RECEIVED       = 'payment_received';
    public const TYPE_PAYMENT_FAILED         = 'payment_failed';
    public const TYPE_PAYMENT_REFUNDED       = 'payment_refunded';
    public const TYPE_PAYMENT_LARGE          = 'payment_large';
    public const TYPE_DAILY_SUMMARY          = 'daily_summary';

    public const TYPE_ATTENDANCE_LATE         = 'attendance_late';
    public const TYPE_ATTENDANCE_MISSING_OUT  = 'attendance_missing_timeout';
    public const TYPE_ATTENDANCE_ABSENT       = 'attendance_absent';
    public const TYPE_ATTENDANCE_OVERTIME     = 'attendance_overtime';
    public const TYPE_ATTENDANCE_FLAG         = 'attendance_flag';
    public const TYPE_ATTENDANCE_REMINDER     = 'reminder';

    public const TYPE_SCHEDULE_ASSIGNED      = 'schedule_assigned';
    public const TYPE_SCHEDULE_UPDATED       = 'schedule_updated';
    public const TYPE_SCHEDULE_CANCELLED     = 'schedule_cancelled';
    public const TYPE_SCHEDULE_STARTING      = 'schedule_starting';
    public const TYPE_SCHEDULE_MISSED        = 'schedule_missed';
    public const TYPE_SCHEDULE_CONFLICT      = 'schedule_conflict';

    public const TYPE_DUTY_LOCATION_ADDED    = 'duty_location_added';
    public const TYPE_DUTY_LOCATION_UPDATED  = 'duty_location_updated';
    public const TYPE_DUTY_LOCATION_REMOVED  = 'duty_location_removed';
    public const TYPE_DUTY_ZONE_BREACH       = 'duty_zone_breach';
    public const TYPE_DUTY_ENFORCER_OFFLINE  = 'duty_enforcer_offline';

    public const TYPE_USER_CREATED           = 'user_created';
    public const TYPE_USER_DEACTIVATED       = 'user_deactivated';
    public const TYPE_USER_ACTIVATED         = 'user_activated';
    public const TYPE_PASSWORD_RESET         = 'password_reset';

    public const TYPE_FACE_REGISTERED        = 'face_registered';
    public const TYPE_FACE_REGISTRATION_FAILED = 'face_registration_failed';

    public const TYPE_LICENSE_EXPIRED        = 'license_expired';
    public const TYPE_LICENSE_EXPIRING       = 'license_expiring';
    public const TYPE_VIOLATOR_CREATED       = 'violator_created';
    public const TYPE_VEHICLE_CREATED        = 'vehicle_created';
    public const TYPE_VIOLATOR_UPDATED       = 'violator_updated';

    public const TYPE_ENFORCER_ONLINE        = 'enforcer_online';
    public const TYPE_ENFORCER_OFFLINE       = 'enforcer_offline';
    public const TYPE_LOCATION_LOST          = 'location_lost';
    public const TYPE_LOCATION_UNAUTHORIZED  = 'location_unauthorized';

    public const TYPE_REPORT_DAILY           = 'report_daily';
    public const TYPE_REPORT_WEEKLY          = 'report_weekly';
    public const TYPE_REPORT_MONTHLY         = 'report_monthly';
    public const TYPE_REPORT_EXPORTED        = 'report_exported';

    public const TYPE_ANNOUNCEMENT           = 'announcement';
    public const TYPE_SETTINGS_CHANGED       = 'settings_changed';
    public const TYPE_SYSTEM_BACKUP          = 'system_backup';
    public const TYPE_SYSTEM_ALERT           = 'system_alert';
    public const TYPE_SECURITY_ALERT         = 'security_alert';

    /* ---------------- Archive / restore ---------------- */

    public const TYPE_TICKET_ARCHIVED          = 'ticket_archived';
    public const TYPE_TICKET_RESTORED          = 'ticket_restored';

    public const TYPE_VIOLATOR_ARCHIVED        = 'violator_archived';
    public const TYPE_VIOLATOR_RESTORED        = 'violator_restored';

    public const TYPE_VEHICLE_ARCHIVED         = 'vehicle_archived';
    public const TYPE_VEHICLE_RESTORED         = 'vehicle_restored';

    public const TYPE_VIOLATION_ARCHIVED       = 'violation_archived';
    public const TYPE_VIOLATION_RESTORED       = 'violation_restored';

    public const TYPE_USER_ARCHIVED            = 'user_archived';
    public const TYPE_USER_RESTORED            = 'user_restored';

    public const TYPE_SCHEDULE_ARCHIVED        = 'schedule_archived';
    public const TYPE_SCHEDULE_RESTORED        = 'schedule_restored';

    public const TYPE_DUTY_LOCATION_ARCHIVED   = 'duty_location_archived';
    public const TYPE_DUTY_LOCATION_RESTORED   = 'duty_location_restored';

    public const TYPE_PAYMENT_ARCHIVED         = 'payment_archived';
    public const TYPE_PAYMENT_RESTORED         = 'payment_restored';

    public const TYPE_FACE_TAKEOVER_REQUESTED = 'face_takeover_requested';
    public const TYPE_FACE_TAKEOVER_APPROVED  = 'face_takeover_approved';
    public const TYPE_FACE_TAKEOVER_REJECTED  = 'face_takeover_rejected';
    public const TYPE_FACE_TRANSFERRED        = 'face_transferred';
}
