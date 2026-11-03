<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\EnforcerAttendance;
use App\Models\EnforcerSchedule;
use App\Models\Notification;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AttendanceController extends Controller
{
    /* ------------------------------------------------------------------
     | Time window rules
     |------------------------------------------------------------------
     | These are how far outside the scheduled shift the enforcer is
     | allowed to punch. Inside this window = "on time". Outside = reject.
     |----------------------------------------------------------------*/

    /** Minutes before start_time that count as "on time" (early arrival). */
    private const TIME_IN_EARLY_GRACE_MINUTES = 30;

    /** Minutes after end_time that still allow a time-out. */
    private const TIME_OUT_LATE_GRACE_MINUTES = 120;

    /* ==================================================================
     |  LIST / READ
     ================================================================== */

    public function index(Request $request)
    {
        $perPage = $request->get('per_page', 20);
        $page = $request->get('page', 1);

        $query = EnforcerAttendance::with('enforcer');

        if ($request->filled('date_from')) {
            $query->whereDate('date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('date', '<=', $request->date_to);
        }
        if ($request->filled('enforcer_id')) {
            $query->where('enforcer_id', $request->enforcer_id);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $attendances = $query->orderBy('date', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);

        return response()->json($attendances);
    }

    public function show($id)
    {
        return response()->json(
            EnforcerAttendance::with('enforcer')->findOrFail($id)
        );
    }

    public function getMyAttendance(Request $request)
    {
        $enforcerId = $request->user()->user_id;
        return response()->json(
            EnforcerAttendance::where('enforcer_id', $enforcerId)
                ->orderBy('date', 'desc')->get()
        );
    }

    public function getMyAttendanceHistory(Request $request)
    {
        return $this->getMyAttendance($request);
    }

    public function getByEnforcer(Request $request, $enforcerId)
    {
        $query = EnforcerAttendance::with('enforcer')
            ->where('enforcer_id', $enforcerId);

        if ($request->filled('month') && $request->filled('year')) {
            $query->whereYear('date', $request->year)
                ->whereMonth('date', $request->month);
        }

        return response()->json($query->orderBy('date', 'desc')->get());
    }

    public function getTodayAttendance(Request $request)
    {
        $enforcerId = $request->user()->user_id;
        $today = now()->toDateString();

        $attendance = EnforcerAttendance::where('enforcer_id', $enforcerId)
            ->where('date', $today)->first();

        if ($attendance) {
            if ($attendance->time_in_photo) {
                $attendance->time_in_photo_url = Storage::url($attendance->time_in_photo);
            }
            if ($attendance->time_out_photo) {
                $attendance->time_out_photo_url = Storage::url($attendance->time_out_photo);
            }
        }

        return response()->json($attendance);
    }

    public function statistics(Request $request)
    {
        $query = EnforcerAttendance::query();
        $query->whereYear('date', $request->filled('year') ? $request->year : now()->year);
        if ($request->filled('date_from')) $query->whereDate('date', '>=', $request->date_from);
        if ($request->filled('date_to'))   $query->whereDate('date', '<=', $request->date_to);
        if ($request->filled('enforcer_id')) $query->where('enforcer_id', $request->enforcer_id);

        $totalDays = (clone $query)->count();
        $presentDays = (clone $query)->where('status', 'present')->count();
        $lateDays = (clone $query)->where('status', 'late')->count();
        $absentDays = (clone $query)->where('status', 'absent')->count();
        $onLeaveDays = (clone $query)->where('status', 'on_leave')->count();

        return response()->json([
            'total_days' => $totalDays,
            'present_days' => $presentDays,
            'late_days' => $lateDays,
            'absent_days' => $absentDays,
            'on_leave_days' => $onLeaveDays,
            'total_late_minutes' => (clone $query)->sum('late_minutes'),
            'total_overtime_minutes' => (clone $query)->sum('overtime_minutes'),
            'attendance_rate' => $totalDays > 0
                ? round(($presentDays / $totalDays) * 100, 2)
                : 0,
        ]);
    }

    /* ==================================================================
     |  SCHEDULE / GEOFENCE HELPERS
     ================================================================== */

    /**
     * Returns the schedule an enforcer has for today, or null.
     */
    private function todaysSchedule(int $enforcerId): ?EnforcerSchedule
    {
        return EnforcerSchedule::with('dutyLocation')
            ->where('enforcer_id', $enforcerId)
            ->whereDate('schedule_date', now()->toDateString())
            ->whereIn('status', ['scheduled', 'in_progress'])
            ->active()
            ->orderBy('start_time')
            ->first();
    }

    /**
     * Haversine distance in meters.
     */
    private function distanceMeters(
        float $lat1,
        float $lng1,
        float $lat2,
        float $lng2
    ): float {
        $earthRadius = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) ** 2 +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c;
    }

    /**
     * Validate the enforcer is:
     *   (a) scheduled today, and
     *   (b) within the duty location's radius.
     *
     * Returns null on success, or an array on failure.
     */
    private function checkGeofence(
        int $enforcerId,
        ?string $locationStr
    ): ?array {
        $schedule = $this->todaysSchedule($enforcerId);

        // ── RULE: attendance requires a schedule today ──
        if (!$schedule) {
            return [
                'message' => 'You have no schedule today. Only enforcers with a duty schedule can log attendance.',
                'code'    => 'NO_SCHEDULE_TODAY',
            ];
        }

        $loc = $schedule->dutyLocation;

        // No duty location set → can't geofence, allow.
        if (!$loc || $loc->latitude === null || $loc->longitude === null) {
            return null;
        }

        // No location from the app → can't verify, block.
        if (!$locationStr || !str_contains($locationStr, ',')) {
            return [
                'message' => 'Unable to verify your location. Please enable GPS and try again.',
                'code'    => 'LOCATION_MISSING',
            ];
        }

        [$lat, $lng] = array_pad(
            array_map('trim', explode(',', $locationStr, 2)),
            2,
            null,
        );

        if (!is_numeric($lat) || !is_numeric($lng)) {
            return [
                'message' => 'Invalid GPS coordinates. Please try again.',
                'code'    => 'LOCATION_INVALID',
            ];
        }

        $distance = $this->distanceMeters(
            (float) $loc->latitude,
            (float) $loc->longitude,
            (float) $lat,
            (float) $lng,
        );

        $radius = (int) ($loc->radius ?? 100);

        if ($distance > $radius) {
            return [
                'message' => sprintf(
                    'You are %.0f m away from %s. You must be within %d m to log attendance.',
                    $distance,
                    $loc->name ?: 'your duty location',
                    $radius,
                ),
                'code'     => 'OUT_OF_RANGE',
                'distance' => (int) round($distance),
                'radius'   => $radius,
                'location' => [
                    'latitude'  => (float) $loc->latitude,
                    'longitude' => (float) $loc->longitude,
                    'name'      => $loc->name,
                ],
            ];
        }

        return null;
    }

    /**
     * Validate "now" is within the allowed punch window for the given
     * schedule.
     *
     * @param  EnforcerSchedule  $schedule
     * @param  'in'|'out'        $kind
     * @return array|null        null on success, error payload on failure
     */
    private function checkTimeWindow(EnforcerSchedule $schedule, string $kind): ?array
    {
        $now = Carbon::now();

        $start = Carbon::parse($schedule->schedule_date->format('Y-m-d') . ' ' . $schedule->start_time->format('H:i:s'));
        $end = Carbon::parse($schedule->schedule_date->format('Y-m-d') . ' ' . $schedule->end_time->format('H:i:s'));

        if ($kind === 'in') {
            // Allowed window: [start - 30 min, end of day]
            // Once a shift has started (or it's the schedule day), we
            // allow time-in to stay open for the rest of the day, even
            // if the shift has technically ended. This is intentional:
            // enforcers who arrive late after an emergency can still log
            // their attendance and it will simply be marked "late".
            $earliest = $start->copy()->subMinutes(self::TIME_IN_EARLY_GRACE_MINUTES);

            if ($now->lt($earliest)) {
                $minutesUntil = (int) ceil($now->diffInMinutes($earliest, false));

                return [
                    'message' => sprintf(
                        'Too early to time in. Your shift starts at %s. You can time in from %s (30 minutes before).',
                        $start->format('h:i A'),
                        $earliest->format('h:i A'),
                    ),
                    'code'           => 'TIME_IN_TOO_EARLY',
                    'shift_start'    => $start->toIso8601String(),
                    'earliest_time'  => $earliest->toIso8601String(),
                    'minutes_until'  => $minutesUntil,
                ];
            }

            // No upper bound — timing in after the shift ends is
            // allowed and will be recorded as "late".
            return null;
        }

        // kind === 'out'
        // Allowed window: [start, end + 2h]
        $earliest = $start->copy();
        $latest   = $end->copy()->addMinutes(self::TIME_OUT_LATE_GRACE_MINUTES);

        if ($now->lt($earliest)) {
            return [
                'message' => sprintf(
                    'Cannot time out before your shift starts. Your shift starts at %s.',
                    $start->format('h:i A'),
                ),
                'code'        => 'TIME_OUT_BEFORE_SHIFT',
                'shift_start' => $start->toIso8601String(),
            ];
        }

        if ($now->gt($latest)) {
            return [
                'message' => sprintf(
                    'Too late to time out. Your shift ended at %s. Please contact your supervisor to correct this.',
                    $end->format('h:i A'),
                ),
                'code'          => 'TIME_OUT_TOO_LATE',
                'shift_end'     => $end->toIso8601String(),
                'latest_time'   => $latest->toIso8601String(),
            ];
        }

        return null;
    }

    /* ==================================================================
     |  TIME IN
     ================================================================== */

    public function timeIn(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'photo' => 'required|string',
            'location' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $enforcerId = $request->user()->user_id;

        // ── 1. SCHEDULE + GEOFENCE GATE ──
        $block = $this->checkGeofence($enforcerId, $request->location);
        if ($block) {
            return response()->json($block, 422);
        }

        // ── 2. TIME WINDOW GATE ──
        $schedule = $this->todaysSchedule($enforcerId);
        // checkGeofence guarantees $schedule is non-null here.
        $windowBlock = $this->checkTimeWindow($schedule, 'in');
        if ($windowBlock) {
            return response()->json($windowBlock, 422);
        }

        $today = now()->toDateString();
        $now = now();

        $existing = EnforcerAttendance::where('enforcer_id', $enforcerId)
            ->where('date', $today)->first();

        if ($existing && $existing->time_in) {
            return response()->json([
                'message' => 'Already timed in today',
                'attendance' => $existing,
                'already_timed_in' => true,
            ], 400);
        }

        $photoPath = null;
        if ($request->photo) {
            $imageData = $request->photo;
            $type = 'jpg';
            if (preg_match('/^data:image\/(\w+);base64,/', $imageData, $m)) {
                $imageData = substr($imageData, strpos($imageData, ',') + 1);
                $type = strtolower($m[1]);
            }
            $allowedTypes = ['jpg', 'jpeg', 'png', 'gif'];
            $extension = in_array($type, $allowedTypes) ? $type : 'jpg';

            $fileName = 'attendance/time_in/'
                . $enforcerId . '_' . $today . '_' . Str::uuid() . '.' . $extension;

            Storage::disk('public')->put($fileName, base64_decode($imageData));
            $photoPath = $fileName;
        }

        // Late-minutes computed against the SCHEDULE start, not the
        // hardcoded 8:00 AM. Uses a 15-minute grace period.
        $shiftStart = Carbon::parse(
            $schedule->schedule_date->format('Y-m-d') . ' ' .
            $schedule->start_time->format('H:i:s')
        );
        $graceEnd = $shiftStart->copy()->addMinutes(15);
        $lateMinutes = $now->gt($graceEnd) ? (int) $shiftStart->diffInMinutes($now) : 0;
        $status = $lateMinutes > 0 ? 'late' : 'present';

        $attendance = EnforcerAttendance::updateOrCreate(
            ['enforcer_id' => $enforcerId, 'date' => $today],
            [
                'time_in' => $now,
                'time_in_photo' => $photoPath,
                'time_in_location' => $request->location,
                'status' => $status,
                'late_minutes' => $lateMinutes,
            ]
        );

        if ($status === 'late') {
            try {
                $user = $request->user();
                $name = trim("{$user->firstname} {$user->lastname}");

                NotificationService::notifyUser(
                    $enforcerId,
                    'Late Time-In Recorded',
                    "You timed in {$lateMinutes} minutes late today ({$now->format('h:i A')})",
                    Notification::TYPE_ATTENDANCE_LATE,
                    'attendance',
                    $attendance->attendance_id
                );

                NotificationService::notifyAdminStaff(
                    'Late Time-In',
                    "{$name} timed in {$lateMinutes} minutes late ({$now->format('h:i A')})",
                    Notification::TYPE_ATTENDANCE_LATE,
                    'attendance',
                    $attendance->attendance_id
                );
            } catch (\Throwable $ne) {
                Log::warning('Late time-in notification failed: ' . $ne->getMessage());
            }
        }

        return response()->json([
            'message' => 'Time in recorded successfully',
            'attendance' => $attendance,
            'status' => $status,
            'late_minutes' => $lateMinutes,
        ]);
    }

    /* ==================================================================
     |  TIME OUT
     ================================================================== */

    public function timeOut(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'photo' => 'required|string',
            'location' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $enforcerId = $request->user()->user_id;

        // ── 1. SCHEDULE + GEOFENCE GATE ──
        $block = $this->checkGeofence($enforcerId, $request->location);
        if ($block) {
            return response()->json($block, 422);
        }

        // ── 2. TIME WINDOW GATE ──
        $schedule = $this->todaysSchedule($enforcerId);
        $windowBlock = $this->checkTimeWindow($schedule, 'out');
        if ($windowBlock) {
            return response()->json($windowBlock, 422);
        }

        $today = now()->toDateString();

        $attendance = EnforcerAttendance::where('enforcer_id', $enforcerId)
            ->where('date', $today)->first();

        if (!$attendance) {
            return response()->json([
                'message' => 'No time in record found for today. Please time in first.'
            ], 400);
        }

        if ($attendance->time_out) {
            return response()->json([
                'message' => 'Already timed out today',
                'attendance' => $attendance,
                'already_timed_out' => true,
            ], 400);
        }

        $photoPath = null;
        if ($request->photo) {
            $imageData = $request->photo;
            $type = 'jpg';
            if (preg_match('/^data:image\/(\w+);base64,/', $imageData, $m)) {
                $imageData = substr($imageData, strpos($imageData, ',') + 1);
                $type = strtolower($m[1]);
            }
            $allowedTypes = ['jpg', 'jpeg', 'png', 'gif'];
            $extension = in_array($type, $allowedTypes) ? $type : 'jpg';

            $fileName = 'attendance/time_out/'
                . $enforcerId . '_' . $today . '_' . Str::uuid() . '.' . $extension;

            Storage::disk('public')->put($fileName, base64_decode($imageData));
            $photoPath = $fileName;
        }

        $now = now();
        // Overtime computed against the SCHEDULE end.
        $shiftEnd = Carbon::parse(
            $schedule->schedule_date->format('Y-m-d') . ' ' .
            $schedule->end_time->format('H:i:s')
        );
        $overtimeMinutes = $now->gt($shiftEnd) ? (int) $shiftEnd->diffInMinutes($now) : 0;

        $attendance->update([
            'time_out' => $now,
            'time_out_photo' => $photoPath,
            'time_out_location' => $request->location,
            'overtime_minutes' => $overtimeMinutes,
        ]);

        if ($overtimeMinutes > 0) {
            try {
                $user = $request->user();
                $name = trim("{$user->firstname} {$user->lastname}");
                $hours = round($overtimeMinutes / 60, 2);

                NotificationService::notifyUser(
                    $enforcerId,
                    'Overtime Recorded',
                    "You logged {$overtimeMinutes} minutes ({$hours}h) of overtime today",
                    Notification::TYPE_ATTENDANCE_OVERTIME,
                    'attendance',
                    $attendance->attendance_id
                );

                NotificationService::notifyAdminStaff(
                    'Overtime Recorded',
                    "{$name} logged {$overtimeMinutes} minutes of overtime today",
                    Notification::TYPE_ATTENDANCE_OVERTIME,
                    'attendance',
                    $attendance->attendance_id
                );
            } catch (\Throwable $ne) {
                Log::warning('Overtime notification failed: ' . $ne->getMessage());
            }
        }

        return response()->json([
            'message' => 'Time out recorded successfully',
            'attendance' => $attendance,
            'overtime_minutes' => $overtimeMinutes,
        ]);
    }
}