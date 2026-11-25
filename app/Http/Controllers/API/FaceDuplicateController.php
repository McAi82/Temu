<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\FaceDuplicateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class FaceDuplicateController extends Controller
{
    /**
     * POST /api/faces/check-duplicate
     *  200 {duplicate:false}                      no close match
     *  200 {duplicate:false, review:true}         close match, logged for admin review
     *  409 {code:"FACE_DUPLICATE", matched:{...}} blocked
     */
    public function check(Request $request, FaceDuplicateService $service): JsonResponse
    {
        $data = $request->validate([
            'front_encoding'   => 'required|array|size:192',
            'front_encoding.*' => 'numeric',
            'left_encoding'    => 'required|array|size:192',
            'left_encoding.*'  => 'numeric',
            'right_encoding'   => 'required|array|size:192',
            'right_encoding.*' => 'numeric',
            'device_id'        => 'nullable|string|max:255',
        ]);

        $user = $request->user();

        $match = $service->findDuplicate([
            'front' => $data['front_encoding'],
            'left'  => $data['left_encoding'],
            'right' => $data['right_encoding'],
        ], $user->getKey());

        if ($match && $match['level'] === 'block') {
            Log::warning('Duplicate face registration BLOCKED', [
                'user_id'    => $user->getKey(),
                'matched_id' => $match['user_id'],
                'scores'     => $match['scores'],
                'device_id'  => $data['device_id'] ?? null,
            ]);

            return response()->json([
                'message' => 'This face is already registered to another account.',
                'code'    => 'FACE_DUPLICATE',
                'matched' => [
                    'user_id'    => $match['user_id'],
                    'name'       => $match['name'],
                    'similarity' => $match['similarity'],
                    'pose'       => $match['pose'],
                    'scores'     => $match['scores'],
                ],
            ], 409);
        }

        if ($match && $match['level'] === 'review') {
            Log::warning('Possible duplicate face registration (REVIEW)', [
                'user_id'    => $user->getKey(),
                'matched_id' => $match['user_id'],
                'scores'     => $match['scores'],
                'device_id'  => $data['device_id'] ?? null,
            ]);

            return response()->json(array_merge(
                ['duplicate' => false, 'review' => true],
                $this->debugPayload($service),
            ));
        }

        // Not a duplicate: still record how close the nearest account was,
        // so thresholds can be tuned from real scores.
        $closest = $service->lastComparison;
        Log::info('Face duplicate check: NOT a duplicate', [
            'user_id'        => $user->getKey(),
            'closest_user'   => $closest['user_id'] ?? null,
            'scores'         => $closest['sims'] ?? null,
            'mean'           => $closest['mean'] ?? null,
            'poses_passed'   => $closest['poses_passed'] ?? null,
            'device_id'      => $data['device_id'] ?? null,
        ]);

        return response()->json(array_merge(
            ['duplicate' => false],
            $this->debugPayload($service),
        ));
    }

    /**
     * Scores of the closest account, returned to the app ONLY while
     * FACE_DUP_DEBUG=true (turn it off in production).
     */
    private function debugPayload(FaceDuplicateService $service): array
    {
        if (!config('face.duplicate.debug', false)) {
            return [];
        }
        $c = $service->lastComparison;
        return ['debug' => $c ? [
            'scores'       => $c['sims'],
            'mean'         => $c['mean'],
            'poses_passed' => $c['poses_passed'],
            'min_poses'    => (int) config('face.duplicate.min_poses', 3),
        ] : null];
    }
}