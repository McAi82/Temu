<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\EnforcerLocation;
use App\Models\EnforcerSchedule;
use App\Models\Notification;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class LocationController extends Controller
{
    /* ==================================================================
     |  HELPERS
     ================================================================== */

    /**
     * Returns the schedule an enforcer has for today, or null.
     */
    private function todaysSchedule(int $enforcerId): ?EnforcerSchedule
    {
        return EnforcerSchedule::where('enforcer_id', $enforcerId)
            ->whereDate('schedule_date', now()->toDateString())
            ->whereIn('status', ['scheduled', 'in_progress'])
            ->active()
            ->orderBy('start_time')
            ->first();
    }

    /**
     * Response body used when the enforcer is off-duty.
     */
    private function offDutyResponse(): \Illuminate\Http\JsonResponse
    {
        return response()->json([
            'message' => 'You have no schedule today. Location sharing is disabled on off-duty days.',
            'code'    => 'NO_SCHEDULE_TODAY',
        ], 422);
    }

    /* ==================================================================
     |  UPDATE
     ================================================================== */

    public function update(Request $request)
    {
        $request->validate([
            'latitude'  => 'required|numeric',
            'longitude' => 'required|numeric',
        ]);

        $user = $request->user();

        // ── SCHEDULE GATE: no schedule today → reject ──
        if (!$this->todaysSchedule($user->user_id)) {
            return $this->offDutyResponse();
        }

        $existing = EnforcerLocation::where('enforcer_id', $user->user_id)->first();

        $wasOffline = !$existing
            || !$existing->is_online
            || ($existing->last_updated && $existing->last_updated->lt(now()->subMinutes(15)));

        EnforcerLocation::updateOrCreate(
            ['enforcer_id' => $user->user_id],
            [
                'latitude'     => $request->latitude,
                'longitude'    => $request->longitude,
                'accuracy'     => $request->accuracy,
                'speed'        => $request->speed,
                'last_updated' => now(),
                'is_online'    => true,
            ]
        );

        if ($wasOffline) {
            try {
                $name = trim("{$user->firstname} {$user->lastname}");
                NotificationService::notifyAdmins(
                    'Enforcer Online',
                    "{$name} is now online and sharing location",
                    Notification::TYPE_ENFORCER_ONLINE,
                    'user',
                    $user->user_id
                );
            } catch (\Throwable $ne) {
                Log::warning('Enforcer online notification failed: ' . $ne->getMessage());
            }
        }

        return response()->json(['message' => 'Location updated']);
    }

    /* ==================================================================
     |  MARK OFFLINE (always allowed — safety valve)
     ================================================================== */

    public function markOffline(Request $request)
    {
        $user = $request->user();

        $current = EnforcerLocation::where('enforcer_id', $user->user_id)->first();
        $wasOnline = $current && $current->is_online;

        EnforcerLocation::where('enforcer_id', $user->user_id)
            ->update(['is_online' => false, 'last_updated' => now()]);

        if ($wasOnline) {
            try {
                $name = trim("{$user->firstname} {$user->lastname}");
                NotificationService::notifyAdmins(
                    'Enforcer Offline',
                    "{$name} has gone offline",
                    Notification::TYPE_ENFORCER_OFFLINE,
                    'user',
                    $user->user_id
                );
            } catch (\Throwable $ne) {
                Log::warning('Enforcer offline notification failed: ' . $ne->getMessage());
            }
        }

        return response()->json(['message' => 'Marked offline']);
    }

    /* ==================================================================
     |  HEARTBEAT
     ================================================================== */

    public function heartbeat(Request $request)
    {
        $user = $request->user();

        // ── SCHEDULE GATE: no schedule today → reject + mark offline ──
        if (!$this->todaysSchedule($user->user_id)) {
            EnforcerLocation::where('enforcer_id', $user->user_id)
                ->update(['is_online' => false, 'last_updated' => now()]);

            return $this->offDutyResponse();
        }

        EnforcerLocation::where('enforcer_id', $user->user_id)->update([
            'last_updated' => now(),
            'is_online'    => true,
        ]);

        return response()->json(['message' => 'Heartbeat received']);
    }

    /* ==================================================================
     |  READS
     ================================================================== */

    public function get(Request $request)
    {
        $location = EnforcerLocation::where('enforcer_id', $request->user()->user_id)->first();
        return response()->json($location);
    }

    public function getEnforcer($id)
    {
        $location = EnforcerLocation::where('enforcer_id', $id)->first();

        $currentUser = request()->user();
        if ($currentUser && $currentUser->user_id != $id && $currentUser->role === 'enforcer') {
            try {
                NotificationService::notifyAdmins(
                    'Unauthorized Location Access',
                    "{$currentUser->firstname} {$currentUser->lastname} attempted to view another enforcer's location",
                    Notification::TYPE_LOCATION_UNAUTHORIZED,
                    'user',
                    $currentUser->user_id
                );
            } catch (\Throwable $ne) {
                Log::warning('Unauthorized access notification failed: ' . $ne->getMessage());
            }
        }

        return response()->json($location);
    }

    public function getAllActive()
    {
        return response()->json(
            EnforcerLocation::with('enforcer')
                ->where('is_online', true)
                ->where('last_updated', '>=', now()->subMinutes(2))
                ->get()
                ->map(function ($loc) {
                    return [
                        'enforcer_id'    => $loc->enforcer_id,
                        'firstname'      => $loc->enforcer?->firstname,
                        'lastname'       => $loc->enforcer?->lastname,
                        'role'           => $loc->enforcer?->role,
                        'email'          => $loc->enforcer?->email,
                        'contact_number' => $loc->enforcer?->contact_number,
                        'latitude'       => $loc->latitude,
                        'longitude'      => $loc->longitude,
                        'accuracy'       => $loc->accuracy,
                        'speed'          => $loc->speed,
                        'is_online'      => $loc->is_online,
                        'last_updated'   => $loc->last_updated,
                    ];
                })
        );
    }
}