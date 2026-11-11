<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\ViolationType;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ViolationController extends Controller
{
    public function index(Request $request)
    {
        $visibility = $request->get('visibility', 'active');

        $query = ViolationType::query();
        if ($visibility === 'archived') {
            $query->archived();
        } elseif ($visibility !== 'all') {
            $query->active();
        }

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('violation_code', 'like', "%{$s}%")
                    ->orWhere('violation_name', 'like', "%{$s}%")
                    ->orWhere('category', 'like', "%{$s}%");
            });
        }

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        if ($request->boolean('all')) {
            return response()->json(
                $query->orderBy('violation_name')->get()
            );
        }

        $perPage = (int) $request->get('per_page', 20);
        $page    = (int) $request->get('page', 1);

        $violations = $query->orderBy('violation_name')
            ->paginate($perPage, ['*'], 'page', $page);

        return response()->json($violations);
    }

    public function show($id)
    {
        return response()->json(ViolationType::with('archivedBy')->findOrFail($id));
    }

    public function store(Request $request)
    {
        $request->validate([
            'violation_name' => 'required|string|unique:violation_types,violation_name',
            'fine_amount' => 'required|numeric|min:0',
        ]);

        $violation = ViolationType::create($request->all());

        return response()->json([
            'message' => 'Violation created successfully',
            'violation' => $violation,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $violation = ViolationType::findOrFail($id);

        $request->validate([
            'violation_name' => 'sometimes|string|unique:violation_types,violation_name,' . $id . ',violation_id',
            'fine_amount' => 'sometimes|numeric|min:0',
        ]);

        $violation->update($request->all());

        return response()->json([
            'message' => 'Violation updated successfully',
            'violation' => $violation,
        ]);
    }

    /* ---------------- ARCHIVE ---------------- */

    public function destroy(Request $request, $id)
    {
        $violation = ViolationType::findOrFail($id);

        if ($violation->is_archived) {
            return response()->json(['message' => 'Violation is already archived.'], 400);
        }

        try {
            $violation->archive($request->user()->user_id);

            try {
                $actor = $request->user();
                $actorName = trim("{$actor->firstname} {$actor->lastname}");
                NotificationService::notifyAdmins(
                    'Violation Archived',
                    "{$actorName} archived violation {$violation->violation_name}",
                    Notification::TYPE_VIOLATION_ARCHIVED,
                    'violation',
                    $violation->violation_id
                );
            } catch (\Throwable $ne) {
                Log::warning('Violation archive notification failed: ' . $ne->getMessage());
            }

            return response()->json([
                'message' => 'Violation archived successfully',
                'archived' => true,
                'violation' => $violation->fresh(),
            ]);
        } catch (\Throwable $e) {
            Log::error('Violation archive failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to archive violation'], 500);
        }
    }
}
