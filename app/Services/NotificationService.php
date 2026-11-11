<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    /**
     * Create a notification for a single user.
     */
    public static function notifyUser(
        int $userId,
        string $title,
        string $message,
        string $type,
        ?string $entityType = null,
        ?int $entityId = null
    ): ?Notification {
        try {
            return Notification::create([
                'user_id' => $userId,
                'title' => $title,
                'message' => $message,
                'type' => $type,
                'is_read' => false,
                'related_entity_type' => $entityType,
                'related_entity_id' => $entityId,
            ]);
        } catch (\Throwable $e) {
            Log::error('NotificationService::notifyUser failed', [
                'user_id' => $userId,
                'type' => $type,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Create the same notification for many users.
     */
    public static function notifyUsers(
        array $userIds,
        string $title,
        string $message,
        string $type,
        ?string $entityType = null,
        ?int $entityId = null
    ): int {
        $count = 0;
        foreach (array_unique($userIds) as $uid) {
            if (!empty($uid) && self::notifyUser($uid, $title, $message, $type, $entityType, $entityId)) {
                $count++;
            }
        }
        return $count;
    }

    /**
     * Notify all users with the given role(s).
     */
    public static function notifyRoles(
        array $roles,
        string $title,
        string $message,
        string $type,
        ?string $entityType = null,
        ?int $entityId = null
    ): int {
        $ids = User::whereIn('role', $roles)
            ->where('is_active', true)
            ->pluck('user_id')
            ->toArray();

        return self::notifyUsers($ids, $title, $message, $type, $entityType, $entityId);
    }

    /**
     * Shorthand for admin + staff broadcast.
     */
    public static function notifyAdminStaff(
        string $title,
        string $message,
        string $type,
        ?string $entityType = null,
        ?int $entityId = null
    ): int {
        return self::notifyRoles(['admin', 'staff'], $title, $message, $type, $entityType, $entityId);
    }

    /**
     * Shorthand for admin-only broadcast.
     */
    public static function notifyAdmins(
        string $title,
        string $message,
        string $type,
        ?string $entityType = null,
        ?int $entityId = null
    ): int {
        return self::notifyRoles(['admin'], $title, $message, $type, $entityType, $entityId);
    }
}