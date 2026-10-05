<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\FaceRegistration;
use App\Models\FaceTakeoverRequest;
use App\Models\Notification;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class FaceRegistrationController extends Controller
{
    private const EXPECTED_EMBEDDING_LENGTH = 192;

    /* ==================================================================
     |  MOBILE — REGISTER
     ================================================================== */

    public function register(Request $request)
    {
        $len = self::EXPECTED_EMBEDDING_LENGTH;

        $validator = Validator::make($request->all(), [
            'front_encoding'   => "required|array|size:{$len}",
            'front_encoding.*' => 'numeric',
            'left_encoding'    => "required|array|size:{$len}",
            'left_encoding.*'  => 'numeric',
            'right_encoding'   => "required|array|size:{$len}",
            'right_encoding.*' => 'numeric',
            'front_image'      => 'required|string',
            'left_image'       => 'required|string',
            'right_image'      => 'required|string',
            'device_id'        => 'required|string|max:64',
            'app_version'      => 'nullable|string|max:32',
            'threshold_used'   => 'nullable|numeric|between:0,1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $user = $request->user();

        DB::beginTransaction();
        try {
            FaceRegistration::where('user_id', $user->user_id)
                ->where('is_active', true)
                ->update([
                    'is_active'   => false,
                    'replaced_at' => now(),
                ]);

            $frontPath = $this->saveBase64Image(
                $request->front_image,
                "faces/{$user->user_id}/front",
            );
            $leftPath = $this->saveBase64Image(
                $request->left_image,
                "faces/{$user->user_id}/left",
            );
            $rightPath = $this->saveBase64Image(
                $request->right_image,
                "faces/{$user->user_id}/right",
            );

            $registration = FaceRegistration::create([
                'user_id'        => $user->user_id,
                'front_encoding' => $request->front_encoding,
                'left_encoding'  => $request->left_encoding,
                'right_encoding' => $request->right_encoding,
                'front_image'    => $frontPath,
                'left_image'     => $leftPath,
                'right_image'    => $rightPath,
                'device_id'      => $request->device_id,
                'app_version'    => $request->app_version,
                'threshold_used' => $request->threshold_used ?? 0.88,
                'is_active'      => true,
            ]);

            $wasRegistered = (bool) $user->has_face_registered;
            $user->has_face_registered = true;
            $user->save();

            DB::commit();

            if (!$wasRegistered) {
                try {
                    NotificationService::notifyAdmins(
                        'Face Registered',
                        "{$user->firstname} {$user->lastname} registered their face on device {$request->device_id}",
                        Notification::TYPE_FACE_REGISTERED,
                        'user',
                        $user->user_id,
                    );
                } catch (\Throwable $ne) {
                    Log::warning('Face register notification failed: ' . $ne->getMessage());
                }
            }

            return response()->json([
                'message'              => 'Face registered successfully',
                'face_registration_id' => $registration->face_registration_id,
                'has_face_registered'  => true,
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Face registration failed: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to register face: ' . $e->getMessage(),
            ], 500);
        }
    }

    /* ==================================================================
     |  MOBILE — TAKEOVER REQUEST
     ================================================================== */

    public function requestTakeover(Request $request)
    {
        Log::info('[Takeover] request received', [
            'user_id'      => $request->user()?->user_id,
            'device_id'    => $request->input('device_id'),
            'has_reg_id'   => $request->filled('existing_registration_id'),
            'has_owner_id' => $request->filled('current_owner_user_id'),
        ]);

        $len = self::EXPECTED_EMBEDDING_LENGTH;

        $validator = Validator::make($request->all(), [
            'existing_registration_id' => 'nullable|integer|exists:face_registrations,face_registration_id',
            'current_owner_user_id'    => 'nullable|integer|exists:users,user_id',
            'similarity'               => 'required|numeric|between:0,1',
            'device_id'                => 'required|string|max:64',

            'front_encoding'   => "required|array|size:{$len}",
            'front_encoding.*' => 'numeric',
            'left_encoding'    => "required|array|size:{$len}",
            'left_encoding.*'  => 'numeric',
            'right_encoding'   => "required|array|size:{$len}",
            'right_encoding.*' => 'numeric',
            'front_image'      => 'required|string',
            'left_image'       => 'required|string',
            'right_image'      => 'required|string',
        ]);

        if ($validator->fails()) {
            Log::warning('[Takeover] validation failed', $validator->errors()->toArray());
            return response()->json([
                'message' => 'Validation failed',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $requester = $request->user();

        // Resolve the existing registration: either by explicit id, or
        // by (device_id + owner user_id) when the mobile didn't know
        // the registration id.
        $existing = null;

        if ($request->filled('existing_registration_id')) {
            $existing = FaceRegistration::find($request->existing_registration_id);
        } elseif ($request->filled('current_owner_user_id')) {
            $existing = FaceRegistration::where('device_id', $request->device_id)
                ->where('user_id', $request->current_owner_user_id)
                ->where('is_active', true)
                ->orderByDesc('created_at')
                ->first();
        }

        if (!$existing || !$existing->is_active) {
            Log::info('[Takeover] existing registration not found', [
                'device_id'            => $request->device_id,
                'requested_reg_id'     => $request->input('existing_registration_id'),
                'requested_owner_id'   => $request->input('current_owner_user_id'),
            ]);
            return response()->json([
                'message' => 'The current owner\'s face was registered before server upload was enabled, so there is no record for an administrator to review. Please ask an administrator to reset the device manually, or ask the current owner to re-register their face.',
                'code'    => 'EXISTING_NOT_FOUND',
            ], 422);
        }

        if ($existing->user_id === $requester->user_id) {
            return response()->json([
                'message' => 'This face is already yours.',
            ], 400);
        }

        $duplicate = FaceTakeoverRequest::where('requester_user_id', $requester->user_id)
            ->where('existing_registration_id', $existing->face_registration_id)
            ->where('status', 'pending')
            ->exists();

        if ($duplicate) {
            return response()->json([
                'message' => 'You already have a pending takeover request for this face.',
                'code'    => 'ALREADY_PENDING',
            ], 409);
        }

        DB::beginTransaction();
        try {
            $frontPath = $this->saveBase64Image(
                $request->front_image,
                "takeover_requests/{$requester->user_id}/front",
            );
            $leftPath = $this->saveBase64Image(
                $request->left_image,
                "takeover_requests/{$requester->user_id}/left",
            );
            $rightPath = $this->saveBase64Image(
                $request->right_image,
                "takeover_requests/{$requester->user_id}/right",
            );

            $takeover = FaceTakeoverRequest::create([
                'requester_user_id'        => $requester->user_id,
                'existing_registration_id' => $existing->face_registration_id,
                'current_owner_user_id'    => $existing->user_id,
                'device_id'                => $request->device_id,
                'similarity'               => $request->similarity,
                'requester_front_encoding' => $request->front_encoding,
                'requester_left_encoding'  => $request->left_encoding,
                'requester_right_encoding' => $request->right_encoding,
                'requester_front_image'    => $frontPath,
                'requester_left_image'     => $leftPath,
                'requester_right_image'    => $rightPath,
                'status'                   => 'pending',
            ]);

            DB::commit();

            Log::info('[Takeover] row created', [
                'request_id' => $takeover->request_id,
            ]);

            try {
                $owner = User::find($existing->user_id);
                $ownerName = $owner
                    ? "{$owner->firstname} {$owner->lastname}"
                    : 'Unknown';

                NotificationService::notifyAdmins(
                    'Face Takeover Request',
                    "{$requester->firstname} {$requester->lastname} is requesting to take over the face currently owned by {$ownerName}.",
                    Notification::TYPE_FACE_TAKEOVER_REQUESTED,
                    'user',
                    $requester->user_id,
                );
            } catch (\Throwable $ne) {
                Log::warning('Takeover notification failed: ' . $ne->getMessage());
            }

            return response()->json([
                'message'    => 'Takeover request submitted. An administrator will review it.',
                'request_id' => $takeover->request_id,
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('[Takeover] insert failed', [
                'message' => $e->getMessage(),
                'file'    => $e->getFile(),
                'line'    => $e->getLine(),
            ]);
            return response()->json([
                'message' => 'Could not submit takeover request: ' . $e->getMessage(),
            ], 500);
        }
    }

    /* ==================================================================
     |  MOBILE — LOOKUP
     ================================================================== */

    public function myRegistration(Request $request)
    {
        $user = $request->user();

        $registration = FaceRegistration::where('user_id', $user->user_id)
            ->where('is_active', true)
            ->first();

        if (!$registration) {
            return response()->json(['registration' => null]);
        }

        return response()->json([
            'registration' => [
                'face_registration_id' => $registration->face_registration_id,
                'front_image_url'      => Storage::url($registration->front_image),
                'left_image_url'       => Storage::url($registration->left_image),
                'right_image_url'      => Storage::url($registration->right_image),
                'registered_at'        => $registration->created_at,
                'device_id'            => $registration->device_id,
            ],
        ]);
    }

    public function deviceRegistrations(Request $request, string $deviceId)
    {
        $rows = FaceRegistration::with('user')
            ->where('device_id', $deviceId)
            ->where('is_active', true)
            ->get()
            ->map(fn($r) => [
                'face_registration_id' => $r->face_registration_id,
                'user_id'              => $r->user_id,
                'user_name'            => $r->user
                    ? trim("{$r->user->firstname} {$r->user->lastname}")
                    : 'Unknown',
                'front_image_url' => Storage::url($r->front_image),
                'registered_at'   => $r->created_at,
            ]);

        return response()->json(['registrations' => $rows]);
    }

    /* ==================================================================
     |  ADMIN — LIST REGISTRATIONS
     ================================================================== */

    public function index(Request $request)
    {
        $perPage = (int) $request->get('per_page', 20);
        $search  = trim((string) $request->get('search', ''));
        $status  = $request->get('status', 'active');

        $query = FaceRegistration::with('user');

        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'archived') {
            $query->where('is_active', false);
        }

        if ($search !== '') {
            $query->whereHas('user', function ($q) use ($search) {
                $q->where('firstname', 'like', "%{$search}%")
                    ->orWhere('lastname', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $paginator = $query->orderByDesc('created_at')->paginate($perPage);

        $paginator->getCollection()->transform(function ($r) {
            return [
                'face_registration_id' => $r->face_registration_id,
                'user' => [
                    'user_id'   => $r->user?->user_id,
                    'firstname' => $r->user?->firstname,
                    'lastname'  => $r->user?->lastname,
                    'email'     => $r->user?->email,
                    'role'      => $r->user?->role,
                ],
                'device_id'       => $r->device_id,
                'is_active'       => $r->is_active,
                'front_image_url' => Storage::url($r->front_image),
                'left_image_url'  => Storage::url($r->left_image),
                'right_image_url' => Storage::url($r->right_image),
                'registered_at'   => $r->created_at,
                'replaced_at'     => $r->replaced_at,
            ];
        });

        return response()->json($paginator);
    }

    public function show(Request $request, $id)
    {
        $registration = FaceRegistration::with(['user', 'replacedBy'])
            ->findOrFail($id);

        return response()->json([
            'face_registration_id' => $registration->face_registration_id,
            'user' => [
                'user_id'   => $registration->user?->user_id,
                'firstname' => $registration->user?->firstname,
                'lastname'  => $registration->user?->lastname,
                'email'     => $registration->user?->email,
                'role'      => $registration->user?->role,
            ],
            'front_image_url' => Storage::url($registration->front_image),
            'left_image_url'  => Storage::url($registration->left_image),
            'right_image_url' => Storage::url($registration->right_image),
            'device_id'       => $registration->device_id,
            'is_active'       => $registration->is_active,
            'registered_at'   => $registration->created_at,
            'replaced_at'     => $registration->replaced_at,
        ]);
    }

    /* ==================================================================
     |  ADMIN — TAKEOVER LIST
     ================================================================== */

    public function listTakeovers(Request $request)
    {
        $perPage = (int) $request->get('per_page', 20);
        $status  = $request->get('status', 'pending');

        $query = FaceTakeoverRequest::with([
            'requester',
            'currentOwner',
            'existingRegistration',
        ]);

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        $paginator = $query->orderByDesc('created_at')->paginate($perPage);

        $paginator->getCollection()->transform(function ($r) {
            return [
                'request_id' => $r->request_id,
                'status'     => $r->status,
                'similarity' => $r->similarity,
                'device_id'  => $r->device_id,
                'created_at' => $r->created_at,

                'requester' => [
                    'user_id'   => $r->requester?->user_id,
                    'firstname' => $r->requester?->firstname,
                    'lastname'  => $r->requester?->lastname,
                    'email'     => $r->requester?->email,
                    'role'      => $r->requester?->role,
                ],
                'current_owner' => [
                    'user_id'   => $r->currentOwner?->user_id,
                    'firstname' => $r->currentOwner?->firstname,
                    'lastname'  => $r->currentOwner?->lastname,
                    'email'     => $r->currentOwner?->email,
                    'role'      => $r->currentOwner?->role,
                ],

                'existing_front_image_url' => $r->existingRegistration
                    ? Storage::url($r->existingRegistration->front_image)
                    : null,
                'existing_left_image_url' => $r->existingRegistration
                    ? Storage::url($r->existingRegistration->left_image)
                    : null,
                'existing_right_image_url' => $r->existingRegistration
                    ? Storage::url($r->existingRegistration->right_image)
                    : null,

                'requester_front_image_url' => $r->requester_front_image
                    ? Storage::url($r->requester_front_image)
                    : null,
                'requester_left_image_url' => $r->requester_left_image
                    ? Storage::url($r->requester_left_image)
                    : null,
                'requester_right_image_url' => $r->requester_right_image
                    ? Storage::url($r->requester_right_image)
                    : null,

                'reviewed_by'  => $r->reviewed_by,
                'review_notes' => $r->review_notes,
                'reviewed_at'  => $r->reviewed_at,
            ];
        });

        return response()->json($paginator);
    }

    /* ==================================================================
     |  ADMIN — APPROVE / REJECT
     ================================================================== */

    public function approveTakeover(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'review_notes' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $takeover = FaceTakeoverRequest::with('existingRegistration')
            ->findOrFail($id);

        if ($takeover->status !== 'pending') {
            return response()->json([
                'message' => 'This request has already been reviewed.',
            ], 422);
        }

        $existing = $takeover->existingRegistration;
        if (!$existing || !$existing->is_active) {
            return response()->json([
                'message' => 'The existing registration is no longer active.',
            ], 422);
        }

        DB::beginTransaction();
        try {
            $existing->is_active   = false;
            $existing->replaced_at = now();
            $existing->save();

            $newRegistration = FaceRegistration::create([
                'user_id'        => $takeover->requester_user_id,
                'front_encoding' => $existing->front_encoding,
                'left_encoding'  => $existing->left_encoding,
                'right_encoding' => $existing->right_encoding,
                'front_image'    => $existing->front_image,
                'left_image'     => $existing->left_image,
                'right_image'    => $existing->right_image,
                'device_id'      => $takeover->device_id,
                'app_version'    => $existing->app_version,
                'threshold_used' => $existing->threshold_used,
                'is_active'      => true,
            ]);

            $existing->replaced_by_registration_id =
                $newRegistration->face_registration_id;
            $existing->save();

            $requester = User::find($takeover->requester_user_id);
            $oldOwner  = User::find($takeover->current_owner_user_id);

            if ($requester) {
                $requester->has_face_registered = true;
                $requester->save();
            }
            if ($oldOwner) {
                $oldOwner->has_face_registered = false;
                $oldOwner->save();
            }

            $takeover->status       = 'approved';
            $takeover->reviewed_by  = $request->user()->user_id;
            $takeover->review_notes = $request->review_notes;
            $takeover->reviewed_at  = now();
            $takeover->consumed_at  = now();
            $takeover->save();

            DB::commit();

            try {
                $admin = $request->user();
                $adminName = trim("{$admin->firstname} {$admin->lastname}");

                if ($requester) {
                    NotificationService::notifyUser(
                        $requester->user_id,
                        'Face Takeover Approved',
                        "Your request to take over the face registration on device {$takeover->device_id} has been approved.",
                        Notification::TYPE_FACE_TAKEOVER_APPROVED,
                        'user',
                        $requester->user_id,
                    );
                }
                if ($oldOwner) {
                    NotificationService::notifyUser(
                        $oldOwner->user_id,
                        'Face Registration Transferred',
                        "Your face registration was transferred to another enforcer by {$adminName}. You will need to register your face again.",
                        Notification::TYPE_FACE_TRANSFERRED,
                        'user',
                        $oldOwner->user_id,
                    );
                }
            } catch (\Throwable $ne) {
                Log::warning('Takeover approval notification failed: ' . $ne->getMessage());
            }

            return response()->json([
                'message' => 'Takeover approved. The requester now owns this face.',
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Takeover approval failed: ' . $e->getMessage());
            return response()->json([
                'message' => 'Could not approve takeover: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function rejectTakeover(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'review_notes' => 'required|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $takeover = FaceTakeoverRequest::findOrFail($id);

        if ($takeover->status !== 'pending') {
            return response()->json([
                'message' => 'This request has already been reviewed.',
            ], 422);
        }

        $takeover->status       = 'rejected';
        $takeover->reviewed_by  = $request->user()->user_id;
        $takeover->review_notes = $request->review_notes;
        $takeover->reviewed_at  = now();
        $takeover->save();

        try {
            $requester = User::find($takeover->requester_user_id);
            if ($requester) {
                NotificationService::notifyUser(
                    $requester->user_id,
                    'Face Takeover Rejected',
                    'Your face takeover request was rejected. Reason: ' . $request->review_notes,
                    Notification::TYPE_FACE_TAKEOVER_REJECTED,
                    'user',
                    $requester->user_id,
                );
            }
        } catch (\Throwable $ne) {
            Log::warning('Takeover rejection notification failed: ' . $ne->getMessage());
        }

        return response()->json([
            'message' => 'Takeover request rejected.',
        ]);
    }

    /* ==================================================================
     |  ADMIN — TRANSFER
     ================================================================== */

    public function transferOwnership(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'new_user_id'  => 'required|exists:users,user_id',
            'review_notes' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $registration = FaceRegistration::with('user')->findOrFail($id);

        if (!$registration->is_active) {
            return response()->json([
                'message' => 'Only active registrations can be transferred.',
            ], 422);
        }

        $newUser = User::find($request->new_user_id);
        if (!$newUser) {
            return response()->json(['message' => 'New user not found.'], 404);
        }

        DB::beginTransaction();
        try {
            $oldUserId = $registration->user_id;

            $registration->is_active   = false;
            $registration->replaced_at = now();
            $registration->save();

            $new = FaceRegistration::create([
                'user_id'        => $newUser->user_id,
                'front_encoding' => $registration->front_encoding,
                'left_encoding'  => $registration->left_encoding,
                'right_encoding' => $registration->right_encoding,
                'front_image'    => $registration->front_image,
                'left_image'     => $registration->left_image,
                'right_image'    => $registration->right_image,
                'device_id'      => $registration->device_id,
                'app_version'    => $registration->app_version,
                'threshold_used' => $registration->threshold_used,
                'is_active'      => true,
            ]);

            $registration->replaced_by_registration_id =
                $new->face_registration_id;
            $registration->save();

            User::where('user_id', $oldUserId)
                ->update(['has_face_registered' => false]);
            $newUser->has_face_registered = true;
            $newUser->save();

            DB::commit();

            return response()->json([
                'message' => 'Face transferred to '
                    . trim("{$newUser->firstname} {$newUser->lastname}") . '.',
                'face_registration_id' => $new->face_registration_id,
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Face transfer failed: ' . $e->getMessage());
            return response()->json([
                'message' => 'Could not transfer face: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function pendingCount()
    {
        return response()->json([
            'count' => FaceTakeoverRequest::where('status', 'pending')->count(),
        ]);
    }

    /* ==================================================================
     |  HELPERS
     ================================================================== */

    private function saveBase64Image(string $base64, string $pathPrefix): string
    {
        $imageData = $base64;
        $declaredExtension = 'jpg';

        if (preg_match('/^data:image\/(\w+);base64,/', $base64, $m)) {
            $imageData = substr($base64, strpos($base64, ',') + 1);
            $declaredExtension = strtolower($m[1]);
        }

        $imageData = strtr($imageData, '-_', '+/');
        $padding = strlen($imageData) % 4;
        if ($padding > 0) {
            $imageData .= str_repeat('=', 4 - $padding);
        }

        $binary = base64_decode($imageData, true);
        if ($binary === false || $binary === '') {
            throw new \RuntimeException('base64_decode returned empty or invalid data');
        }

        $binaryLength = strlen($binary);

        $isJpeg = substr($binary, 0, 3) === "\xFF\xD8\xFF";
        $isPng  = substr($binary, 0, 4) === "\x89PNG";

        if (!$isJpeg && !$isPng) {
            $knownSizes = [
                112 * 112 * 3 => 112,
                160 * 160 * 3 => 160,
                224 * 224 * 3 => 224,
            ];

            if (!isset($knownSizes[$binaryLength])) {
                Log::warning('[FaceUpload] raw binary has unexpected length', [
                    'length'      => $binaryLength,
                    'path_prefix' => $pathPrefix,
                ]);

                throw new \RuntimeException(
                    "Unrecognized image payload: {$binaryLength} bytes, " .
                        "magic=" . bin2hex(substr($binary, 0, 4))
                );
            }

            if (!extension_loaded('gd')) {
                throw new \RuntimeException('GD extension is required to encode raw RGB');
            }

            $side = $knownSizes[$binaryLength];
            $binary = $this->rawRgbToJpeg($binary, $side);
            $declaredExtension = 'jpg';
            $isJpeg = true;
        }

        $extension = $isPng ? 'png' : 'jpg';
        if ($declaredExtension === 'png' && $isPng) {
            $extension = 'png';
        } elseif ($declaredExtension === 'jpg' || $declaredExtension === 'jpeg') {
            $extension = 'jpg';
        }

        $filename = $pathPrefix . '_' . Str::uuid() . '.' . $extension;
        Storage::disk('public')->put($filename, $binary);

        if (!Storage::disk('public')->exists($filename)) {
            throw new \RuntimeException("Failed to write file: {$filename}");
        }

        return $filename;
    }

    /**
     * Convert raw RGB bytes (side × side × 3) to a JPEG binary string.
     *
     * Flips rows vertically because the VisionCamera resizer returns
     * bottom-up buffers on some devices. If you later ship a mobile
     * update that sends top-down buffers, remove the `$y = $side - 1 - $srcY`.
     */
    private function rawRgbToJpeg(string $binary, int $side): string
    {
        $img = imagecreatetruecolor($side, $side);
        if ($img === false) {
            throw new \RuntimeException('imagecreatetruecolor failed');
        }

        $offset = 0;
        for ($srcY = 0; $srcY < $side; $srcY++) {
            $y = $side - 1 - $srcY;

            for ($x = 0; $x < $side; $x++) {
                $r = ord($binary[$offset++]);
                $g = ord($binary[$offset++]);
                $b = ord($binary[$offset++]);

                $color = imagecolorallocate($img, $r, $g, $b);
                imagesetpixel($img, $x, $y, $color);
            }
        }

        ob_start();
        imagejpeg($img, null, 88);
        $jpeg = ob_get_clean();
        imagedestroy($img);

        if ($jpeg === false || $jpeg === '') {
            throw new \RuntimeException('imagejpeg produced empty output');
        }

        return $jpeg;
    }
}
