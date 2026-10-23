<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Vehicle;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class VehicleController extends Controller
{
    public function index(Request $request)
    {
        $visibility = $request->get('visibility', 'active');

        $base = Vehicle::query();
        if ($visibility === 'archived') {
            $base->archived();
        } elseif ($visibility !== 'all') {
            $base->active();
        }

        if ($request->filled('search')) {
            $s = $request->search;
            $base->where(function ($q) use ($s) {
                $q->where('platenumber', 'like', "%{$s}%")
                    ->orWhere('owner', 'like', "%{$s}%")
                    ->orWhere('make', 'like', "%{$s}%")
                    ->orWhere('model', 'like', "%{$s}%");
            });
        }

        if ($request->filled('make')) {
            $base->where('make', 'like', '%' . $request->make . '%');
        }
        if ($request->filled('color')) {
            $base->where('color', 'like', '%' . $request->color . '%');
        }

        if ($request->filled('registration_from')) {
            $base->whereDate('registration_expiry', '>=', $request->registration_from);
        }
        if ($request->filled('registration_to')) {
            $base->whereDate('registration_expiry', '<=', $request->registration_to);
        }

        if ($request->filled('created_from')) {
            $base->whereDate('created_at', '>=', $request->created_from);
        }
        if ($request->filled('created_to')) {
            $base->whereDate('created_at', '<=', $request->created_to);
        }

        if ($request->boolean('all')) {
            return response()->json(
                $base->orderBy('created_at', 'desc')->get()
            );
        }

        $perPage = (int) $request->get('per_page', 20);
        $page    = (int) $request->get('page', 1);

        $vehicles = $base->orderBy('created_at', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);

        return response()->json($vehicles);
    }

    public function show($id)
    {
        return response()->json(Vehicle::with('archivedBy')->findOrFail($id));
    }

    public function store(Request $request)
    {
        $request->validate([
            'platenumber' => 'required|string',
            'owner' => 'required|string|max:100',
        ]);

        $existing = Vehicle::where('platenumber', $request->platenumber)->first();
        if ($existing) {
            return response()->json([
                'message' => $existing->is_archived
                    ? 'This plate belongs to an archived vehicle. Restore it to reuse.'
                    : 'Vehicle already exists',
                'vehicle' => $existing,
                'is_archived' => $existing->is_archived,
                'idempotent_replay' => !$existing->is_archived,
            ], 200);
        }

        $vehicle = Vehicle::create($request->all());

        try {
            NotificationService::notifyAdmins(
                'New Vehicle Registered',
                "{$vehicle->platenumber} owned by {$vehicle->owner} was added",
                Notification::TYPE_VEHICLE_CREATED,
                'vehicle',
                $vehicle->vehicle_id
            );
        } catch (\Throwable $ne) {
            Log::warning('Vehicle creation notification failed: ' . $ne->getMessage());
        }

        return response()->json([
            'message' => 'Vehicle created successfully',
            'vehicle' => $vehicle,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $vehicle = Vehicle::findOrFail($id);

        $request->validate([
            'platenumber' => 'sometimes|string|unique:vehicles,platenumber,' . $id . ',vehicle_id',
        ]);

        $vehicle->update($request->all());

        return response()->json([
            'message' => 'Vehicle updated successfully',
            'vehicle' => $vehicle
        ]);
    }

    /* ---------------- ARCHIVE ---------------- */

    public function destroy(Request $request, $id)
    {
        $vehicle = Vehicle::findOrFail($id);

        if ($vehicle->is_archived) {
            return response()->json(['message' => 'Vehicle is already archived.'], 400);
        }

        try {
            $vehicle->archive($request->user()->user_id);

            try {
                $actor = $request->user();
                $actorName = trim("{$actor->firstname} {$actor->lastname}");
                NotificationService::notifyAdmins(
                    'Vehicle Archived',
                    "{$actorName} archived vehicle {$vehicle->platenumber}",
                    Notification::TYPE_VEHICLE_ARCHIVED,
                    'vehicle',
                    $vehicle->vehicle_id
                );
            } catch (\Throwable $ne) {
                Log::warning('Vehicle archive notification failed: ' . $ne->getMessage());
            }

            return response()->json([
                'message' => 'Vehicle archived successfully',
                'archived' => true,
                'vehicle' => $vehicle->fresh(),
            ]);
        } catch (\Throwable $e) {
            Log::error('Vehicle archive failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to archive vehicle'], 500);
        }
    }

    public function searchByPlate($plate)
    {
        $vehicle = Vehicle::where('platenumber', 'like', "%{$plate}%")->active()->get();
        return response()->json($vehicle);
    }
}
