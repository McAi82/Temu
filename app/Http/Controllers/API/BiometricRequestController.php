<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\BiometricRequest;
use App\Models\Notification;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class BiometricRequestController extends Controller
{
    /**
     * POST /api/biometric-requests
     * Enforcer submits a request to change their biometric setup.
     * Deduplicates: if a pending request of the same type already
     * exists for this user, we return it instead of creating another.
     */
    /**
     * POST /api/biometric-requests/{id}/consume
     * Called by the mobile app after it has applied an approval locally.
     * Marks the request so no other device picks it up.
     */
    public function consume(Request $request, $id)
    {
        $biometricRequest = BiometricRequest::findOrFail($id);

        if ($biometricRequest->user_id !== $request->user()->user_id) {
            return response()->json(['message' => 'Not authorized.'], 403);
        }

        if ($biometricRequest->status !== BiometricRequest::STATUS_APPROVED) {
            return response()->json([
                'message' => 'Only approved requests can be consumed.',
            ], 422);
        }

        if ($biometricRequest->consumed_at) {
            // Already consumed — treat as success so retries are safe.
            return response()->json([
                'message' => 'Already consumed.',
                'request' => $biometricRequest,
            ]);
        }

        $biometricRequest->update(['consumed_at' => now()]);

        return response()->json([
            'message' => 'Consumed.',
            'request' => $biometricRequest->fresh(),
        ]);
    }
    public function mine(Request $request)
    {
        $user = $request->user();

        // If there's an approved-but-not-consumed request, that's the one
        // we want to hand over. Otherwise fall back to the most recent
        // request of any status so the mobile app can still show "pending".
        $fresh = BiometricRequest::where('user_id', $user->user_id)
            ->where('status', BiometricRequest::STATUS_APPROVED)
            ->whereNull('consumed_at')
            ->orderBy('reviewed_at', 'desc')
            ->first();

        if ($fresh) {
            return response()->json(['request' => $fresh]);
        }

        $latest = BiometricRequest::where('user_id', $user->user_id)
            ->orderBy('created_at', 'desc')
            ->first();

        return response()->json(['request' => $latest]);
    }
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'request_type'  => 'required|in:switch_to_fingerprint,switch_to_face,reset_biometric',
            'source'        => 'nullable|in:attendance,login',
            'failure_count' => 'nullable|integer|min:0',
            'reason'        => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user   = $request->user();
        $source = $request->get('source', BiometricRequest::SOURCE_ATTENDANCE);

        // One pending request per (user, type) — resubmission returns the
        // existing one rather than stacking duplicates.
        $existing = BiometricRequest::where('user_id', $user->user_id)
            ->where('request_type', $request->request_type)
            ->where('status', BiometricRequest::STATUS_PENDING)
            ->first();

        if ($existing) {
            return response()->json([
                'message'         => 'A request of this type is already pending review.',
                'request'         => $existing->load('user'),
                'already_pending' => true,
            ], 200);
        }

        $biometricRequest = BiometricRequest::create([
            'user_id'       => $user->user_id,
            'request_type'  => $request->request_type,
            'source'        => $source,
            'failure_count' => (int) $request->get('failure_count', 0),
            'reason'        => $request->reason,
            'status'        => BiometricRequest::STATUS_PENDING,
        ]);

        try {
            $name      = trim("{$user->firstname} {$user->lastname}");
            $failCount = (int) $request->get('failure_count', 0);
            $where     = $source === BiometricRequest::SOURCE_ATTENDANCE
                ? 'at time-in/time-out'
                : 'at login';

            NotificationService::notifyAdminStaff(
                'Biometric Change Request',
                "{$name} is requesting a biometric change after {$failCount} failed attempt(s) {$where}.",
                Notification::TYPE_BIOMETRIC_REQUEST_SUBMITTED,
                'biometric_request',
                $biometricRequest->request_id
            );

            NotificationService::notifyUser(
                $user->user_id,
                'Request Submitted',
                'Your biometric change request is pending admin approval.',
                Notification::TYPE_BIOMETRIC_REQUEST_SUBMITTED,
                'biometric_request',
                $biometricRequest->request_id
            );
        } catch (\Throwable $ne) {
            Log::warning('Biometric request notification failed: ' . $ne->getMessage());
        }

        return response()->json([
            'message' => 'Request submitted for admin approval.',
            'request' => $biometricRequest->load('user'),
        ], 201);
    }

    /**
     * GET /api/biometric-requests
     * Admin/staff list. Filters: status, user_id, request_type, source.
     */
    public function index(Request $request)
    {
        $perPage = (int) $request->get('per_page', 20);
        $page    = (int) $request->get('page', 1);

        $query = BiometricRequest::with(['user', 'reviewer']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }
        if ($request->filled('request_type')) {
            $query->where('request_type', $request->request_type);
        }
        if ($request->filled('source')) {
            $query->where('source', $request->source);
        }

        $requests = $query
            ->orderByRaw("FIELD(status, 'pending', 'approved', 'rejected')")
            ->orderBy('created_at', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);

        return response()->json($requests);
    }

    /**
     * GET /api/biometric-requests/pending-count
     * Lightweight poll for the admin sidebar / dashboard badge.
     */
    public function pendingCount()
    {
        return response()->json([
            'count' => BiometricRequest::pending()->count(),
        ]);
    }

    /**
     * PUT /api/biometric-requests/{id}/approve
     * Admin only.
     */
    public function approve(Request $request, $id)
    {
        $biometricRequest = BiometricRequest::with('user')->findOrFail($id);

        if ($biometricRequest->status !== BiometricRequest::STATUS_PENDING) {
            return response()->json([
                'message' => 'This request has already been reviewed.',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'review_notes' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $admin = $request->user();

        $biometricRequest->update([
            'status'       => BiometricRequest::STATUS_APPROVED,
            'reviewed_by'  => $admin->user_id,
            'review_notes' => $request->review_notes,
            'reviewed_at'  => now(),
        ]);

        try {
            $adminName = trim("{$admin->firstname} {$admin->lastname}");

            $message = match ($biometricRequest->request_type) {
                BiometricRequest::TYPE_SWITCH_TO_FINGERPRINT =>
                'Your request to use fingerprint verification for attendance has been approved. '
                    . 'Open Profile → Security and enable "Fingerprint for Attendance".',
                BiometricRequest::TYPE_SWITCH_TO_FACE =>
                'Your request to switch back to face verification has been approved.',
                BiometricRequest::TYPE_RESET_BIOMETRIC =>
                'Your biometric reset request has been approved. Please re-register your face.',
                default => 'Your biometric request has been approved.',
            };

            NotificationService::notifyUser(
                $biometricRequest->user_id,
                'Biometric Request Approved',
                $message,
                Notification::TYPE_BIOMETRIC_REQUEST_APPROVED,
                'biometric_request',
                $biometricRequest->request_id
            );

            NotificationService::notifyAdmins(
                'Biometric Request Approved',
                "{$adminName} approved {$biometricRequest->user->firstname}'s biometric request.",
                Notification::TYPE_BIOMETRIC_REQUEST_APPROVED,
                'biometric_request',
                $biometricRequest->request_id
            );
        } catch (\Throwable $ne) {
            Log::warning('Biometric approve notification failed: ' . $ne->getMessage());
        }

        return response()->json([
            'message' => 'Request approved.',
            'request' => $biometricRequest->fresh(['user', 'reviewer']),
        ]);
    }

    /**
     * PUT /api/biometric-requests/{id}/reject
     * Admin only. Rejection reason is required.
     */
    public function reject(Request $request, $id)
    {
        $biometricRequest = BiometricRequest::with('user')->findOrFail($id);

        if ($biometricRequest->status !== BiometricRequest::STATUS_PENDING) {
            return response()->json([
                'message' => 'This request has already been reviewed.',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'review_notes' => 'required|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $admin = $request->user();

        $biometricRequest->update([
            'status'       => BiometricRequest::STATUS_REJECTED,
            'reviewed_by'  => $admin->user_id,
            'review_notes' => $request->review_notes,
            'reviewed_at'  => now(),
        ]);

        try {
            $adminName = trim("{$admin->firstname} {$admin->lastname}");

            NotificationService::notifyUser(
                $biometricRequest->user_id,
                'Biometric Request Declined',
                "Your request was declined. Reason: {$request->review_notes}",
                Notification::TYPE_BIOMETRIC_REQUEST_REJECTED,
                'biometric_request',
                $biometricRequest->request_id
            );

            NotificationService::notifyAdmins(
                'Biometric Request Declined',
                "{$adminName} declined {$biometricRequest->user->firstname}'s biometric request.",
                Notification::TYPE_BIOMETRIC_REQUEST_REJECTED,
                'biometric_request',
                $biometricRequest->request_id
            );
        } catch (\Throwable $ne) {
            Log::warning('Biometric reject notification failed: ' . $ne->getMessage());
        }

        return response()->json([
            'message' => 'Request rejected.',
            'request' => $biometricRequest->fresh(['user', 'reviewer']),
        ]);
    }
}
