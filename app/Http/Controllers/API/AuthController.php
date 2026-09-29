<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Mail\OtpCodeMail;
use App\Models\Face;
use App\Models\OtpCode;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

class AuthController extends Controller
{
    /**
     * The roles that must complete email OTP on web login.
     * Enforcers are excluded — they only use the mobile app.
     */
    private const WEB_OTP_ROLES = ['admin', 'staff'];

    /* ==================================================================
     |  MOBILE LOGIN (unchanged — no OTP)
     ================================================================== */

    public function Mobilelogin(Request $request)
    {
        // 🔎 DEBUG: log the incoming request body
        Log::info('[Mobilelogin] request received', [
            'email' => $request->email,
            'ip'    => $request->ip(),
            'ua'    => $request->userAgent(),
        ]);

        $request->validate([
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        // 🔎 DEBUG: did we find a user?
        Log::info('[Mobilelogin] user lookup', [
            'found'  => (bool) $user,
            'role'   => $user?->role,
            'active' => $user?->is_active,
        ]);

        if (!$user || !Hash::check($request->password, $user->password_hash)) {
            Log::warning('[Mobilelogin] invalid credentials', [
                'email' => $request->email,
            ]);
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        if (!$user->is_active) {
            Log::warning('[Mobilelogin] inactive account', [
                'user_id' => $user->user_id,
            ]);
            return response()->json(['message' => 'Account is deactivated'], 403);
        }

        if (!$user->hasMobileAccess()) {
            Log::warning('[Mobilelogin] no mobile access', [
                'user_id' => $user->user_id,
                'role'    => $user->role,
            ]);
            return response()->json([
                'message' => 'This account does not have mobile access',
            ], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        $payload = [
            'message'    => 'Login successful',
            'user'       => $this->formatUser($user),
            'token'      => $token,
            'token_type' => 'Bearer',
        ];

        // 🔎 DEBUG: full response payload (minus the token itself)
        Log::info('[Mobilelogin] success', [
            'user_id'     => $user->user_id,
            'role'        => $user->role,
            'token_len'   => strlen($token),
            'response'    => array_merge($payload, ['token' => '***REDACTED***']),
        ]);

        return response()->json($payload);
    }

    /* ==================================================================
     |  WEB LOGIN — step 1: credentials
     |
     |  Admin/Staff → issue OTP, return { requires_otp: true, ... }
     |  Enforcer    → return token immediately (unchanged for this role)
     ================================================================== */

    public function Weblogin(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password_hash)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        if (!$user->is_active) {
            return response()->json(['message' => 'Account is deactivated'], 403);
        }

        // Enforcers don't get OTP — they shouldn't even be using web,
        // but if someone hits this endpoint with an enforcer account,
        // fall through to the legacy behavior.
        if (!in_array($user->role, self::WEB_OTP_ROLES, true)) {
            return $this->issueToken($user);
        }

        // ----- Rate-limit code generation -----
        $recentUserCount = OtpCode::recentRequestCount(
            $user->user_id,
            OtpCode::PURPOSE_LOGIN,
            15,
        );
        if ($recentUserCount >= 3) {
            return response()->json([
                'message' => 'Too many verification codes requested. Please wait a few minutes and try again.',
            ], 429);
        }

        $ip = $request->ip();
        if ($ip && OtpCode::recentIpCount($ip, 60) >= 10) {
            return response()->json([
                'message' => 'Too many requests from this network. Please try again later.',
            ], 429);
        }

        // ----- Issue and email the code -----
        try {
            [$challengeId, $code] = OtpCode::issue(
                $user->user_id,
                OtpCode::PURPOSE_LOGIN,
                $ip,
                $request->userAgent(),
            );

            Mail::to($user->email)->send(new OtpCodeMail(
                $user,
                $code,
                OtpCode::PURPOSE_LOGIN,
                OtpCode::TTL_MINUTES,
            ));
        } catch (\Throwable $e) {
            Log::error('OTP issue failed on Weblogin: ' . $e->getMessage());
            return response()->json([
                'message' => 'Could not send verification email. Please try again.',
            ], 500);
        }

        return response()->json([
            'message'      => 'Verification code sent',
            'requires_otp' => true,
            'challenge_id' => $challengeId,
            'masked_email' => $this->maskEmail($user->email),
            'expires_in'   => OtpCode::TTL_MINUTES * 60,
        ]);
    }

    /* ==================================================================
     |  WEB LOGIN — step 2: verify OTP
     ================================================================== */

    public function WebloginVerifyOtp(Request $request)
    {
        $request->validate([
            'challenge_id' => 'required|string|size:40',
            'code'         => 'required|string|size:6',
        ]);

        $otp = OtpCode::where('challenge_id', $request->challenge_id)
            ->where('purpose', OtpCode::PURPOSE_LOGIN)
            ->first();

        if (!$otp) {
            return response()->json(['message' => 'Invalid or expired challenge.'], 422);
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
            return response()->json(['message' => 'Account is no longer active.'], 403);
        }

        if (!in_array($user->role, self::WEB_OTP_ROLES, true)) {
            // Role changed between step 1 and step 2 — bail out cleanly.
            return response()->json(['message' => 'This account is not authorized for web login.'], 403);
        }

        $otp->update(['consumed_at' => now()]);

        return $this->issueToken($user, 'Login successful');
    }

    /* ==================================================================
     |  LOGOUT
     ================================================================== */

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out successfully']);
    }

    /* ==================================================================
     |  PROFILE
     ================================================================== */

    public function profile(Request $request)
    {
        $user = $request->user();
        $face = Face::where('user_id', $user->user_id)->first();

        return response()->json($this->formatUser($user, $face));
    }

    /* ==================================================================
     |  HELPERS
     ================================================================== */

    private function issueToken(User $user, string $message = 'Login successful')
    {
        $face = Face::where('user_id', $user->user_id)->first();
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message'    => $message,
            'user'       => $this->formatUser($user, $face),
            'token'      => $token,
            'token_type' => 'Bearer',
        ]);
    }

    private function formatUser(User $user, ?Face $face = null): array
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
            'face_encoding'       => $face?->encoding,
        ];
    }

    /**
     * "john.doe@temu.gov.ph" → "j***e@temu.gov.ph"
     */
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
}