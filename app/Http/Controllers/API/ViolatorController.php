<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Violator;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class ViolatorController extends Controller
{
    /* ==================================================================
     |  LIST
     ================================================================== */

    public function index(Request $request)
    {
        $perPage = (int) $request->get('per_page', 20);
        $page    = (int) $request->get('page', 1);

        $query = Violator::query()
            ->withCount(['tickets as violations_committed_count' => function ($q) {
                $q->where('is_archived', false);
            }])
            ->with(['tickets' => function ($q) {
                $q->where('is_archived', false)
                  ->with([
                      'enforcer:user_id,firstname,lastname',
                      'violations.violationType:violation_id,violation_name,fine_amount,demerit_points',
                  ])
                  ->orderByDesc('created_at');
            }]);

        $visibility = $request->get('visibility', 'active');
        if ($visibility === 'archived') {
            $query->archived();
        } elseif ($visibility !== 'all') {
            $query->active();
        }

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('firstname', 'like', "%{$s}%")
                    ->orWhere('middlename', 'like', "%{$s}%")
                    ->orWhere('lastname', 'like', "%{$s}%")
                    ->orWhere('license', 'like', "%{$s}%")
                    ->orWhere('email', 'like', "%{$s}%")
                    ->orWhere('contact_number', 'like', "%{$s}%")
                    ->orWhereHas('tickets', function ($tq) use ($s) {
                        $tq->where('is_archived', false)
                           ->whereHas('enforcer', function ($eq) use ($s) {
                               $eq->where('firstname', 'like', "%{$s}%")
                                  ->orWhere('lastname', 'like', "%{$s}%");
                           });
                    })
                    ->orWhereHas('tickets', function ($tq) use ($s) {
                        $tq->where('is_archived', false)
                           ->whereHas('violations.violationType', function ($vq) use ($s) {
                               $vq->where('violation_name', 'like', "%{$s}%");
                           });
                    });
            });
        }

        if ($request->filled('gender')) {
            $query->where('gender', $request->gender);
        }
        if ($request->filled('nationality')) {
            $query->where('nationality', 'like', '%' . $request->nationality . '%');
        }

        if ($request->filled('expiry_from')) {
            $query->whereDate('expiry', '>=', $request->expiry_from);
        }
        if ($request->filled('expiry_to')) {
            $query->whereDate('expiry', '<=', $request->expiry_to);
        }

        if ($request->filled('created_from')) {
            $query->whereDate('created_at', '>=', $request->created_from);
        }
        if ($request->filled('created_to')) {
            $query->whereDate('created_at', '<=', $request->created_to);
        }

        $violators = $query->orderBy('lastname')
            ->orderBy('firstname')
            ->paginate($perPage, ['*'], 'page', $page);

        $violators->getCollection()->transform(function ($v) {
            return $this->decorate($v);
        });

        return response()->json($violators);
    }

    /* ==================================================================
     |  SHOW — full detail for the row-click modal
     ================================================================== */

    public function show($id)
    {
        $violator = Violator::withCount(['tickets as violations_committed_count' => function ($q) {
                $q->where('is_archived', false);
            }])
            ->with(['tickets' => function ($q) {
                $q->where('is_archived', false)
                  ->with([
                      'enforcer:user_id,firstname,lastname,email',
                      'vehicle:vehicle_id,platenumber,make,model,color',
                      'violations.violationType:violation_id,violation_name,fine_amount,demerit_points',
                  ])
                  ->orderByDesc('created_at');
            }, 'archivedBy'])
            ->findOrFail($id);

        $decorated = $this->decorate($violator, /* keepTickets */ true);

        // Flatten to a rich payload for the modal.
        $tickets = $violator->tickets->map(function ($t) {
            return [
                'ticket_id'          => $t->ticket_id,
                'ticket_number'      => $t->ticket_number,
                'status'             => $t->status,
                'violation_datetime' => $t->violation_datetime,
                'location'           => $t->location,
                'enforcer_name'      => $t->enforcer
                    ? trim("{$t->enforcer->firstname} {$t->enforcer->lastname}")
                    : null,
                'vehicle_plate'      => $t->vehicle?->platenumber,
                'vehicle_make_model' => trim(
                    ($t->vehicle?->make ?? '') . ' ' . ($t->vehicle?->model ?? '')
                ) ?: null,
                'total_fine'         => (float) $t->violations->sum('fine_amount'),
                'violations'         => $t->violations->map(function ($tv) {
                    return [
                        'violation_name'  => $tv->violationType?->violation_name,
                        'fine_amount'     => (float) $tv->fine_amount,
                        'demerit_points'  => (int) $tv->demerit_points,
                    ];
                })->filter(fn($x) => $x['violation_name'])->values(),
            ];
        })->values();

        $totalFines = $tickets->sum('total_fine');
        $totalPoints = $violator->tickets->flatMap->violations->sum('demerit_points');

        $decorated['tickets']         = $tickets;
        $decorated['total_fines']     = (float) $totalFines;
        $decorated['total_points']    = (int) $totalPoints;
        $decorated['tickets_count']   = $tickets->count();

        return response()->json($decorated);
    }

    /**
     * Adds `ticketed_by`, `violation_names`, and count onto the model.
     */
    private function decorate(Violator $v, bool $keepTickets = false)
    {
        $latest = $v->tickets->first();

        $v->ticketed_by = $latest && $latest->enforcer
            ? trim("{$latest->enforcer->firstname} {$latest->enforcer->lastname}")
            : null;

        $names = [];
        foreach ($v->tickets as $ticket) {
            foreach ($ticket->violations as $tv) {
                $name = $tv->violationType?->violation_name;
                if ($name && !in_array($name, $names, true)) {
                    $names[] = $name;
                }
            }
        }

        $v->violation_names       = $names;
        $v->violation_names_count = count($names);

        if (!$keepTickets) {
            unset($v->tickets);
        }

        return $v;
    }

    public function searchByLicense($license)
    {
        return response()->json(
            Violator::where('license', 'like', "%{$license}%")->active()->get()
        );
    }

    /* ==================================================================
     |  STORE
     ================================================================== */

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

        $existing = Violator::where('license', $request->license)->first();
        if ($existing) {
            return response()->json([
                'message' => $existing->is_archived
                    ? 'This license belongs to an archived violator. Restore it to reuse.'
                    : 'Violator already exists',
                'violator' => $existing,
                'is_archived' => $existing->is_archived,
                'idempotent_replay' => !$existing->is_archived,
            ], 200);
        }

        $data = $request->except(['profile_photo']);

        if ($request->hasFile('profile_photo')) {
            $file = $request->file('profile_photo');
            $filename = 'violators/' . time() . '_' . \Illuminate\Support\Str::uuid() . '.' . $file->getClientOriginalExtension();
            $data['profile_photo'] = $file->storeAs('violators', basename($filename), 'public');
        } elseif ($request->filled('profile_photo') && is_string($request->profile_photo) && str_starts_with($request->profile_photo, 'data:image')) {
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
            NotificationService::notifyAdmins(
                'New Violator Registered',
                "{$name} (License: {$violator->license}) was added to the system",
                Notification::TYPE_VIOLATOR_CREATED,
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

    /* ==================================================================
     |  UPDATE
     ================================================================== */

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

        try {
            $name = trim("{$violator->firstname} {$violator->lastname}");
            $lastTicket = \App\Models\Ticket::where('violator_id', $id)
                ->orderBy('created_at', 'desc')
                ->first();

            if ($lastTicket && $lastTicket->enforcer_id) {
                NotificationService::notifyUser(
                    $lastTicket->enforcer_id,
                    'Violator Record Updated',
                    "{$name}'s information has been updated",
                    Notification::TYPE_VIOLATOR_UPDATED,
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

    /* ==================================================================
     |  ARCHIVE (replaces destroy)
     ================================================================== */

    public function destroy(Request $request, $id)
    {
        $violator = Violator::findOrFail($id);

        if ($violator->is_archived) {
            return response()->json(['message' => 'Violator is already archived.'], 400);
        }

        try {
            $violator->archive($request->user()->user_id);

            try {
                $name = trim("{$violator->firstname} {$violator->lastname}");
                $actor = $request->user();
                $actorName = trim("{$actor->firstname} {$actor->lastname}");

                NotificationService::notifyAdmins(
                    'Violator Archived',
                    "{$actorName} archived violator {$name} (License: {$violator->license})",
                    Notification::TYPE_VIOLATOR_ARCHIVED,
                    'violator',
                    $violator->violator_id
                );
            } catch (\Throwable $ne) {
                Log::warning('Violator archive notification failed: ' . $ne->getMessage());
            }

            return response()->json([
                'message' => 'Violator archived successfully',
                'archived' => true,
                'violator' => $violator->fresh(),
            ]);
        } catch (\Throwable $e) {
            Log::error('Violator archive failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to archive violator'], 500);
        }
    }
}