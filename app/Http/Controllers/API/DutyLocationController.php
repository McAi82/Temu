<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\DutyLocation;
use App\Models\Notification;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class DutyLocationController extends Controller
{
    /* ==================================================================
     |  LIST
     ================================================================== */

    public function index(Request $request)
    {
        $perPage = (int) $request->get('per_page', 20);

        $query = DutyLocation::with('enforcer');

        $visibility = $request->get('visibility', 'active');
        if ($visibility === 'archived') {
            $query->archived();
        } elseif ($visibility !== 'all') {
            $query->where('is_archived', false);
        }

        if ($request->filled('enforcer_id')) $query->where('enforcer_id', $request->enforcer_id);
        if ($request->has('is_active') && $visibility === 'active') {
            $query->where('is_active', $request->is_active);
        }
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('address', 'like', "%{$search}%");
            });
        }

        $locations = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json([
            'data' => $locations->items(),
            'meta' => [
                'current_page' => $locations->currentPage(),
                'last_page' => $locations->lastPage(),
                'per_page' => $locations->perPage(),
                'total' => $locations->total(),
            ],
        ]);
    }

    /* ==================================================================
     |  STORE
     ================================================================== */

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'address' => 'nullable|string',
            'enforcer_id' => 'nullable|exists:users,user_id',
            'schedule' => 'nullable|string|max:255',
            'radius' => 'nullable|integer|min:0|max:10000',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors(), 'message' => 'Validation failed'], 422);
        }

        try {
            $location = DutyLocation::create([
                'name' => $request->name,
                'address' => $request->address,
                'latitude' => $request->latitude,
                'longitude' => $request->longitude,
                'enforcer_id' => $request->enforcer_id,
                'schedule' => $request->schedule,
                'radius' => $request->radius ?? 100,
                'is_active' => true,
            ]);

            try {
                $enforcerIds = User::where('role', 'enforcer')
                    ->where('is_active', true)
                    ->where('is_archived', false)
                    ->pluck('user_id')
                    ->toArray();

                NotificationService::notifyUsers(
                    $enforcerIds,
                    'New Duty Location Added',
                    "A new duty location is available: {$location->name}",
                    Notification::TYPE_DUTY_LOCATION_ADDED,
                    'duty_location',
                    $location->id
                );
            } catch (\Throwable $ne) {
                Log::warning('Duty location add notification failed: ' . $ne->getMessage());
            }

            return response()->json([
                'message' => 'Duty location created successfully',
                'data' => $location->load('enforcer')
            ], 201);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to create duty location: ' . $e->getMessage()], 500);
        }
    }

    public function show($id)
    {
        return response()->json(DutyLocation::with(['enforcer', 'archivedBy'])->findOrFail($id));
    }

    /* ==================================================================
     |  UPDATE
     ================================================================== */

    public function update(Request $request, $id)
    {
        $location = DutyLocation::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'latitude' => 'sometimes|numeric|between:-90,90',
            'longitude' => 'sometimes|numeric|between:-180,180',
            'address' => 'nullable|string',
            'enforcer_id' => 'nullable|exists:users,user_id',
            'schedule' => 'nullable|string|max:255',
            'radius' => 'nullable|integer|min:0|max:10000',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors(), 'message' => 'Validation failed'], 422);
        }

        try {
            $location->update($request->all());

            try {
                $enforcerIds = User::where('role', 'enforcer')
                    ->where('is_active', true)
                    ->where('is_archived', false)
                    ->where(function ($q) use ($location) {
                        $q->where('user_id', $location->enforcer_id)
                            ->orWhereHas('tickets');
                    })
                    ->pluck('user_id')
                    ->toArray();

                if (empty($enforcerIds)) {
                    $enforcerIds = User::where('role', 'enforcer')
                        ->where('is_active', true)
                        ->where('is_archived', false)
                        ->pluck('user_id')
                        ->toArray();
                }

                NotificationService::notifyUsers(
                    $enforcerIds,
                    'Duty Location Updated',
                    "Duty location \"{$location->name}\" has been updated",
                    Notification::TYPE_DUTY_LOCATION_UPDATED,
                    'duty_location',
                    $location->id
                );
            } catch (\Throwable $ne) {
                Log::warning('Duty location update notification failed: ' . $ne->getMessage());
            }

            return response()->json([
                'message' => 'Duty location updated successfully',
                'data' => $location->fresh('enforcer')
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to update duty location: ' . $e->getMessage()], 500);
        }
    }

    /* ==================================================================
     |  ARCHIVE (replaces destroy)
     ================================================================== */

    public function destroy(Request $request, $id)
    {
        try {
            $location = DutyLocation::findOrFail($id);

            if ($location->is_archived) {
                return response()->json(['message' => 'Duty location is already archived.'], 400);
            }

            $name = $location->name;
            $locationId = $location->id;

            $location->archive($request->user()->user_id);

            try {
                $enforcerIds = User::where('role', 'enforcer')
                    ->where('is_active', true)
                    ->where('is_archived', false)
                    ->pluck('user_id')
                    ->toArray();

                NotificationService::notifyUsers(
                    $enforcerIds,
                    'Duty Location Archived',
                    "Duty location \"{$name}\" has been archived",
                    Notification::TYPE_DUTY_LOCATION_ARCHIVED,
                    'duty_location',
                    $locationId
                );
            } catch (\Throwable $ne) {
                Log::warning('Duty location archive notification failed: ' . $ne->getMessage());
            }

            return response()->json([
                'message' => 'Duty location archived successfully',
                'archived' => true,
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to archive duty location: ' . $e->getMessage()], 500);
        }
    }

    /* ==================================================================
     |  NEARBY / ENFORCER DUTIES
     ================================================================== */

    public function getNearby(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'radius' => 'nullable|numeric|min:0|max:10000',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors(), 'message' => 'Validation failed'], 422);
        }

        $locations = DutyLocation::getNearby(
            $request->latitude,
            $request->longitude,
            $request->radius ?? 1000
        );

        return response()->json($locations);
    }

    public function getEnforcerDuties(Request $request, $enforcerId)
    {
        $locations = DutyLocation::with('enforcer')
            ->where('enforcer_id', $enforcerId)
            ->where('is_active', true)
            ->where('is_archived', false)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($locations);
    }
}
