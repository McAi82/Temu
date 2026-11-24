<?php

namespace App\Services;

use App\Models\FaceRegistration;
use App\Models\User;

/**
 * Keeps a user's face registration in step with the user's archive state.
 *
 * Archiving a user  -> their active registration is kept (not deleted) but
 *                      deactivated and stamped archived_at / archived_by.
 * Restoring a user  -> the registration archived WITH the user comes back
 *                      as active, unless they already have a new active one.
 *
 * Rows replaced by a transfer/takeover (replaced_at set) are never touched.
 */
class FaceArchiveService
{
    /** @return int number of registrations archived */
    public function archiveForUser(int $userId, ?int $actorId): int
    {
        return FaceRegistration::where('user_id', $userId)
            ->where('is_active', true)
            ->update([
                'is_active'   => false,
                'archived_at' => now(),
                'archived_by' => $actorId,
            ]);
    }

    /** @return bool true if a registration was restored */
    public function restoreForUser(int $userId): bool
    {
        // Register-once rule: don't create a second active registration.
        $hasActive = FaceRegistration::where('user_id', $userId)
            ->where('is_active', true)
            ->exists();

        if ($hasActive) {
            return false;
        }

        $registration = FaceRegistration::where('user_id', $userId)
            ->whereNotNull('archived_at')
            ->whereNull('replaced_at')
            ->orderByDesc('archived_at')
            ->orderByDesc('face_registration_id')
            ->first();

        if (!$registration) {
            return false;
        }

        $registration->is_active   = true;
        $registration->archived_at = null;
        $registration->archived_by = null;
        $registration->save();

        User::where('user_id', $userId)->update(['has_face_registered' => true]);

        return true;
    }
}