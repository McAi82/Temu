<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Models\TicketViolation;
use App\Models\Violator;
use App\Models\ViolationType;
use App\Models\RepeatOffender;
use App\Models\Setting;
use App\Services\NotificationService;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;

class TicketController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->get('per_page', 20);
        $page = $request->get('page', 1);

        $tickets = Ticket::with(['violator', 'vehicle', 'enforcer', 'violations.violationType'])
            ->orderBy('created_at', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);

        $tickets->getCollection()->each(function ($ticket) {
            $ticket->total_fine = $ticket->violations ? $ticket->violations->sum('fine_amount') : 0;
            $ticket->qr_code_url = $ticket->qr_code ? Storage::url($ticket->qr_code) : null;
        });

        return response()->json($tickets);
    }

    public function show($id)
    {
        $ticket = Ticket::with(['violator', 'vehicle', 'enforcer', 'violations.violationType'])
            ->findOrFail($id);

        $ticket->total_fine = $ticket->violations ? $ticket->violations->sum('fine_amount') : 0;
        $ticket->qr_code_url = $ticket->qr_code ? Storage::url($ticket->qr_code) : null;

        return response()->json($ticket);
    }

    public function publicShow($ticketNumber)
    {
        $ticket = Ticket::with(['violator', 'vehicle', 'enforcer', 'violations.violationType'])
            ->where('ticket_number', $ticketNumber)
            ->first();

        if (!$ticket) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }

        $ticket->total_fine = $ticket->violations ? $ticket->violations->sum('fine_amount') : 0;
        $ticket->qr_code_url = $ticket->qr_code ? Storage::url($ticket->qr_code) : null;

        return response()->json($ticket);
    }

    /**
     * Generate the next ticket number for today.
     * MUST be called inside a DB transaction with a lock on today's rows.
     */
    private function generateTicketNumber(): string
    {
        $date = now()->format('Ymd');

        $lastTicket = Ticket::whereDate('created_at', now()->toDateString())
            ->lockForUpdate()
            ->orderBy('ticket_id', 'desc')
            ->first();

        if ($lastTicket) {
            $lastNumber = intval(substr($lastTicket->ticket_number, -4));
            $newNumber = str_pad($lastNumber + 1, 4, '0', STR_PAD_LEFT);
        } else {
            $newNumber = '0001';
        }

        return "TKT-{$date}-{$newNumber}";
    }

    public function saveQRCode(Request $request, $id)
    {
        try {
            Log::info('📝 QR Code save request for ticket: ' . $id);

            $ticket = Ticket::find($id);
            if (!$ticket) {
                return response()->json(['message' => 'Ticket not found'], 404);
            }

            $validator = Validator::make($request->all(), [
                'qr_image' => 'required|string',
            ]);

            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }

            $qrImage = $request->qr_image;
            if (strpos($qrImage, 'data:image/png;base64,') === 0) {
                $qrImage = substr($qrImage, strpos($qrImage, ',') + 1);
            }
            $qrImage = str_replace(' ', '+', $qrImage);
            $qrImage = trim($qrImage);

            $qrData = base64_decode($qrImage);
            if ($qrData === false || empty($qrData)) {
                return response()->json(['message' => 'Invalid QR code data'], 400);
            }

            $directory = storage_path('app/public/qrcodes');
            if (!file_exists($directory)) {
                mkdir($directory, 0777, true);
            }

            $filename = 'qrcodes/' . $ticket->ticket_number . '.png';
            $fullPath = storage_path('app/public/' . $filename);

            if (file_put_contents($fullPath, $qrData) === false) {
                return response()->json(['message' => 'Failed to save QR code file'], 500);
            }

            $ticket->qr_code = $filename;
            $ticket->save();

            return response()->json([
                'message' => 'QR Code saved successfully',
                'qr_code_url' => Storage::url($filename),
            ]);
        } catch (\Exception $e) {
            Log::error('❌ Error saving QR Code: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to save QR Code: ' . $e->getMessage()
            ], 500);
        }
    }

    public function store(Request $request)
    {
        if ($request->user()->role !== 'enforcer') {
            return response()->json(['message' => 'Only enforcers can create tickets'], 403);
        }

        $validator = Validator::make($request->all(), [
            'violator_id' => 'required|exists:violators,violator_id',
            'vehicle_id' => 'required|exists:vehicles,vehicle_id',
            'violation_ids' => 'required|array|min:1',
            'violation_ids.*' => 'exists:violation_types,violation_id',
            'location' => 'required|string',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'violation_datetime' => 'required|date',
            'remarks' => 'nullable|string',
            'idempotency_key' => 'nullable|string|max:64',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // IDEMPOTENCY: if the client sends an idempotency key and we
        // already have a ticket for it, return that ticket unchanged.
        // This makes offline sync retries safe.
        if ($request->filled('idempotency_key')) {
            $existing = Ticket::where('idempotency_key', $request->idempotency_key)
                ->with(['violator', 'vehicle', 'violations.violationType'])
                ->first();
            if ($existing) {
                $existing->total_fine = $existing->violations
                    ? $existing->violations->sum('fine_amount')
                    : 0;
                return response()->json([
                    'message' => 'Ticket already created',
                    'ticket' => $existing,
                    'idempotent_replay' => true,
                ], 200);
            }
        }

        $attempts = 0;
        $maxAttempts = 3;

        beginning:
        $attempts++;
        DB::beginTransaction();

        try {
            $ticketNumber = $this->generateTicketNumber();

            $ticket = Ticket::create([
                'ticket_number' => $ticketNumber,
                'idempotency_key' => $request->idempotency_key,
                'violator_id' => $request->violator_id,
                'vehicle_id' => $request->vehicle_id,
                'enforcer_id' => $request->user()->user_id,
                'location' => $request->location,
                'latitude' => $request->latitude,
                'longitude' => $request->longitude,
                'violation_datetime' => $request->violation_datetime,
                'remarks' => $request->remarks,
                'status' => 'issued',
            ]);

            foreach ($request->violation_ids as $violationId) {
                $violationType = ViolationType::find($violationId);
                TicketViolation::create([
                    'ticket_id' => $ticket->ticket_id,
                    'violation_id' => $violationId,
                    'fine_amount' => $violationType ? $violationType->fine_amount : 0,
                    'demerit_points' => $violationType ? $violationType->demerit_points : 0,
                ]);
            }

            $this->updateRepeatOffender($request->violator_id);

            DB::commit();

            $ticket->load(['violator', 'vehicle', 'violations.violationType']);
            $ticket->total_fine = $ticket->violations
                ? $ticket->violations->sum('fine_amount')
                : 0;

            try {
                $enforcer = $request->user();
                $violatorName = $ticket->violator
                    ? trim("{$ticket->violator->firstname} {$ticket->violator->lastname}")
                    : 'Unknown';
                $fine = number_format($ticket->total_fine, 2);

                NotificationService::notifyUser(
                    $enforcer->user_id,
                    'Ticket Issued',
                    "Ticket {$ticket->ticket_number} issued to {$violatorName}. Fine: ₱{$fine}",
                    Notification::TYPE_TICKET_CREATED,
                    'ticket',
                    $ticket->ticket_id
                );

                NotificationService::notifyAdminStaff(
                    'New Ticket Issued',
                    "{$enforcer->firstname} {$enforcer->lastname} issued {$ticket->ticket_number} ({$violatorName})",
                    Notification::TYPE_TICKET_CREATED,
                    'ticket',
                    $ticket->ticket_id
                );
            } catch (\Throwable $ne) {
                Log::warning('Notification error on ticket store: ' . $ne->getMessage());
            }

            return response()->json([
                'message' => 'Ticket created successfully',
                'ticket' => $ticket,
            ], 201);

        } catch (\Illuminate\Database\QueryException $e) {
            DB::rollBack();

            // Duplicate ticket_number (SQLSTATE 23000) → retry with a
            // fresh sequence read.
            if ($attempts < $maxAttempts && $e->getCode() === '23000') {
                usleep(50000 * $attempts);
                goto beginning;
            }

            Log::error('Ticket creation failed after retries: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to create ticket'], 500);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Ticket creation failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to create ticket'], 500);
        }
    }

    private function updateRepeatOffender($violatorId)
    {
        $violator = Violator::find($violatorId);
        if (!$violator) {
            return;
        }

        $tickets = Ticket::where('violator_id', $violatorId)->get();
        $totalViolations = $tickets->count();

        $ticketIds = $tickets->pluck('ticket_id');
        $ticketViolations = TicketViolation::whereIn('ticket_id', $ticketIds)->get();

        $totalDemeritPoints = $ticketViolations->sum('demerit_points');
        $totalFines = $ticketViolations->sum('fine_amount');

        $repeatOffender = RepeatOffender::updateOrCreate(
            ['violator_id' => $violatorId],
            [
                'total_violations' => $totalViolations,
                'total_demerit_points' => $totalDemeritPoints,
                'total_fines' => $totalFines,
                'last_violation_date' => now(),
            ]
        );

        $threshold = Setting::where('setting_key', 'repeat_offender_threshold')->first();
        $thresholdValue = $threshold ? intval($threshold->setting_value) : 3;

        if ($totalViolations >= $thresholdValue && !$repeatOffender->is_flagged) {
            $repeatOffender->update([
                'is_flagged' => true,
                'flag_reason' => "Exceeded {$thresholdValue} violation(s)",
            ]);

            try {
                $name = trim("{$violator->firstname} {$violator->lastname}");
                NotificationService::notifyAdmins(
                    'Repeat Offender Flagged',
                    "{$name} has been flagged with {$totalViolations} total violations",
                    Notification::TYPE_REPEAT_OFFENDER,
                    'violator',
                    $violator->violator_id
                );
            } catch (\Throwable $ne) {
                Log::warning('Repeat offender notification failed: ' . $ne->getMessage());
            }
        }
    }

    public function updateStatus(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:issued,paid,contested,dismissed,partial_paid'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $ticket = Ticket::findOrFail($id);
        $oldStatus = $ticket->status;
        $newStatus = $request->status;

        $ticket->update(['status' => $newStatus]);

        try {
            if ($oldStatus !== $newStatus) {
                $enforcerId = $ticket->enforcer_id;

                switch ($newStatus) {
                    case 'paid':
                        NotificationService::notifyUser(
                            $enforcerId,
                            'Ticket Paid',
                            "Ticket {$ticket->ticket_number} has been paid",
                            Notification::TYPE_TICKET_PAID,
                            'ticket',
                            $ticket->ticket_id
                        );
                        break;

                    case 'contested':
                        NotificationService::notifyUser(
                            $enforcerId,
                            'Ticket Contested',
                            "Ticket {$ticket->ticket_number} has been contested",
                            Notification::TYPE_TICKET_CONTESTED,
                            'ticket',
                            $ticket->ticket_id
                        );
                        NotificationService::notifyAdminStaff(
                            'Ticket Needs Adjudication',
                            "Ticket {$ticket->ticket_number} was contested and needs review",
                            Notification::TYPE_TICKET_CONTESTED,
                            'ticket',
                            $ticket->ticket_id
                        );
                        break;

                    case 'dismissed':
                        NotificationService::notifyUser(
                            $enforcerId,
                            'Ticket Dismissed',
                            "Ticket {$ticket->ticket_number} has been dismissed",
                            Notification::TYPE_TICKET_DISMISSED,
                            'ticket',
                            $ticket->ticket_id
                        );
                        break;

                    case 'partial_paid':
                        NotificationService::notifyUser(
                            $enforcerId,
                            'Ticket Partially Paid',
                            "Ticket {$ticket->ticket_number} has been partially paid",
                            Notification::TYPE_TICKET_PARTIAL_PAID,
                            'ticket',
                            $ticket->ticket_id
                        );
                        break;
                }
            }
        } catch (\Throwable $ne) {
            Log::warning('Ticket status notification failed: ' . $ne->getMessage());
        }

        return response()->json([
            'message' => 'Ticket status updated successfully',
            'ticket' => $ticket
        ]);
    }

    public function destroy($id)
    {
        $ticket = Ticket::findOrFail($id);

        if ($ticket->qr_code && Storage::disk('public')->exists($ticket->qr_code)) {
            Storage::disk('public')->delete($ticket->qr_code);
        }

        $ticketNumber = $ticket->ticket_number;
        $enforcerId = $ticket->enforcer_id;
        $ticketId = $ticket->ticket_id;

        $ticket->delete();

        try {
            NotificationService::notifyUser(
                $enforcerId,
                'Ticket Deleted',
                "Ticket {$ticketNumber} was deleted by an administrator",
                Notification::TYPE_TICKET_DELETED,
                'ticket',
                $ticketId
            );
        } catch (\Throwable $ne) {
            Log::warning('Ticket delete notification failed: ' . $ne->getMessage());
        }

        return response()->json([
            'message' => 'Ticket deleted successfully'
        ]);
    }

    public function getMyTickets(Request $request)
    {
        $tickets = Ticket::with(['violator', 'vehicle', 'violations.violationType'])
            ->where('enforcer_id', $request->user()->user_id)
            ->orderBy('created_at', 'desc')
            ->get();

        $tickets->each(function ($ticket) {
            $ticket->total_fine = $ticket->violations
                ? $ticket->violations->sum('fine_amount')
                : 0;
            $ticket->qr_code_url = $ticket->qr_code ? Storage::url($ticket->qr_code) : null;
        });

        return response()->json($tickets);
    }

    public function search(Request $request)
    {
        $query = Ticket::with(['violator', 'vehicle', 'violations.violationType']);

        if ($request->has('ticket_number')) {
            $query->where('ticket_number', 'like', "%{$request->ticket_number}%");
        }

        if ($request->has('plate_number')) {
            $query->whereHas('vehicle', function ($q) use ($request) {
                $q->where('platenumber', 'like', "%{$request->plate_number}%");
            });
        }

        if ($request->has('violator_name')) {
            $query->whereHas('violator', function ($q) use ($request) {
                $q->where('firstname', 'like', "%{$request->violator_name}%")
                    ->orWhere('lastname', 'like', "%{$request->violator_name}%");
            });
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('date_from') && $request->has('date_to')) {
            $query->whereBetween('violation_datetime', [$request->date_from, $request->date_to]);
        }

        $tickets = $query->orderBy('created_at', 'desc')->get();

        $tickets->each(function ($ticket) {
            $ticket->total_fine = $ticket->violations
                ? $ticket->violations->sum('fine_amount')
                : 0;
            $ticket->qr_code_url = $ticket->qr_code ? Storage::url($ticket->qr_code) : null;
        });

        return response()->json($tickets);
    }

    public function statistics()
    {
        try {
            $totalTickets = Ticket::count();
            $paidTickets = Ticket::where('status', 'paid')->count();
            $issuedTickets = Ticket::where('status', 'issued')->count();
            $contestedTickets = Ticket::where('status', 'contested')->count();
            $dismissedTickets = Ticket::where('status', 'dismissed')->count();

            $totalFines = DB::table('ticket_violations')->sum('fine_amount');

            $collectedFines = DB::table('ticket_violations')
                ->join('tickets', 'ticket_violations.ticket_id', '=', 'tickets.ticket_id')
                ->where('tickets.status', 'paid')
                ->sum('ticket_violations.fine_amount');

            $collectionRate = $totalFines > 0
                ? round(($collectedFines / $totalFines) * 100, 2)
                : 0;

            $monthlyData = DB::select("
                SELECT 
                    DATE_FORMAT(created_at, '%b %Y') as name,
                    COUNT(*) as tickets
                FROM tickets
                WHERE created_at IS NOT NULL
                GROUP BY DATE_FORMAT(created_at, '%b %Y')
                ORDER BY MIN(created_at) DESC
                LIMIT 6
            ");
            $monthlyData = array_reverse($monthlyData);

            return response()->json([
                'total_tickets' => (int) $totalTickets,
                'paid_tickets' => (int) $paidTickets,
                'issued_tickets' => (int) $issuedTickets,
                'contested_tickets' => (int) $contestedTickets,
                'dismissed_tickets' => (int) $dismissedTickets,
                'total_fines' => (float) $totalFines,
                'collected_fines' => (float) $collectedFines,
                'collection_rate' => (float) $collectionRate,
                'tickets_by_month' => $monthlyData,
            ]);
        } catch (\Exception $e) {
            Log::error('Statistics error: ' . $e->getMessage());
            return response()->json([
                'total_tickets' => Ticket::count(),
                'paid_tickets' => Ticket::where('status', 'paid')->count(),
                'issued_tickets' => Ticket::where('status', 'issued')->count(),
                'contested_tickets' => Ticket::where('status', 'contested')->count(),
                'dismissed_tickets' => Ticket::where('status', 'dismissed')->count(),
                'total_fines' => DB::table('ticket_violations')->sum('fine_amount'),
                'collected_fines' => 0,
                'collection_rate' => 0,
                'tickets_by_month' => [],
            ]);
        }
    }

    public function publicShowHtml($ticketNumber)
    {
        $ticket = Ticket::with(['violator', 'vehicle', 'enforcer', 'violations.violationType'])
            ->where('ticket_number', $ticketNumber)
            ->first();

        if (!$ticket) {
            return response()->view('tickets.not-found', [], 404);
        }

        $ticket->total_fine = $ticket->violations
            ? $ticket->violations->sum('fine_amount')
            : 0;

        return view('tickets.public', compact('ticket'));
    }
}