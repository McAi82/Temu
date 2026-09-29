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
    public function index(Request $request)
    {
        $perPage = $request->get('per_page', 20);
        $query = DutyLocation::with('enforcer');

        if ($request->filled('enforcer_id')) $query->where('enforcer_id', $request->enforcer_id);
        if ($request->has('is_active')) $query->where('is_active', $request->is_active);
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

            // =============== NOTIFICATION: New Duty Location ===============
            try {
                $enforcerIds = User::where('role', 'enforcer')
                    ->where('is_active', true)
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
        return response()->json(DutyLocation::with('enforcer')->findOrFail($id));
    }

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

            // =============== NOTIFICATION: Duty Location Updated ===============
            try {
                // Notify enforcers assigned to this location
                $enforcerIds = User::where('role', 'enforcer')
                    ->where('is_active', true)
                    ->where(function ($q) use ($location) {
                        $q->where('user_id', $location->enforcer_id)
                          ->orWhereHas('tickets'); // fallback - if none specific, broadcast to all
                    })
                    ->pluck('user_id')
                    ->toArray();

                if (empty($enforcerIds)) {
                    // Fallback: broadcast to all enforcers
                    $enforcerIds = User::where('role', 'enforcer')
                        ->where('is_active', true)
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

    public function destroy($id)
    {
        try {
            $location = DutyLocation::findOrFail($id);
            $name = $location->name;
            $locationId = $location->id;

            $location->delete();

            // =============== NOTIFICATION: Duty Location Removed ===============
            try {
                $enforcerIds = User::where('role', 'enforcer')
                    ->where('is_active', true)
                    ->pluck('user_id')
                    ->toArray();

                NotificationService::notifyUsers(
                    $enforcerIds,
                    'Duty Location Removed',
                    "Duty location \"{$name}\" has been removed",
                    Notification::TYPE_DUTY_LOCATION_REMOVED,
                    'duty_location',
                    $locationId
                );
            } catch (\Throwable $ne) {
                Log::warning('Duty location delete notification failed: ' . $ne->getMessage());
            }

            return response()->json(['message' => 'Duty location deleted successfully']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to delete duty location: ' . $e->getMessage()], 500);
        }
    }

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
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($locations);
    }
}