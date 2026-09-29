<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Ticket;
use App\Models\TicketViolation;
use App\Models\Violator;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    /* ==================================================================
     |  TODAY
     ================================================================== */

    public function todayReport(Request $request)
    {
        $today = now()->toDateString();

        // Tickets issued today
        $todayTickets = Ticket::with(['violator', 'vehicle', 'enforcer', 'violations.violationType'])
            ->whereDate('created_at', $today)
            ->get();

        // Statistics
        $totalTickets    = $todayTickets->count();
        $totalViolations = TicketViolation::whereIn('ticket_id', $todayTickets->pluck('ticket_id'))->count();
        $totalFines      = TicketViolation::whereIn('ticket_id', $todayTickets->pluck('ticket_id'))->sum('fine_amount');
        $paidTickets     = $todayTickets->where('status', 'paid')->count();
        $issuedTickets   = $todayTickets->where('status', 'issued')->count();

        // Collection rate (based on ticket status, not payments)
        $collectionRate = $totalTickets > 0 ? round(($paidTickets / $totalTickets) * 100, 2) : 0;

        // Top violations today
        $topViolations = TicketViolation::select(
            'violation_types.violation_name',
            DB::raw('COUNT(*) as count')
        )
            ->join('violation_types', 'ticket_violations.violation_id', '=', 'violation_types.violation_id')
            ->whereIn('ticket_id', $todayTickets->pluck('ticket_id'))
            ->groupBy('violation_types.violation_name')
            ->orderBy('count', 'desc')
            ->limit(5)
            ->get();

        // Enforcer performance today
        $enforcerStats = User::where('role', 'enforcer')
            ->withCount(['tickets' => function ($query) use ($today) {
                $query->whereDate('created_at', $today);
            }])
            ->get()
            ->map(function ($enforcer) {
                return [
                    'name'          => $enforcer->firstname . ' ' . $enforcer->lastname,
                    'tickets_count' => $enforcer->tickets_count,
                ];
            })
            ->filter(fn ($enforcer) => $enforcer['tickets_count'] > 0)
            ->values();

        // Payments collected today
        $paymentsSummary = $this->buildPaymentsSummary($today, $today);

        return response()->json([
            'date'    => $today,
            'summary' => [
                'total_tickets'    => $totalTickets,
                'total_violations' => $totalViolations,
                'total_fines'      => $totalFines,
                'paid_tickets'     => $paidTickets,
                'issued_tickets'   => $issuedTickets,
                'collection_rate'  => $collectionRate,
            ],
            'recent_tickets'       => $todayTickets->take(10),
            'top_violations'       => $topViolations,
            'enforcer_performance' => $enforcerStats,
            'payments_summary'     => $paymentsSummary,
        ]);
    }

    /* ==================================================================
     |  WEEKLY / RANGE
     ================================================================== */

    public function weeklyReport(Request $request)
    {
        $startDate = $request->get('start_date', now()->startOfWeek()->toDateString());
        $endDate   = $request->get('end_date', now()->endOfWeek()->toDateString());

        // Tickets in date range
        $weeklyTickets = Ticket::with(['violator', 'vehicle', 'enforcer', 'violations.violationType'])
            ->whereBetween('created_at', [$startDate . ' 00:00:00', $endDate . ' 23:59:59'])
            ->get();

        // Daily breakdown
        $dailyBreakdown = [];
        $currentDate    = strtotime($startDate);
        $endDateTime    = strtotime($endDate);

        while ($currentDate <= $endDateTime) {
            $date       = date('Y-m-d', $currentDate);
            $dayTickets = $weeklyTickets->filter(function ($ticket) use ($date) {
                return substr($ticket->created_at, 0, 10) === $date;
            });

            $dailyBreakdown[] = [
                'date'          => $date,
                'day_name'      => date('l', $currentDate),
                'tickets_count' => $dayTickets->count(),
                'total_fines'   => TicketViolation::whereIn('ticket_id', $dayTickets->pluck('ticket_id'))->sum('fine_amount'),
            ];

            $currentDate = strtotime('+1 day', $currentDate);
        }

        // Weekly statistics
        $totalTickets     = $weeklyTickets->count();
        $totalViolations  = TicketViolation::whereIn('ticket_id', $weeklyTickets->pluck('ticket_id'))->count();
        $totalFines       = TicketViolation::whereIn('ticket_id', $weeklyTickets->pluck('ticket_id'))->sum('fine_amount');
        $paidTickets      = $weeklyTickets->where('status', 'paid')->count();
        $issuedTickets    = $weeklyTickets->where('status', 'issued')->count();
        $contestedTickets = $weeklyTickets->where('status', 'contested')->count();
        $dismissedTickets = $weeklyTickets->where('status', 'dismissed')->count();

        $daysInRange         = max(1, \Carbon\Carbon::parse($startDate)->diffInDays(\Carbon\Carbon::parse($endDate)) + 1);
        $averageDailyTickets = $totalTickets / $daysInRange;
        $collectionRate      = $totalTickets > 0 ? round(($paidTickets / $totalTickets) * 100, 2) : 0;

        // Top violators of the week
        $topViolators = Violator::select('violators.firstname', 'violators.lastname', 'violators.license')
            ->withCount(['tickets' => function ($query) use ($startDate, $endDate) {
                $query->whereBetween('created_at', [$startDate . ' 00:00:00', $endDate . ' 23:59:59']);
            }])
            ->having('tickets_count', '>', 0)
            ->orderBy('tickets_count', 'desc')
            ->limit(5)
            ->get();

        // Top violations of the week
        $topViolations = TicketViolation::select(
            'violation_types.violation_name',
            DB::raw('COUNT(*) as count'),
            DB::raw('SUM(ticket_violations.fine_amount) as total_fine')
        )
            ->join('violation_types', 'ticket_violations.violation_id', '=', 'violation_types.violation_id')
            ->whereIn('ticket_id', $weeklyTickets->pluck('ticket_id'))
            ->groupBy('violation_types.violation_name')
            ->orderBy('count', 'desc')
            ->limit(5)
            ->get();

        // Payments collected in range
        $paymentsSummary = $this->buildPaymentsSummary($startDate, $endDate);

        return response()->json([
            'date_range' => [
                'start' => $startDate,
                'end'   => $endDate,
            ],
            'summary' => [
                'total_tickets'         => $totalTickets,
                'total_violations'      => $totalViolations,
                'total_fines'           => $totalFines,
                'paid_tickets'          => $paidTickets,
                'issued_tickets'        => $issuedTickets,
                'contested_tickets'     => $contestedTickets,
                'dismissed_tickets'     => $dismissedTickets,
                'average_daily_tickets' => round($averageDailyTickets, 2),
                'collection_rate'       => $collectionRate,
            ],
            'daily_breakdown'  => $dailyBreakdown,
            'top_violators'    => $topViolators,
            'top_violations'   => $topViolations,
            'recent_tickets'   => $weeklyTickets->take(10),
            'payments_summary' => $paymentsSummary,
        ]);
    }

    /* ==================================================================
     |  EXPORT (CSV)
     ================================================================== */

    public function exportReport(Request $request)
    {
        $startDate = $request->get('start_date', now()->startOfWeek()->toDateString());
        $endDate   = $request->get('end_date', now()->endOfWeek()->toDateString());

        $tickets = Ticket::with(['violator', 'vehicle', 'enforcer', 'violations.violationType'])
            ->whereBetween('created_at', [$startDate . ' 00:00:00', $endDate . ' 23:59:59'])
            ->get();

        $csvData   = [];
        $csvData[] = ['Ticket #', 'Violator', 'License', 'Plate #', 'Violations', 'Total Fine', 'Location', 'Date', 'Status', 'Enforcer'];

        foreach ($tickets as $ticket) {
            $violationsList = $ticket->violations->map(function ($v) {
                return $v->violationType->violation_name . ' (₱' . number_format($v->fine_amount, 2) . ')';
            })->implode('; ');

            $csvData[] = [
                $ticket->ticket_number,
                $ticket->violator->firstname . ' ' . $ticket->violator->lastname,
                $ticket->violator->license,
                $ticket->vehicle->platenumber,
                $violationsList,
                number_format($ticket->violations->sum('fine_amount'), 2),
                $ticket->location,
                date('Y-m-d H:i', strtotime($ticket->violation_datetime)),
                strtoupper($ticket->status),
                $ticket->enforcer->firstname . ' ' . $ticket->enforcer->lastname,
            ];
        }

        // Convert to CSV string
        $csv = '';
        foreach ($csvData as $row) {
            $csv .= '"' . implode('","', array_map('addslashes', $row)) . '"' . "\n";
        }

        return response($csv)
            ->header('Content-Type', 'text/csv')
            ->header('Content-Disposition', 'attachment; filename="report_' . $startDate . '_to_' . $endDate . '.csv"');
    }

    /* ==================================================================
     |  PAYMENTS SUMMARY HELPER
     ================================================================== */

    /**
     * Build a payments summary for the given date range.
     * Used by both todayReport() and weeklyReport().
     */
    private function buildPaymentsSummary(string $startDate, string $endDate): array
    {
        $start = $startDate . ' 00:00:00';
        $end   = $endDate   . ' 23:59:59';

        // Base query — only completed payments count toward "collected".
        $base = Payment::where('payment_status', 'completed')
            ->whereBetween('payment_date', [$start, $end]);

        $totalCollected = (float) (clone $base)->sum('amount_paid');
        $paymentsCount  = (int)   (clone $base)->count();
        $uniqueTickets  = (int)   (clone $base)->distinct('ticket_id')->count('ticket_id');
        $averagePayment = $paymentsCount > 0 ? round($totalCollected / $paymentsCount, 2) : 0;

        // Breakdown by payment_method
        $byMethod = (clone $base)
            ->select(
                'payment_method',
                DB::raw('COUNT(*) as count'),
                DB::raw('SUM(amount_paid) as total')
            )
            ->groupBy('payment_method')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'method' => $row->payment_method,
                'label'  => ucwords(str_replace('_', ' ', $row->payment_method)),
                'count'  => (int) $row->count,
                'total'  => (float) $row->total,
            ])
            ->values()
            ->toArray();

        // Refunded / voided amounts in the same range (informational only).
        $refundedTotal = (float) Payment::where('payment_status', 'refunded')
            ->whereBetween('payment_date', [$start, $end])
            ->sum('amount_paid');

        // Recent payments in range (top 10).
        $recentPayments = (clone $base)
            ->with(['ticket.violator', 'ticket.vehicle'])
            ->orderByDesc('payment_date')
            ->limit(10)
            ->get()
            ->map(function ($p) {
                return [
                    'payment_id'        => $p->payment_id,
                    'payment_reference' => $p->payment_reference,
                    'receipt_number'    => $p->receipt_number,
                    'amount_paid'       => (float) $p->amount_paid,
                    'payment_method'    => $p->payment_method,
                    'payment_date'      => $p->payment_date,
                    'ticket_number'     => $p->ticket?->ticket_number,
                    'violator_name'     => $p->ticket?->violator
                        ? trim("{$p->ticket->violator->firstname} {$p->ticket->violator->lastname}")
                        : null,
                    'plate'             => $p->ticket?->vehicle?->platenumber,
                ];
            })
            ->values()
            ->toArray();

        // Daily payments series — used to overlay a "collected" line on the
        // range chart in the front-end. Empty for a single-day range is fine.
        $daily = (clone $base)
            ->select(
                DB::raw('DATE(payment_date) as date'),
                DB::raw('SUM(amount_paid) as total')
            )
            ->groupBy(DB::raw('DATE(payment_date)'))
            ->orderBy('date')
            ->get()
            ->map(fn ($row) => [
                'date'  => $row->date,
                'total' => (float) $row->total,
            ])
            ->values()
            ->toArray();

        return [
            'total_collected'  => $totalCollected,
            'refunded_total'   => $refundedTotal,
            'net_collected'    => max(0, $totalCollected - $refundedTotal),
            'payments_count'   => $paymentsCount,
            'unique_tickets'   => $uniqueTickets,
            'average_payment'  => $averagePayment,
            'by_method'        => $byMethod,
            'recent_payments'  => $recentPayments,
            'daily'            => $daily,
        ];
    }
}