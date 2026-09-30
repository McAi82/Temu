<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Mail\OtpCodeMail;
use App\Models\OtpCode;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

class DeviceSwitchController extends Controller
{
    /**
     * Cooldown after a successful device switch. Enforced server-side
     * via users.device_switch_available_at.
     */
    private const COOLDOWN_HOURS = 12;

    /**
     * POST /api/DeviceSwitch/request
     *
     * Step 1 of the OTP-gated device switch. Requires the user to
     * re-enter their password (so a stolen token alone can't trigger a
     * switch), plus the ID of the device they want to move to.
     */
    public function request(Request $request)
    {
        $request->validate([
            'email'     => 'required|email',
            'password'  => 'required',
            'device_id' => 'required|string|max:64',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password_hash)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        if (!$user->is_active) {
            return response()->json(['message' => 'Account is deactivated'], 403);
        }

        if (!$user->hasMobileAccess()) {
            return response()->json([
                'message' => 'This account does not have mobile access',
            ], 403);
        }

        // Refuse a "switch" to the device that's already bound.
        if ($user->active_device_id
            && hash_equals((string) $user->active_device_id, (string) $request->device_id)) {
            return response()->json([
                'message' => 'This device is already signed in.',
            ], 400);
        }

        // Cooldown check.
        if ($user->device_switch_available_at
            && $user->device_switch_available_at->isFuture()) {
            return response()->json([
                'message'      => 'Device switching is locked. Please wait until the cooldown ends.',
                'available_at' => $user->device_switch_available_at->toIso8601String(),
                'code'         => 'SWITCH_COOLDOWN',
            ], 429);
        }

        // Rate-limit code generation.
        $recentUser = OtpCode::recentRequestCount(
            $user->user_id,
            OtpCode::PURPOSE_DEVICE_SWITCH,
            15,
        );
        if ($recentUser >= 3) {
            return response()->json([
                'message' => 'Too many device-switch codes requested. Please wait a few minutes and try again.',
            ], 429);
        }

        $ip = $request->ip();
        if ($ip && OtpCode::recentIpCount($ip, 60) >= 10) {
            return response()->json([
                'message' => 'Too many requests from this network. Please try again later.',
            ], 429);
        }

        try {
            [$challengeId, $code] = OtpCode::issue(
                $user->user_id,
                OtpCode::PURPOSE_DEVICE_SWITCH,
                $ip,
                $request->userAgent(),
            );

            Mail::to($user->email)->send(new OtpCodeMail(
                $user,
                $code,
                OtpCode::PURPOSE_DEVICE_SWITCH,
                OtpCode::TTL_MINUTES,
            ));
        } catch (\Throwable $e) {
            Log::error('Device switch OTP issue failed: ' . $e->getMessage());
            return response()->json([
                'message' => 'Could not send verification email. Please try again.',
            ], 500);
        }

        return response()->json([
            'message'        => 'Verification code sent',
            'challenge_id'   => $challengeId,
            'masked_email'   => $this->maskEmail($user->email),
            'expires_in'     => OtpCode::TTL_MINUTES * 60,
            'cooldown_hours' => self::COOLDOWN_HOURS,
        ]);
    }

    /**
     * POST /api/DeviceSwitch/verify
     *
     * Step 2. On success:
     *   - bind the new device
     *   - revoke every existing token (kicks the old device)
     *   - start the 12-hour cooldown
     *   - issue a fresh token for the new device
     */
    public function verify(Request $request)
    {
        $request->validate([
            'challenge_id' => 'required|string|size:40',
            'code'         => 'required|string|size:6',
            'device_id'    => 'required|string|max:64',
        ]);

        $otp = OtpCode::where('challenge_id', $request->challenge_id)
            ->where('purpose', OtpCode::PURPOSE_DEVICE_SWITCH)
            ->first();

        if (!$otp) {
            return response()->json([
                'message' => 'Invalid or expired challenge.',
            ], 422);
        }

        if (!$otp->isUsable()) {
            $reason = $otp->isConsumed()
                ? 'This code has already been used.'
                : ($otp->isExpired()
                    ? 'This code has expired. Please request a new one.'
                    : 'Too many incorrect attempts. Please request a new code.');

            return response()->json(['message' => $reason], 422);
        }

        if (!Hash::check($request->code, $otp->code_hash)) {
            $otp->increment('attempts');
            $remaining = max(0, OtpCode::MAX_ATTEMPTS - $otp->attempts);

            return response()->json([
                'message' => $remaining > 0
                    ? "Incorrect code. {$remaining} attempt(s) remaining."
                    : 'Too many incorrect attempts. Please request a new code.',
                'attempts_remaining' => $remaining,
            ], 422);
        }

        $user = $otp->user;

        if (!$user || !$user->is_active) {
            return response()->json([
                'message' => 'Account is no longer active.',
            ], 403);
        }

        // Re-check the cooldown right before committing.
        if ($user->device_switch_available_at
            && $user->device_switch_available_at->isFuture()) {
            return response()->json([
                'message'      => 'Device switching is locked. Please wait until the cooldown ends.',
                'available_at' => $user->device_switch_available_at->toIso8601String(),
                'code'         => 'SWITCH_COOLDOWN',
            ], 429);
        }

        DB::beginTransaction();
        try {
            $user->active_device_id = (string) $request->device_id;
            $user->device_switch_available_at = now()->addHours(self::COOLDOWN_HOURS);
            $user->last_login = now();
            $user->save();

            // Kick every other session.
            $user->tokens()->delete();

            // Consume this OTP and invalidate any others.
            $otp->update(['consumed_at' => now()]);
            OtpCode::invalidatePrevious($user->user_id, OtpCode::PURPOSE_DEVICE_SWITCH);

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Device switch failed: ' . $e->getMessage());
            return response()->json([
                'message' => 'Could not switch devices. Please try again.',
            ], 500);
        }

        $user->refresh();

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message'             => 'Device switched successfully.',
            'user'                => $this->formatUser($user),
            'token'               => $token,
            'token_type'          => 'Bearer',
            'switch_locked_until' => $user->device_switch_available_at?->toIso8601String(),
        ]);
    }

    /**
     * GET /api/DeviceSwitch/status?email=...&device_id=...
     *
     * Lets the mobile app learn whether the current device is the
     * active one and, if not, when the next switch will be allowed.
     */
    public function status(Request $request)
    {
        $request->validate([
            'email'     => 'required|email',
            'device_id' => 'required|string|max:64',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $bound = $user->active_device_id
            ? hash_equals((string) $user->active_device_id, (string) $request->device_id)
            : false;

        $canSwitch = $user->canSwitchDevice();

        return response()->json([
            'is_active_device' => $bound,
            'has_bound_device' => (bool) $user->active_device_id,
            'can_switch'       => $canSwitch,
            'available_at'     => $canSwitch
                ? null
                : optional($user->device_switch_available_at)->toIso8601String(),
            'cooldown_hours'   => self::COOLDOWN_HOURS,
        ]);
    }

    /* ----------------------------- helpers ----------------------------- */

    private function maskEmail(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');
        if ($local === '' || $domain === '') return $email;

        $len = mb_strlen($local);
        if ($len <= 2) {
            return mb_substr($local, 0, 1) . '*@' . $domain;
        }

        return mb_substr($local, 0, 1)
            . str_repeat('*', min($len - 2, 6))
            . mb_substr($local, -1)
            . '@' . $domain;
    }

    private function formatUser(User $user): array
    {
        return [
            'user_id'             => $user->user_id,
            'email'               => $user->email,
            'firstname'           => $user->firstname,
            'lastname'            => $user->lastname,
            'role'                => $user->role,
            'has_web_access'      => $user->hasWebAccess(),
            'has_mobile_access'   => $user->hasMobileAccess(),
            'profile_image_url'   => $user->profile_image
                ? Storage::url($user->profile_image)
                : null,
            'has_face_registered' => (bool) $user->has_face_registered,
            'face_encoding'       => null,
        ];
    }
}