<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Face;
use App\Models\Notification;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use App\Mail\UserCreatedMail;
use App\Mail\PasswordResetMail;
use Illuminate\Support\Facades\Log;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $perPage = (int) $request->get('per_page', 20);
        $page    = (int) $request->get('page', 1);

        $query = User::query();

        // ---- Role filter (used by DutyMap / Schedule picker) ----
        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }

        // ---- Search across name, email, role, contact ----
        if ($request->filled('search')) {
            $term = '%' . $request->search . '%';
            $query->where(function ($q) use ($term) {
                $q->where('firstname', 'like', $term)
                    ->orWhere('middlename', 'like', $term)
                    ->orWhere('lastname', 'like', $term)
                    ->orWhere('email', 'like', $term)
                    ->orWhere('role', 'like', $term)
                    ->orWhere('contact_number', 'like', $term);
            });
        }

        // ---- Sort (whitelisted columns only) ----
        $sortable = ['lastname', 'firstname', 'email', 'role', 'created_at'];
        $sortBy  = in_array($request->get('sort_by'), $sortable, true)
            ? $request->get('sort_by')
            : 'lastname';
        $sortDir = strtolower($request->get('sort_dir', 'asc')) === 'desc'
            ? 'desc'
            : 'asc';

        $query->orderBy($sortBy, $sortDir)
            ->orderBy('firstname', 'asc'); // tie-breaker

        return response()->json(
            $query->paginate($perPage, ['*'], 'page', $page)
        );
    }

    public function show($id)
    {
        return response()->json(User::findOrFail($id));
    }

    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'email' => 'sometimes|email|unique:users,email,' . $id . ',user_id',
            'firstname' => 'sometimes|string|max:50',
            'middlename' => 'sometimes|string|max:50',
            'lastname' => 'sometimes|string|max:50',
            'role' => 'sometimes|in:admin,staff,enforcer',
            'contact_number' => 'nullable|string|max:20',
            'profile_image' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $updateData = [];
        foreach (['email', 'firstname', 'middlename', 'lastname', 'role', 'contact_number'] as $field) {
            if ($request->has($field)) $updateData[$field] = $request->$field;
        }

        if ($request->hasFile('profile_image')) {
            if ($user->profile_image && Storage::disk('public')->exists($user->profile_image)) {
                Storage::disk('public')->delete($user->profile_image);
            }
            $file = $request->file('profile_image');
            $filename = time() . '_' . Str::uuid() . '.' . $file->getClientOriginalExtension();
            $updateData['profile_image'] = $file->storeAs('users', $filename, 'public');
        }

        $user->update($updateData);
        $user->refresh();

        return response()->json([
            'message' => 'User updated successfully',
            'user' => $user,
            'profile_image_url' => $user->profile_image
                ? Storage::url($user->profile_image)
                : null,
        ]);
    }

    public function destroy($id)
    {
        $user = User::findOrFail($id);
        if ($user->profile_image && Storage::disk('public')->exists($user->profile_image)) {
            Storage::disk('public')->delete($user->profile_image);
        }
        Face::where('user_id', $id)->delete();
        $user->delete();
        return response()->json(['message' => 'User deleted successfully']);
    }

    public function toggleStatus($id)
    {
        $user = User::findOrFail($id);
        if ($user->user_id === auth()->user()->user_id) {
            return response()->json(['message' => 'Cannot deactivate your own account'], 403);
        }

        $user->is_active = !$user->is_active;
        $user->save();

        try {
            $type = $user->is_active
                ? Notification::TYPE_USER_ACTIVATED
                : Notification::TYPE_USER_DEACTIVATED;

            NotificationService::notifyUser(
                $user->user_id,
                $user->is_active ? 'Account Reactivated' : 'Account Deactivated',
                $user->is_active
                    ? 'Your account has been reactivated. You can log in again.'
                    : 'Your account has been deactivated. Contact an administrator.',
                $type,
                'user',
                $user->user_id
            );
        } catch (\Throwable $ne) {
            Log::warning('Status toggle notification failed: ' . $ne->getMessage());
        }

        return response()->json([
            'message' => $user->is_active ? 'User activated' : 'User deactivated',
            'user' => $user,
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|unique:users,email',
            'firstname' => 'required|string|max:50',
            'lastname' => 'required|string|max:50',
            'role' => 'required|in:admin,staff,enforcer',
            'contact_number' => 'nullable|string|max:20',
            'profile_image' => 'nullable|image|mimes:jpeg,png,jpg|max:2048',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $plainPassword = substr(
            str_shuffle('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'),
            0,
            8,
        );

        $userData = [
            'email' => $request->email,
            'password_hash' => Hash::make($plainPassword),
            'firstname' => $request->firstname,
            'middlename' => $request->middlename,
            'lastname' => $request->lastname,
            'role' => $request->role,
            'contact_number' => $request->contact_number,
            'is_active' => true,
        ];

        if ($request->hasFile('profile_image')) {
            $file = $request->file('profile_image');
            $filename = time() . '_' . Str::uuid() . '.' . $file->getClientOriginalExtension();
            $userData['profile_image'] = $file->storeAs('users', $filename, 'public');
        }

        $user = User::create($userData);

        // ---- Send the welcome email (best-effort, non-blocking) ----
        $emailSent = false;
        $emailError = null;

        try {
            Mail::to($user->email)->send(new UserCreatedMail($user, $plainPassword));
            $emailSent = true;
        } catch (\Throwable $e) {
            $emailError = 'Could not deliver the welcome email. Please hand the credentials to the user manually.';
            Log::error('Failed to send welcome email to ' . $user->email . ': ' . $e->getMessage());
        }

        // ---- In-app notifications (never block the response) ----
        try {
            $fullName = trim("{$user->firstname} {$user->lastname}");
            $roleLabel = ucfirst($user->role);

            NotificationService::notifyUser(
                $user->user_id,
                'Welcome to TEMU',
                "Your {$roleLabel} account has been created. Check your email for login credentials.",
                Notification::TYPE_USER_CREATED,
                'user',
                $user->user_id
            );

            NotificationService::notifyAdmins(
                'New User Created',
                "{$fullName} ({$roleLabel}) has been added to the system",
                Notification::TYPE_USER_CREATED,
                'user',
                $user->user_id
            );
        } catch (\Throwable $ne) {
            Log::warning('User creation notification failed: ' . $ne->getMessage());
        }

        return response()->json([
            'message' => 'User created successfully',
            'user' => $user,
            'generated_password' => $plainPassword,
            'email_sent' => $emailSent,
            'email_error' => $emailError,
        ], 201);
    }

    public function resetPassword($id)
    {
        $user = User::findOrFail($id);

        $newPassword = substr(
            str_shuffle('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'),
            0,
            8,
        );

        $user->password_hash = Hash::make($newPassword);
        $user->save();

        $emailSent = false;
        $emailError = null;

        try {
            Mail::to($user->email)->send(new PasswordResetMail($user, $newPassword));
            $emailSent = true;
        } catch (\Throwable $e) {
            $emailError = 'Could not deliver the password reset email. Please hand the new password to the user manually.';
            Log::error('Failed to send password reset email to ' . $user->email . ': ' . $e->getMessage());
        }

        try {
            NotificationService::notifyUser(
                $user->user_id,
                'Password Reset',
                'Your password has been reset by an administrator. Check your email.',
                Notification::TYPE_PASSWORD_RESET,
                'user',
                $user->user_id
            );
        } catch (\Throwable $ne) {
            Log::warning('Password reset notification failed: ' . $ne->getMessage());
        }

        return response()->json([
            'message' => 'Password reset successfully',
            'new_password' => $newPassword,
            'email' => $user->email,
            'email_sent' => $emailSent,
            'email_error' => $emailError,
        ]);
    }
}
