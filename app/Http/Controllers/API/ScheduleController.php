<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\EnforcerSchedule;
use App\Models\Notification;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use App\Models\User;

class ScheduleController extends Controller
{
    /* ==================================================================
     |  LIST
     ================================================================== */

    public function index(Request $request)
    {
        $perPage = (int) $request->get('per_page', 20);
        $date = $request->get('date');
        $startDate = $request->get('start_date');
        $endDate = $request->get('end_date');

        $query = EnforcerSchedule::with(['enforcer', 'dutyLocation']);

        $visibility = $request->get('visibility', 'active');
        if ($visibility === 'archived') {
            $query->archived();
        } elseif ($visibility !== 'all') {
            $query->active();
        }

        if ($date && !$startDate && !$endDate) {
            $query->whereDate('schedule_date', $date);
        } elseif ($startDate && $endDate) {
            $query->whereBetween('schedule_date', [$startDate, $endDate]);
        } elseif (!$date && !$startDate && !$endDate) {
            $query->whereDate('schedule_date', now()->toDateString());
        }

        if ($request->filled('enforcer_id')) {
            $query->where('enforcer_id', $request->enforcer_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('duties', 'like', "%{$search}%")
                    ->orWhere('notes', 'like', "%{$search}%")
                    ->orWhereHas('enforcer', function ($eq) use ($search) {
                        $eq->where('firstname', 'like', "%{$search}%")
                            ->orWhere('lastname', 'like', "%{$search}%");
                    })
                    ->orWhereHas('dutyLocation', function ($lq) use ($search) {
                        $lq->where('name', 'like', "%{$search}%");
                    });
            });
        }

        $schedules = $query
            ->orderBy('schedule_date', 'asc')
            ->orderBy('start_time', 'asc')
            ->paginate($perPage);

