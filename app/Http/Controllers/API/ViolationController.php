<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\ViolationType;
use Illuminate\Http\Request;

class ViolationController extends Controller
{
    public function index(Request $request)
    {
        // Mobile requests ?all=1 to load the full violation set into its
        // offline cache in a single call. Web dashboard gets paginated.
        if ($request->boolean('all')) {
            return response()->json(
                ViolationType::where('is_active', true)
                    ->orderBy('violation_name')
                    ->get()
            );
        }

        $perPage = $request->get('per_page', 20);
        $page = $request->get('page', 1);

        $violations = ViolationType::orderBy('violation_name')
            ->paginate($perPage, ['*'], 'page', $page);

        return response()->json($violations);
    }

    public function show($id)
    {
        $violation = ViolationType::findOrFail($id);
        return response()->json($violation);
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

    public function destroy($id)
    {
        $violation = ViolationType::findOrFail($id);
        $violation->delete();

        return response()->json([
            'message' => 'Violation deleted successfully',
        ]);
    }
}