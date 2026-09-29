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

class PasswordResetController extends Controller
{
    public function request(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $user = User::where('email', $request->email)->first();

        // Always return 200, even if the email isn't registered. This
        // prevents an attacker from probing which emails exist.
        if (!$user) {
            return response()->json([
                'message' => 'If that email is registered, a reset code has been sent.',
            ]);
        }

        if (!$user->is_active) {
            return response()->json([
                'message' => 'If that email is registered, a reset code has been sent.',
            ]);
        }

        $recentUserCount = OtpCode::recentRequestCount(
            $user->user_id,
            OtpCode::PURPOSE_PASSWORD_RESET,
            15,
        );
        if ($recentUserCount >= 3) {
            return response()->json([
                'message' => 'Too many reset codes requested. Please wait a few minutes and try again.',
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
                OtpCode::PURPOSE_PASSWORD_RESET,
                $ip,
                $request->userAgent(),
            );

            Mail::to($user->email)->send(new OtpCodeMail(
                $user,
                $code,
                OtpCode::PURPOSE_PASSWORD_RESET,
                OtpCode::TTL_MINUTES,
            ));
        } catch (\Throwable $e) {
            Log::error('Password reset OTP issue failed: ' . $e->getMessage());
            return response()->json([
                'message' => 'Could not send reset code. Please try again.',
            ], 500);
        }

        return response()->json([
            'message'      => 'Reset code sent',
            'challenge_id' => $challengeId,
            'masked_email' => $this->maskEmail($user->email),
            'expires_in'   => OtpCode::TTL_MINUTES * 60,
        ]);
    }

    public function verify(Request $request)
    {
        $request->validate([
            'challenge_id' => 'required|string|size:40',
            'code'         => 'required|string|size:6',
            'password'     => 'required|string|min:8|confirmed',
        ]);

        $otp = OtpCode::where('challenge_id', $request->challenge_id)
            ->where('purpose', OtpCode::PURPOSE_PASSWORD_RESET)
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
        if (!$user) {
            return response()->json(['message' => 'Account no longer exists.'], 422);
        }

        DB::beginTransaction();
        try {
            $user->password_hash = Hash::make($request->password);
            $user->temp_password = null;
            $user->save();

            // Invalidate every session + every other outstanding reset code.
            $user->tokens()->delete();
            $otp->update(['consumed_at' => now()]);
            OtpCode::invalidatePrevious($user->user_id, OtpCode::PURPOSE_PASSWORD_RESET);

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Password reset failed: ' . $e->getMessage());
            return response()->json(['message' => 'Could not reset password. Please try again.'], 500);
        }

        return response()->json([
            'message' => 'Password reset successfully. You can now sign in.',
        ]);
    }

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