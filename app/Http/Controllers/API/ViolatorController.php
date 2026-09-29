<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Violator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class ViolatorController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->get('per_page', 20);
        $page = $request->get('page', 1);

        $violators = Violator::orderBy('created_at', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);

        return response()->json($violators);
    }

    public function show($id)
    {
        $violator = Violator::findOrFail($id);
        return response()->json($violator);
    }

    public function destroy($id)
    {
        $violator = Violator::findOrFail($id);

        if ($violator->profile_photo && Storage::disk('public')->exists($violator->profile_photo)) {
            Storage::disk('public')->delete($violator->profile_photo);
        }

        $violator->delete();

        return response()->json([
            'message' => 'Violator deleted successfully'
        ]);
    }

    public function searchByLicense($license)
    {
        $violator = Violator::where('license', 'like', "%{$license}%")->get();
        return response()->json($violator);
    }

    public function store(Request $request)
{
    $validator = Validator::make($request->all(), [
        'firstname' => 'required|string|max:50',
        'lastname' => 'required|string|max:50',
        'license' => 'required|string',
        'expiry' => 'required|date',
        'birthday' => 'required|date',
        'profile_photo' => 'nullable',
    ]);

    if ($validator->fails()) {
        return response()->json(['errors' => $validator->errors()], 422);
    }

    // IDEMPOTENCY: If a violator with this license already exists,
    // return it with 200 instead of erroring. This makes offline
    // sync retries safe — the mobile client treats 200-with-resource
    // the same as 201-created.
    $existing = Violator::where('license', $request->license)->first();
    if ($existing) {
        return response()->json([
            'message' => 'Violator already exists',
            'violator' => $existing,
            'idempotent_replay' => true,
        ], 200);
    }

    $data = $request->except(['profile_photo']);

    if ($request->hasFile('profile_photo')) {
        $file = $request->file('profile_photo');
        $filename = 'violators/' . time() . '_' . \Illuminate\Support\Str::uuid() . '.' . $file->getClientOriginalExtension();
        $data['profile_photo'] = $file->storeAs('violators', basename($filename), 'public');
    } elseif ($request->filled('profile_photo') && is_string($request->profile_photo) && str_starts_with($request->profile_photo, 'data:image')) {
        // Mobile sync sends base64 data URIs in a FormData field.
        $imageData = $request->profile_photo;
        if (preg_match('/^data:image\/(\w+);base64,/', $imageData, $type)) {
            $imageData = substr($imageData, strpos($imageData, ',') + 1);
            $type = strtolower($type[1]);
        }
        $allowedTypes = ['jpg', 'jpeg', 'png', 'gif'];
        $extension = in_array($type ?? 'jpg', $allowedTypes) ? $type : 'jpg';
        $fileName = 'violators/' . time() . '_' . \Illuminate\Support\Str::uuid() . '.' . $extension;
        Storage::disk('public')->put($fileName, base64_decode($imageData));
        $data['profile_photo'] = $fileName;
    }

    $violator = Violator::create($data);

    try {
        $name = trim("{$violator->firstname} {$violator->lastname}");
        \App\Services\NotificationService::notifyAdmins(
            'New Violator Registered',
            "{$name} (License: {$violator->license}) was added to the system",
            \App\Models\Notification::TYPE_VIOLATOR_CREATED,
            'violator',
            $violator->violator_id
        );
    } catch (\Throwable $ne) {
        Log::warning('Violator creation notification failed: ' . $ne->getMessage());
    }

    return response()->json([
        'message' => 'Violator created successfully',
        'violator' => $violator,
    ], 201);
}

public function update(Request $request, $id)
{
    $violator = Violator::findOrFail($id);

    $validator = Validator::make($request->all(), [
        'license' => 'sometimes|string|unique:violators,license,' . $id . ',violator_id',
        'profile_photo' => 'nullable|image|mimes:jpeg,png,jpg|max:2048',
    ]);

    if ($validator->fails()) {
        return response()->json(['errors' => $validator->errors()], 422);
    }

    $data = $request->all();

    if ($request->hasFile('profile_photo')) {
        if ($violator->profile_photo && Storage::disk('public')->exists($violator->profile_photo)) {
            Storage::disk('public')->delete($violator->profile_photo);
        }
        $file = $request->file('profile_photo');
        $filename = time() . '_' . $file->getClientOriginalName();
        $data['profile_photo'] = $file->storeAs('violators', $filename, 'public');
    }

    $violator->update($data);

    // =============== NOTIFICATION: Violator Updated ===============
    try {
        $name = trim("{$violator->firstname} {$violator->lastname}");

        // Notify the enforcer who most recently ticketed this violator
        $lastTicket = \App\Models\Ticket::where('violator_id', $id)
            ->orderBy('created_at', 'desc')
            ->first();

        if ($lastTicket && $lastTicket->enforcer_id) {
            \App\Services\NotificationService::notifyUser(
                $lastTicket->enforcer_id,
                'Violator Record Updated',
                "{$name}'s information has been updated",
                \App\Models\Notification::TYPE_VIOLATOR_UPDATED,
                'violator',
                $violator->violator_id
            );
        }
    } catch (\Throwable $ne) {
        Log::warning('Violator update notification failed: ' . $ne->getMessage());
    }

    return response()->json([
        'message' => 'Violator updated successfully',
        'violator' => $violator
    ]);
}

}