        return response()->json($schedules);
    }

    /* ==================================================================
     |  STORE
     ================================================================== */

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'enforcer_id' => 'required|exists:users,user_id',
            'duty_location_id' => 'nullable|exists:duty_locations,id',
            'schedule_date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'shift_type' => 'nullable|string|in:morning,afternoon,night,full',
            'duties' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $startDt = $request->schedule_date . ' ' . $request->start_time . ':00';
        $endDt = $request->schedule_date . ' ' . $request->end_time . ':00';

        $conflict = EnforcerSchedule::where('enforcer_id', $request->enforcer_id)
            ->whereDate('schedule_date', $request->schedule_date)
            ->where('start_time', '<', $endDt)
            ->where('end_time', '>', $startDt)
            ->active()
            ->exists();

        if ($conflict) {
            try {
                NotificationService::notifyUser(
                    $request->user()->user_id,
                    'Schedule Conflict',
                    "The schedule for {$request->schedule_date} at {$request->start_time} conflicts with an existing shift",
                    Notification::TYPE_SCHEDULE_CONFLICT
                );
            } catch (\Throwable $ne) {
                Log::warning('Schedule conflict notification failed: ' . $ne->getMessage());
            }

            return response()->json([
                'message' => 'Schedule conflict detected for this enforcer at the same time'
            ], 422);
        }

        $schedule = EnforcerSchedule::create([
            'enforcer_id' => $request->enforcer_id,
            'duty_location_id' => $request->duty_location_id,
            'schedule_date' => $request->schedule_date,
            'start_time' => $startDt,
            'end_time' => $endDt,
            'shift_type' => $request->shift_type,
            'duties' => $request->duties,
            'status' => 'scheduled',
            'notes' => $request->notes,
        ]);

        try {
            $dateStr = \Carbon\Carbon::parse($schedule->schedule_date)->format('M d, Y');
            $start = \Carbon\Carbon::parse($schedule->start_time)->format('h:i A');
            $end = \Carbon\Carbon::parse($schedule->end_time)->format('h:i A');

            NotificationService::notifyUser(
                $schedule->enforcer_id,
                'New Schedule Assigned',
                "You have a new shift on {$dateStr} from {$start} to {$end}",
                Notification::TYPE_SCHEDULE_ASSIGNED,
                'schedule',
                $schedule->schedule_id
            );
        } catch (\Throwable $ne) {
            Log::warning('Schedule assigned notification failed: ' . $ne->getMessage());
        }

        return response()->json([
            'message' => 'Schedule created successfully',
            'data' => $schedule->load(['enforcer', 'dutyLocation']),
        ], 201);
    }

    public function show($id)
    {
        return response()->json(
            EnforcerSchedule::with(['enforcer', 'dutyLocation', 'archivedBy'])->findOrFail($id)
        );
    }

    /* ==================================================================
     |  UPDATE
     ================================================================== */

    public function update(Request $request, $id)
    {
        $schedule = EnforcerSchedule::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'enforcer_id' => 'sometimes|exists:users,user_id',
            'duty_location_id' => 'nullable|exists:duty_locations,id',
            'schedule_date' => 'sometimes|date',
            'start_time' => 'sometimes|date_format:H:i',
            'end_time' => 'sometimes|date_format:H:i|after:start_time',
            'shift_type' => 'nullable|string|in:morning,afternoon,night,full',
            'duties' => 'nullable|string',
            'status' => 'nullable|in:scheduled,in_progress,completed,cancelled',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = $request->all();

        $dateForBuild = $request->schedule_date
            ?? optional($schedule->schedule_date)->format('Y-m-d');
        if ($request->has('start_time')) {
            $data['start_time'] = $dateForBuild . ' ' . $request->start_time . ':00';
        }
        if ($request->has('end_time')) {
            $data['end_time'] = $dateForBuild . ' ' . $request->end_time . ':00';
        }
        if ($request->has('schedule_date') && !$request->has('start_time') && !$request->has('end_time')) {
            $data['start_time'] = $dateForBuild . ' ' . $schedule->start_time->format('H:i') . ':00';
            $data['end_time'] = $dateForBuild . ' ' . $schedule->end_time->format('H:i') . ':00';
        }

        $schedule->update($data);

        try {
            NotificationService::notifyUser(
                $schedule->enforcer_id,
                'Schedule Updated',
                'Your shift schedule has been updated',
                Notification::TYPE_SCHEDULE_UPDATED,
                'schedule',
                $schedule->schedule_id
            );
        } catch (\Throwable $ne) {
            Log::warning('Schedule update notification failed: ' . $ne->getMessage());
        }

        return response()->json([
            'message' => 'Schedule updated successfully',
            'data' => $schedule->load(['enforcer', 'dutyLocation']),
        ]);
    }

    /* ==================================================================
     |  ARCHIVE (replaces destroy)
     ================================================================== */

    public function destroy(Request $request, $id)
    {
        $schedule = EnforcerSchedule::findOrFail($id);

        if ($schedule->is_archived) {
            return response()->json(['message' => 'Schedule is already archived.'], 400);
        }

        try {
            $enforcerId = $schedule->enforcer_id;
            $scheduleId = $schedule->schedule_id;

            $schedule->archive($request->user()->user_id);

            try {
                NotificationService::notifyUser(
                    $enforcerId,
                    'Schedule Archived',
                    'One of your shifts has been archived',
                    Notification::TYPE_SCHEDULE_ARCHIVED,
                    'schedule',
                    $scheduleId
                );
            } catch (\Throwable $ne) {
                Log::warning('Schedule archive notification failed: ' . $ne->getMessage());
            }

            return response()->json([
                'message' => 'Schedule archived successfully',
                'archived' => true,
            ]);
        } catch (\Throwable $e) {
            Log::error('Schedule archive failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to archive schedule'], 500);
        }
    }

    /* ==================================================================
     |  OTHER LISTS
     ================================================================== */

    public function getEnforcerSchedules(Request $request, $enforcerId)
    {
        $startDate = $request->get('start_date', now()->startOfWeek()->toDateString());
        $endDate = $request->get('end_date', now()->endOfWeek()->toDateString());
        $dateFilter = $request->get('date');

        $query = EnforcerSchedule::with(['enforcer', 'dutyLocation'])
            ->where('enforcer_id', $enforcerId)
            ->active();

        if ($dateFilter) {
            $query->whereDate('schedule_date', $dateFilter);
        } else {
            $query->whereBetween('schedule_date', [$startDate, $endDate]);
        }

        return response()->json(
            $query->orderBy('schedule_date')->orderBy('start_time')->get()
        );
    }

    public function getTodaySchedules(Request $request)
    {
        return response()->json(
            EnforcerSchedule::with(['enforcer', 'dutyLocation'])
                ->today()
                ->active()
                ->orderBy('start_time')
                ->get()
        );
    }

    public function getWeeklySchedules(Request $request)
    {
        $startDate = $request->get('start_date', now()->startOfWeek()->toDateString());
        $endDate = $request->get('end_date', now()->endOfWeek()->toDateString());

        return response()->json(
            EnforcerSchedule::with(['enforcer', 'dutyLocation'])
                ->whereBetween('schedule_date', [$startDate, $endDate])
                ->active()
                ->orderBy('schedule_date')
                ->orderBy('start_time')
                ->get()
                ->groupBy('schedule_date')
        );
    }

    public function updateStatus(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:scheduled,in_progress,completed,cancelled',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $schedule = EnforcerSchedule::findOrFail($id);
        $schedule->update(['status' => $request->status]);

        if ($request->status === 'cancelled') {
            try {
                NotificationService::notifyUser(
                    $schedule->enforcer_id,
                    'Schedule Cancelled',
                    'Your shift has been cancelled',
                    Notification::TYPE_SCHEDULE_CANCELLED,
                    'schedule',
                    $schedule->schedule_id
                );
            } catch (\Throwable $ne) {
                Log::warning('Status change notification failed: ' . $ne->getMessage());
            }
        }

        return response()->json([
            'message' => 'Schedule status updated successfully',
            'data' => $schedule,
        ]);
    }

    /* ==================================================================
     |  AVAILABLE ENFORCERS
     ================================================================== */

    public function availableEnforcers(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'date'       => 'required|date',
            'exclude_id' => 'nullable|integer|exists:enforcer_schedules,schedule_id',
            'search'     => 'nullable|string|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $date      = $request->date;
        $excludeId = $request->exclude_id;

        $bookedIds = EnforcerSchedule::whereDate('schedule_date', $date)
            ->active()
            ->when($excludeId, fn($q) => $q->where('schedule_id', '!=', $excludeId))
            ->pluck('enforcer_id')
            ->unique()
            ->values()
            ->toArray();

        $query = User::where('role', 'enforcer')
            ->where('is_active', true)
            ->where('is_archived', false)
            ->whereNotIn('user_id', $bookedIds);

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('firstname', 'like', "%{$s}%")
                    ->orWhere('lastname', 'like', "%{$s}%")
                    ->orWhere('email', 'like', "%{$s}%");
            });
        }

        $enforcers = $query->orderBy('firstname')
            ->orderBy('lastname')
            ->get()
            ->map(fn($u) => [
                'user_id'        => $u->user_id,
                'firstname'      => $u->firstname,
                'lastname'       => $u->lastname,
                'email'          => $u->email,
                'contact_number' => $u->contact_number,
                'full_name'      => trim("{$u->firstname} {$u->lastname}"),
            ]);

        return response()->json([
            'date'      => $date,
            'booked'    => count($bookedIds),
            'available' => $enforcers,
            'count'     => $enforcers->count(),
        ]);
    }

    /* ==================================================================
     |  REPLACE ENFORCER
     ================================================================== */

    public function replaceEnforcer(Request $request, $id)
    {
        $schedule = EnforcerSchedule::with(['enforcer', 'dutyLocation'])
            ->findOrFail($id);

        $validator = Validator::make($request->all(), [
            'enforcer_id' => 'required|exists:users,user_id',
            'reason'      => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $newEnforcer = User::where('user_id', $request->enforcer_id)
            ->where('role', 'enforcer')
            ->where('is_active', true)
            ->where('is_archived', false)
            ->first();

        if (!$newEnforcer) {
            return response()->json([
                'message' => 'Selected user is not an active enforcer.',
            ], 422);
        }

        if ($newEnforcer->user_id === $schedule->enforcer_id) {
            return response()->json([
                'message' => 'That enforcer is already assigned to this schedule.',
            ], 422);
        }

        $conflict = EnforcerSchedule::where('enforcer_id', $newEnforcer->user_id)
            ->whereDate('schedule_date', $schedule->schedule_date)
            ->where('schedule_id', '!=', $schedule->schedule_id)
            ->active()
            ->exists();

        if ($conflict) {
            return response()->json([
                'message' => 'The selected enforcer already has a schedule on this date.',
            ], 422);
        }

        $oldEnforcerId   = $schedule->enforcer_id;
        $oldEnforcerName = $schedule->enforcer
            ? trim("{$schedule->enforcer->firstname} {$schedule->enforcer->lastname}")
            : 'Unknown';

        $schedule->enforcer_id = $newEnforcer->user_id;
        $schedule->save();
        $schedule->load(['enforcer', 'dutyLocation']);

        try {
            $dateStr = \Carbon\Carbon::parse($schedule->schedule_date)->format('M d, Y');
            $start   = \Carbon\Carbon::parse($schedule->start_time)->format('h:i A');
            $end     = \Carbon\Carbon::parse($schedule->end_time)->format('h:i A');
            $admin   = $request->user();
            $adminName = trim("{$admin->firstname} {$admin->lastname}");
            $newName   = trim("{$newEnforcer->firstname} {$newEnforcer->lastname}");
            $reason    = $request->reason;

            NotificationService::notifyUser(
                $newEnforcer->user_id,
                'Schedule Assigned (Replacement)',
                "You have been assigned to cover {$oldEnforcerName}'s shift on {$dateStr} from {$start} to {$end}."
                    . ($reason ? " Reason: {$reason}" : ''),
                Notification::TYPE_SCHEDULE_ASSIGNED,
                'schedule',
                $schedule->schedule_id
            );

            NotificationService::notifyUser(
                $oldEnforcerId,
                'Schedule Reassigned',
                "Your shift on {$dateStr} ({$start}–{$end}) has been reassigned to {$newName}."
                    . ($reason ? " Reason: {$reason}" : ''),
                Notification::TYPE_SCHEDULE_UPDATED,
                'schedule',
                $schedule->schedule_id
            );

            NotificationService::notifyAdmins(
                'Enforcer Replaced',
                "{$adminName} replaced {$oldEnforcerName} with {$newName} on {$dateStr}.",
                Notification::TYPE_SCHEDULE_UPDATED,
                'schedule',
                $schedule->schedule_id
            );
        } catch (\Throwable $ne) {
            Log::warning('Replace enforcer notification failed: ' . $ne->getMessage());
        }

        return response()->json([
            'message'  => 'Enforcer replaced successfully',
            'data'     => $schedule,
            'replaced' => [
                'from' => [
                    'user_id'   => $oldEnforcerId,
                    'full_name' => $oldEnforcerName,
                ],
                'to' => [
                    'user_id'   => $newEnforcer->user_id,
                    'full_name' => trim("{$newEnforcer->firstname} {$newEnforcer->lastname}"),
                ],
            ],
        ]);
    }
}
