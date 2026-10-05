<?php

namespace App\Observers;

use App\Models\FaceRegistration;

class FaceRegistrationObserver
{
    /**
     * Before a new row is created, archive any existing active row
     * for the same user. This guarantees the invariant even if a
     * controller forgets to do it.
     */
    public function creating(FaceRegistration $registration): void
    {
        if (!$registration->is_active) {
            return;
        }

        FaceRegistration::where('user_id', $registration->user_id)
            ->where('is_active', true)
            ->update([
                'is_active'   => false,
                'replaced_at' => now(),
            ]);
    }
}