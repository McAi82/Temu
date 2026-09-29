<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Payment;
use App\Models\Ticket;
use App\Models\TicketViolation;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class PaymentController extends Controller
{
    /**
     * GET /api/payments
     * Paginated list for staff/admin. Optional filters:
     *   - ticket_number (partial match)
     *   - status (payment_status: pending|completed|failed|refunded)
     *   - date_from, date_to
     */
    public function index(Request $request)
    {
        $perPage = (int) $request->get('per_page', 20);
        $page    = (int) $request->get('page', 1);

        $query = Payment::with([
            'ticket.violator',
            'ticket.vehicle',
            'ticket.enforcer',
        ]);

        if ($request->filled('status')) {
            $query->where('payment_status', $request->status);
        }

        if ($request->filled('ticket_number')) {
            $query->whereHas('ticket', function ($q) use ($request) {
                $q->where('ticket_number', 'like', '%' . $request->ticket_number . '%');
            });
        }

        if ($request->filled('date_from')) {
            $query->whereDate('payment_date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('payment_date', '<=', $request->date_to);
        }

        $payments = $query->orderBy('payment_date', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);

        return response()->json($payments);
    }

    public function pending(Request $request)
{
    $perPage = (int) $request->get('per_page', 20);
    $page    = (int) $request->get('page', 1);

    $query = Ticket::with(['violator', 'vehicle', 'enforcer', 'violations.violationType', 'payments'])
        ->whereIn('status', ['issued', 'partial_paid']);

    if ($request->filled('ticket_number')) {
        $query->where('ticket_number', 'like', '%' . $request->ticket_number . '%');
    }

    if ($request->filled('search')) {
        $search = $request->search;
        $query->where(function ($q) use ($search) {
            $q->where('ticket_number', 'like', "%{$search}%")
                ->orWhereHas('violator', function ($vq) use ($search) {
                    $vq->where('firstname', 'like', "%{$search}%")
                        ->orWhere('lastname', 'like', "%{$search}%")
                        ->orWhere('license', 'like', "%{$search}%");
                })
                ->orWhereHas('vehicle', function ($vq) use ($search) {
                    $vq->where('platenumber', 'like', "%{$search}%");
                });
        });
    }

    $tickets = $query->orderBy('created_at', 'desc')
        ->paginate($perPage, ['*'], 'page', $page);

    // Attach computed totals so the front-end can display balance and
    // pre-fill the next payment amount.
    $tickets->getCollection()->each(function ($ticket) {
        $totalFine = (float) $ticket->violations->sum('fine_amount');
        $totalPaid = (float) $ticket->payments
            ->where('payment_status', 'completed')
            ->sum('amount_paid');

        $ticket->total_fine    = $totalFine;
        $ticket->total_paid    = $totalPaid;
        $ticket->balance       = max(0, $totalFine - $totalPaid);
        $ticket->is_partial    = $ticket->status === 'partial_paid' || $totalPaid > 0;
    });

    return response()->json($tickets);
}

    /**
     * GET /api/payments/{id}
     */
    public function show($id)
    {
        $payment = Payment::with([
            'ticket.violator',
            'ticket.vehicle',
            'ticket.enforcer',
            'ticket.violations.violationType',
        ])->findOrFail($id);

        return response()->json($payment);
    }

    public function store(Request $request)
{
    $validator = Validator::make($request->all(), [
        'ticket_id'       => 'required|exists:tickets,ticket_id',
        'receipt_number'  => 'required|string|max:50',
        'amount_paid'     => 'required|numeric|min:0.01',
        'payment_method'  => 'required|in:cash,online_banking,gcash,maya,over_the_counter',
        'payment_date'    => 'nullable|date',
        'transaction_id'  => 'nullable|string|max:100',
        'paid_by'         => 'nullable|string|max:100',
        'notes'           => 'nullable|string',
    ]);

    if ($validator->fails()) {
        return response()->json([
            'message' => 'Validation failed',
            'errors'  => $validator->errors(),
        ], 422);
    }

    $receiptExists = Payment::where('receipt_number', $request->receipt_number)->exists();
    if ($receiptExists) {
        return response()->json([
            'message' => 'This receipt number has already been recorded.',
            'errors'  => ['receipt_number' => ['Receipt number already in use.']],
        ], 422);
    }

    $ticket = Ticket::with(['violator', 'vehicle', 'violations'])->find($request->ticket_id);

    if (!$ticket) {
        return response()->json(['message' => 'Ticket not found'], 404);
    }

    if (in_array($ticket->status, ['paid', 'dismissed'], true)) {
        return response()->json([
            'message' => "This ticket is already {$ticket->status} and cannot accept a new payment.",
        ], 422);
    }

    // ---- Compute totals, considering previous partial payments ----
    $totalFine      = (float) $ticket->violations->sum('fine_amount');
    $previouslyPaid = (float) Payment::where('ticket_id', $ticket->ticket_id)
        ->where('payment_status', 'completed')
        ->sum('amount_paid');

    $amountPaid     = (float) $request->amount_paid;
    $outstanding    = max(0, $totalFine - $previouslyPaid);
    $totalAfterThis = $previouslyPaid + $amountPaid;
    $balance        = max(0, $totalFine - $totalAfterThis);

    // Reject overpayments (tolerance of 1 centavo for float rounding).
    if ($amountPaid > $outstanding + 0.01) {
        return response()->json([
            'message' => 'Amount exceeds the outstanding balance.',
            'errors'  => [
                'amount_paid' => [
                    'Outstanding balance is ₱' . number_format($outstanding, 2) . '.',
                ],
            ],
        ], 422);
    }

    // Fully paid only when cumulative payments cover the fine.
    $newTicketStatus = $totalAfterThis + 0.01 >= $totalFine ? 'paid' : 'partial_paid';

    DB::beginTransaction();

    try {
        $payment = Payment::create([
            'ticket_id'         => $ticket->ticket_id,
            'payment_reference' => 'PAY-' . strtoupper(Str::random(10)),
            'amount_paid'       => $amountPaid,
            'payment_date'      => $request->payment_date ?? now(),
            'payment_method'    => $request->payment_method,
            'payment_status'    => 'completed',
            'transaction_id'    => $request->transaction_id,
            'receipt_number'    => $request->receipt_number,
            'paid_by'           => $request->paid_by,
            'notes'             => $request->notes,
        ]);

        $oldStatus = $ticket->status;
        $ticket->update(['status' => $newTicketStatus]);

        DB::commit();

        // ---- Notifications (never block the response) ----
        try {
            $staff  = $request->user();
            $amount = number_format($amountPaid, 2);
            $violatorName = $ticket->violator
                ? trim("{$ticket->violator->firstname} {$ticket->violator->lastname}")
                : 'Unknown';

            if ($ticket->enforcer_id) {
                NotificationService::notifyUser(
                    $ticket->enforcer_id,
                    'Payment Recorded',
                    "Ticket {$ticket->ticket_number} received ₱{$amount} ({$request->payment_method}). Receipt: {$request->receipt_number}",
                    Notification::TYPE_PAYMENT_RECEIVED,
                    'ticket',
                    $ticket->ticket_id
                );
            }

            NotificationService::notifyAdminStaff(
                'Payment Recorded',
                "{$staff->firstname} {$staff->lastname} recorded ₱{$amount} for {$ticket->ticket_number} ({$violatorName})",
                Notification::TYPE_PAYMENT_RECEIVED,
                'ticket',
                $ticket->ticket_id
            );

            if ($newTicketStatus === 'paid' && $oldStatus !== 'paid' && $ticket->enforcer_id) {
                NotificationService::notifyUser(
                    $ticket->enforcer_id,
                    'Ticket Fully Paid',
                    "Ticket {$ticket->ticket_number} is now fully paid.",
                    Notification::TYPE_TICKET_PAID,
                    'ticket',
                    $ticket->ticket_id
                );
            }
        } catch (\Throwable $ne) {
            Log::warning('Payment notification failed: ' . $ne->getMessage());
        }

        return response()->json([
            'message'         => $newTicketStatus === 'paid'
                ? 'Payment recorded. Ticket fully paid.'
                : 'Partial payment recorded. Balance remaining.',
            'payment'         => $payment->fresh(['ticket.violator', 'ticket.vehicle']),
            'ticket_status'   => $newTicketStatus,
            'total_fine'      => $totalFine,
            'previously_paid' => $previouslyPaid,
            'amount_paid'     => $amountPaid,
            'total_paid'      => $totalAfterThis,
            'balance'         => $balance,
        ], 201);

    } catch (\Throwable $e) {
        DB::rollBack();
        Log::error('Payment store failed: ' . $e->getMessage());

        return response()->json([
            'message' => 'Failed to record payment: ' . $e->getMessage(),
        ], 500);
    }
}

    /**
     * PUT /api/payments/{id}/void
     * Marks a payment as refunded/failed (does NOT delete it — audit trail).
     * Only admin can void.
     */
    public function void(Request $request, $id)
    {
        $payment = Payment::findOrFail($id);

        if ($payment->payment_status !== 'completed') {
            return response()->json([
                'message' => 'Only completed payments can be voided.',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'reason' => 'required|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        DB::beginTransaction();
        try {
            $payment->update([
                'payment_status' => 'refunded',
                'notes' => trim(($payment->notes ?? '') . "\n[VOIDED] " . $request->reason),
            ]);

            // Recompute ticket status from remaining completed payments.
            $ticket = Ticket::with('violations')->find($payment->ticket_id);
            if ($ticket) {
                $totalFine = (float) $ticket->violations->sum('fine_amount');
                $totalPaid = (float) Payment::where('ticket_id', $ticket->ticket_id)
                    ->where('payment_status', 'completed')
                    ->sum('amount_paid');

                if ($totalPaid <= 0) {
                    $ticket->status = 'issued';
                } elseif ($totalPaid < $totalFine) {
                    $ticket->status = 'partial_paid';
                } else {
                    $ticket->status = 'paid';
                }
                $ticket->save();
            }

            DB::commit();

            return response()->json([
                'message' => 'Payment voided successfully',
                'payment' => $payment->fresh(),
                'ticket_status' => $ticket?->status,
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Payment void failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to void payment'], 500);
        }
    }

    /**
     * GET /api/payments/ticket/{ticketId}
     * All payments for a specific ticket (including refunds).
     */
    public function byTicket($ticketId)
    {
        $ticket = Ticket::with([
            'violator',
            'vehicle',
            'violations.violationType',
            'payments',
        ])->findOrFail($ticketId);

        $totalFine = (float) $ticket->violations->sum('fine_amount');
        $totalPaid = (float) $ticket->payments
            ->where('payment_status', 'completed')
            ->sum('amount_paid');

        return response()->json([
            'ticket' => $ticket,
            'summary' => [
                'total_fine' => $totalFine,
                'total_paid' => $totalPaid,
                'balance' => max(0, $totalFine - $totalPaid),
                'status' => $ticket->status,
            ],
        ]);
    }
}