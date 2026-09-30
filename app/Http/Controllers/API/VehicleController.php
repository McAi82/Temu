<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Vehicle;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class VehicleController extends Controller
{
    public function index(Request $request)
    {
        // Mobile prefetch: ?all=1 returns the full vehicle list uncapped.
        if ($request->boolean('all')) {
            return response()->json(
                Vehicle::orderBy('created_at', 'desc')->get()
            );
        }

        $perPage = $request->get('per_page', 20);
        $page = $request->get('page', 1);

        $vehicles = Vehicle::orderBy('created_at', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);

        return response()->json($vehicles);
    }

    public function show($id)
    {
        $vehicle = Vehicle::findOrFail($id);
        return response()->json($vehicle);
    }

    public function store(Request $request)
    {
        $request->validate([
            'platenumber' => 'required|string',
            'owner' => 'required|string|max:100',
        ]);

        // IDEMPOTENCY: return existing vehicle if plate already exists.
        $existing = Vehicle::where('platenumber', $request->platenumber)->first();
        if ($existing) {
            return response()->json([
                'message' => 'Vehicle already exists',
                'vehicle' => $existing,
                'idempotent_replay' => true,
            ], 200);
        }

        $vehicle = Vehicle::create($request->all());

        try {
            \App\Services\NotificationService::notifyAdmins(
                'New Vehicle Registered',
                "{$vehicle->platenumber} owned by {$vehicle->owner} was added",
                \App\Models\Notification::TYPE_VEHICLE_CREATED,
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

    public function destroy($id)
    {
        $vehicle = Vehicle::findOrFail($id);
        $vehicle->delete();

        return response()->json([
            'message' => 'Vehicle deleted successfully'
        ]);
    }

    public function searchByPlate($plate)
    {
        $vehicle = Vehicle::where('platenumber', 'like', "%{$plate}%")->get();
        return response()->json($vehicle);
    }
}
