<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class ProfileController extends Controller
{
    /**
     * Update basic profile details (name/phone).
     * PUT /api/profile
     */
    public function update(Request $request)
    {
        $validated = $request->validate([
            'firstname' => 'sometimes|string|min:1|max:120',
            'lastname'  => 'sometimes|string|min:1|max:120',
            'phone'     => 'nullable|string|max:30',
        ]);

        $user = $request->user();
        $user->fill($validated);
        $user->save();

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user'    => $this->formatUser($user->fresh()),
        ]);
    }

    /**
     * Upload / replace profile image.
     * POST /api/profile/image
     */
    public function uploadProfileImage(Request $request)
    {
        $request->validate([
            'profile_image' => 'required|image|mimes:jpg,jpeg,png,webp|max:5120',
        ]);

        $user = $request->user();

        try {
            if ($user->profile_image && Storage::disk('public')->exists($user->profile_image)) {
                Storage::disk('public')->delete($user->profile_image);
            }

            $path = $request->file('profile_image')->store('users', 'public');

            $user->profile_image = $path;
            $user->save();

            return response()->json([
                'message'           => 'Profile image updated successfully.',
                'profile_image'     => $path,
                'profile_image_url' => Storage::url($path),
                'user'              => $this->formatUser($user->fresh()),
            ]);
        } catch (\Throwable $e) {
            Log::error('Profile image upload failed: ' . $e->getMessage());

            return response()->json([
                'message' => 'Failed to upload profile image.',
            ], 500);
        }
    }

    /**
     * Remove profile image.
     * DELETE /api/profile/image
     */
    public function removeProfileImage(Request $request)
    {
        $user = $request->user();

        if ($user->profile_image && Storage::disk('public')->exists($user->profile_image)) {
            Storage::disk('public')->delete($user->profile_image);
        }

        $user->profile_image = null;
        $user->save();

        return response()->json([
            'message' => 'Profile image removed.',
            'user'    => $this->formatUser($user->fresh()),
        ]);
    }

    private function formatUser($user): array
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
            'face_encoding'       => \App\Models\Face::where('user_id', $user->user_id)
                ->value('encoding'),
        ];
    }
}
