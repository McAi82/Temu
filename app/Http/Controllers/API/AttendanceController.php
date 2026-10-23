<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\EnforcerAttendance;
use App\Models\Notification;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AttendanceController extends Controller
{
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

            // UUID prevents filename collisions on rapid retries.
            $fileName = 'attendance/time_in/'
                . $enforcerId . '_' . $today . '_' . Str::uuid() . '.' . $extension;

            Storage::disk('public')->put($fileName, base64_decode($imageData));
            $photoPath = $fileName;
        }

        // Late-minutes calculation uses the configured APP_TIMEZONE.
        $startTime = now()->setTime(8, 0, 0);
        $lateMinutes = $now->gt($startTime) ? $startTime->diffInMinutes($now) : 0;
        $status = $lateMinutes > 15 ? 'late' : 'present';

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
        $endTime = now()->setTime(17, 0, 0);
        $overtimeMinutes = $now->gt($endTime) ? $endTime->diffInMinutes($now) : 0;

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