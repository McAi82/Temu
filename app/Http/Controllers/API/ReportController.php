<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Ticket;
use App\Models\TicketViolation;
use App\Models\Violator;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ReportController extends Controller
{
    /* ==================================================================
     |  UNIFIED REPORT (daily / weekly / monthly / yearly / custom)
     |  GET /reports?period=...&...
     ================================================================== */

    public function report(Request $request)
    {
        try {
            [$start, $end, $label] = $this->resolvePeriod($request);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $includeArchived = $request->boolean('include_archived', false);

        $payload = $this->buildReport($start, $end, $includeArchived);
        $payload['period'] = $request->get('period', 'custom');
        $payload['label']  = $label;
        $payload['date_range'] = [
            'start' => $start->toDateString(),
            'end'   => $end->toDateString(),
        ];

        // -------- Explicit comparison range --------
        // Frontend now sends compare_start / compare_end alongside compare=1.
        // If either is missing, we skip the comparison block entirely.
        if (
            $request->boolean('compare')
            && $request->filled('compare_start')
            && $request->filled('compare_end')
        ) {
            $compareStart = Carbon::parse($request->compare_start)->startOfDay();
            $compareEnd   = Carbon::parse($request->compare_end)->endOfDay();

            if ($compareStart->lte($compareEnd)) {
                $compare = $this->buildReport($compareStart, $compareEnd, $includeArchived);

                $payload['compare'] = [
                    'date_range' => [
                        'start' => $compareStart->toDateString(),
                        'end'   => $compareEnd->toDateString(),
                    ],
                    'label'    => 'Compare — '
                        . $compareStart->format('M d, Y') . ' to '
                        . $compareEnd->format('M d, Y'),
                    'summary'           => $compare['summary'],
                    'payments_summary'  => $compare['payments_summary'],
                    'daily_breakdown'   => $compare['daily_breakdown'],
                    'top_violations'    => $compare['top_violations'],
                    'top_violators'     => $compare['top_violators'],
                    'enforcer_performance' => $compare['enforcer_performance'],
                    'deltas' => $this->computeDeltas($payload['summary'], $compare['summary']),
                ];
            }
        }

        return response()->json($payload);
    }

    /* ==================================================================
     |  TODAY (kept for backwards compatibility)
     ================================================================== */

    public function todayReport(Request $request)
    {
        $today = now()->startOfDay();
        $payload = $this->buildReport($today, $today->copy()->endOfDay(), false);

        return response()->json(array_merge($payload, [
            'date' => $today->toDateString(),
            'recent_tickets' => $payload['recent_tickets'],
        ]));
    }

    /* ==================================================================
     |  WEEKLY / RANGE (kept)
     ================================================================== */

    public function weeklyReport(Request $request)
    {
        $startDate = $request->get('start_date', now()->startOfWeek()->toDateString());
        $endDate   = $request->get('end_date', now()->endOfWeek()->toDateString());

        $start = Carbon::parse($startDate)->startOfDay();
        $end   = Carbon::parse($endDate)->endOfDay();

        $payload = $this->buildReport($start, $end, false);

        return response()->json(array_merge($payload, [
            'date_range' => [
                'start' => $start->toDateString(),
                'end'   => $end->toDateString(),
            ],
        ]));
    }

    /* ==================================================================
     |  EXPORT (CSV)
     ================================================================== */

    public function exportReport(Request $request)
    {
        $startDate = $request->get('start_date', now()->startOfWeek()->toDateString());
        $endDate   = $request->get('end_date', now()->endOfWeek()->toDateString());

        $includeArchived = $request->boolean('include_archived', false);

        $query = Ticket::with(['violator', 'vehicle', 'enforcer', 'violations.violationType'])
            ->whereBetween('created_at', [$startDate . ' 00:00:00', $endDate . ' 23:59:59']);

        if (!$includeArchived) {
            $query->active();
        }

        $tickets = $query->get();

        $csvData   = [];
        $csvData[] = ['Ticket #', 'Violator', 'License', 'Plate #', 'Violations', 'Total Fine', 'Location', 'Date', 'Status', 'Enforcer', 'Archived'];

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
                $ticket->is_archived ? 'YES' : 'NO',
            ];
        }

        $csv = '';
        foreach ($csvData as $row) {
            $csv .= '"' . implode('","', array_map('addslashes', $row)) . '"' . "\n";
        }

        return response($csv)
            ->header('Content-Type', 'text/csv')
            ->header('Content-Disposition', 'attachment; filename="report_' . $startDate . '_to_' . $endDate . '.csv"');
    }

    /* ==================================================================
     |  PERIOD RESOLUTION
     ================================================================== */

    /**
     * @return array{0: Carbon, 1: Carbon, 2: string}  [start, end, human label]
     */
    private function resolvePeriod(Request $request): array
    {
        $period = strtolower((string) $request->get('period', 'daily'));

        switch ($period) {
            case 'daily': {
                    $date = $request->filled('date')
                        ? Carbon::parse($request->date)
                        : now();
                    return [
                        $date->copy()->startOfDay(),
                        $date->copy()->endOfDay(),
                        'Daily — ' . $date->format('M d, Y'),
                    ];
                }

            case 'weekly': {
                    // Accept either week=YYYY-Www or start_date/end_date.
                    if ($request->filled('week')) {
                        // "YYYY-Www" or "YYYY-Www"
                        try {
                            $week = Carbon::parse($request->week); // best effort
                            $start = $week->copy()->startOfWeek();
                        } catch (\Throwable $e) {
                            throw new \InvalidArgumentException('Invalid week format. Use YYYY-Www.');
                        }
                    } elseif ($request->filled('start_date')) {
                        $start = Carbon::parse($request->start_date)->startOfWeek();
                    } else {
                        $start = now()->startOfWeek();
                    }

                    return [
                        $start->copy()->startOfDay(),
                        $start->copy()->endOfWeek()->endOfDay(),
                        'Weekly — ' . $start->format('M d') . ' to ' . $start->copy()->endOfWeek()->format('M d, Y'),
                    ];
                }

            case 'monthly': {
                    $month = $request->filled('month')
                        ? Carbon::parse($request->month . '-01')
                        : now();

                    return [
                        $month->copy()->startOfMonth()->startOfDay(),
                        $month->copy()->endOfMonth()->endOfDay(),
                        'Monthly — ' . $month->format('F Y'),
                    ];
                }

            case 'yearly': {
                    $year = $request->filled('year') ? (int) $request->year : now()->year;
                    $start = Carbon::create($year, 1, 1)->startOfDay();
                    return [
                        $start,
                        Carbon::create($year, 12, 31)->endOfDay(),
                        'Yearly — ' . $year,
                    ];
                }

            case 'custom':
            default: {
                    if (!$request->filled('start_date') || !$request->filled('end_date')) {
                        throw new \InvalidArgumentException('start_date and end_date are required for custom range.');
                    }
                    $start = Carbon::parse($request->start_date)->startOfDay();
                    $end   = Carbon::parse($request->end_date)->endOfDay();

                    if ($start->gt($end)) {
                        throw new \InvalidArgumentException('start_date must be before or equal to end_date.');
                    }

                    return [
                        $start,
                        $end,
                        'Custom — ' . $start->format('M d, Y') . ' to ' . $end->format('M d, Y'),
                    ];
                }
        }
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    private function previousPeriod(Carbon $start, Carbon $end): array
    {
        $days = $start->diffInDays($end) + 1;

        return [
            $start->copy()->subDays($days)->startOfDay(),
            $end->copy()->subDays($days)->endOfDay(),
        ];
    }

    /* ==================================================================
     |  REPORT BUILDER
     ================================================================== */

    private function buildReport(Carbon $start, Carbon $end, bool $includeArchived): array
    {
        $startStr = $start->toDateTimeString();
        $endStr   = $end->toDateTimeString();

        $ticketQuery = Ticket::with(['violator', 'vehicle', 'enforcer', 'violations.violationType'])
            ->whereBetween('created_at', [$startStr, $endStr]);

        if (!$includeArchived) {
            $ticketQuery->active();
        }

        $tickets = $ticketQuery->get();
        $ticketIds = $tickets->pluck('ticket_id');

        $totalTickets     = $tickets->count();
        $totalViolations  = TicketViolation::whereIn('ticket_id', $ticketIds)->count();
        $totalFines       = TicketViolation::whereIn('ticket_id', $ticketIds)->sum('fine_amount');
        $paidTickets      = $tickets->where('status', 'paid')->count();
        $issuedTickets    = $tickets->where('status', 'issued')->count();
        $contestedTickets = $tickets->where('status', 'contested')->count();
        $dismissedTickets = $tickets->where('status', 'dismissed')->count();
        $partialTickets   = $tickets->where('status', 'partial_paid')->count();

        $daysInRange = max(1, $start->diffInDays($end) + 1);
        $averageDailyTickets = round($totalTickets / $daysInRange, 2);
        $collectionRate = $totalTickets > 0 ? round(($paidTickets / $totalTickets) * 100, 2) : 0;

        // ---- Daily breakdown (for chart) ----
        $dailyBreakdown = [];
        $cursor = $start->copy()->startOfDay();
        while ($cursor->lte($end)) {
            $date = $cursor->toDateString();

            $dayTickets = $tickets->filter(function ($t) use ($date) {
                return substr((string) $t->created_at, 0, 10) === $date;
            });

            $dayIds = $dayTickets->pluck('ticket_id');
            $dayFines = TicketViolation::whereIn('ticket_id', $dayIds)->sum('fine_amount');

            $dailyBreakdown[] = [
                'date'          => $date,
                'day_name'      => $cursor->format('D'),
                'tickets_count' => $dayTickets->count(),
                'total_fines'   => (float) $dayFines,
            ];

            $cursor->addDay();
        }

        // ---- Top violators ----
        $topViolators = Violator::select('violators.firstname', 'violators.lastname', 'violators.license')
            ->withCount(['tickets' => function ($q) use ($startStr, $endStr, $includeArchived) {
                $q->whereBetween('created_at', [$startStr, $endStr]);
                if (!$includeArchived) {
                    $q->where('is_archived', false);
                }
            }])
            ->having('tickets_count', '>', 0)
            ->orderBy('tickets_count', 'desc')
            ->limit(5)
            ->get();

        // ---- Top violations ----
        $topViolations = TicketViolation::select(
            'violation_types.violation_name',
            DB::raw('COUNT(*) as count'),
            DB::raw('SUM(ticket_violations.fine_amount) as total_fine')
        )
            ->join('violation_types', 'ticket_violations.violation_id', '=', 'violation_types.violation_id')
            ->whereIn('ticket_id', $ticketIds)
            ->groupBy('violation_types.violation_name')
            ->orderBy('count', 'desc')
            ->limit(5)
            ->get();

        // ---- Enforcer performance ----
        $enforcerStats = User::where('role', 'enforcer')
            ->withCount(['tickets' => function ($q) use ($startStr, $endStr, $includeArchived) {
                $q->whereBetween('created_at', [$startStr, $endStr]);
                if (!$includeArchived) {
                    $q->where('is_archived', false);
                }
            }])
            ->get()
            ->map(function ($enforcer) {
                return [
                    'name'          => $enforcer->firstname . ' ' . $enforcer->lastname,
                    'tickets_count' => $enforcer->tickets_count,
                ];
            })
            ->filter(fn($e) => $e['tickets_count'] > 0)
            ->sortByDesc('tickets_count')
            ->values();

        $paymentsSummary = $this->buildPaymentsSummary($start, $end, $includeArchived);

        return [
            'summary' => [
                'total_tickets'         => $totalTickets,
                'total_violations'      => $totalViolations,
                'total_fines'           => (float) $totalFines,
                'paid_tickets'          => $paidTickets,
                'issued_tickets'        => $issuedTickets,
                'contested_tickets'     => $contestedTickets,
                'dismissed_tickets'     => $dismissedTickets,
                'partial_tickets'       => $partialTickets,
                'average_daily_tickets' => $averageDailyTickets,
                'collection_rate'       => $collectionRate,
            ],
            'daily_breakdown'      => $dailyBreakdown,
            'top_violators'        => $topViolators,
            'top_violations'       => $topViolations,
            'enforcer_performance' => $enforcerStats,
            'recent_tickets'       => $tickets->take(10)->values(),
            'payments_summary'     => $paymentsSummary,
        ];
    }

    private function computeDeltas(array $current, array $previous): array
    {
        $keys = [
            'total_tickets',
            'total_violations',
            'total_fines',
            'paid_tickets',
            'issued_tickets',
            'contested_tickets',
            'dismissed_tickets',
            'average_daily_tickets',
            'collection_rate',
        ];

        $deltas = [];
        foreach ($keys as $k) {
            $c = (float) ($current[$k] ?? 0);
            $p = (float) ($previous[$k] ?? 0);

            $pct = $p > 0 ? round((($c - $p) / $p) * 100, 2) : ($c > 0 ? 100.0 : 0.0);

            $deltas[$k] = [
                'current'   => $c,
                'previous'  => $p,
                'change'    => round($c - $p, 2),
                'percent'   => $pct,
                'direction' => $c > $p ? 'up' : ($c < $p ? 'down' : 'flat'),
            ];
        }
        return $deltas;
    }

    private function buildPaymentsSummary(Carbon $start, Carbon $end, bool $includeArchived): array
    {
        $base = Payment::query()
            ->where('payment_status', 'completed')
            ->whereBetween('payment_date', [$start, $end]);

        if (!$includeArchived) {
            $base->active();
        }

        $totalCollected = (float) (clone $base)->sum('amount_paid');
        $paymentsCount  = (int)   (clone $base)->count();
        $uniqueTickets  = (int)   (clone $base)->distinct('ticket_id')->count('ticket_id');
        $averagePayment = $paymentsCount > 0 ? round($totalCollected / $paymentsCount, 2) : 0;

        $byMethod = (clone $base)
            ->select('payment_method', DB::raw('COUNT(*) as count'), DB::raw('SUM(amount_paid) as total'))
            ->groupBy('payment_method')
            ->orderByDesc('total')
            ->get()
            ->map(fn($row) => [
                'method' => $row->payment_method,
                'label'  => ucwords(str_replace('_', ' ', $row->payment_method)),
                'count'  => (int) $row->count,
                'total'  => (float) $row->total,
            ])
            ->values()
            ->toArray();

        $refundQuery = Payment::query()
            ->where('payment_status', 'refunded')
            ->whereBetween('payment_date', [$start, $end]);
        if (!$includeArchived) {
            $refundQuery->active();
        }
        $refundedTotal = (float) $refundQuery->sum('amount_paid');

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

        $daily = (clone $base)
            ->select(DB::raw('DATE(payment_date) as date'), DB::raw('SUM(amount_paid) as total'))
            ->groupBy(DB::raw('DATE(payment_date)'))
            ->orderBy('date')
            ->get()
            ->map(fn($row) => [
                'date'  => $row->date,
                'total' => (float) $row->total,
            ])
            ->values()
            ->toArray();

        return [
            'total_collected' => $totalCollected,
            'refunded_total'  => $refundedTotal,
            'net_collected'   => max(0, $totalCollected - $refundedTotal),
            'payments_count'  => $paymentsCount,
            'unique_tickets'  => $uniqueTickets,
            'average_payment' => $averagePayment,
            'by_method'       => $byMethod,
            'recent_payments' => $recentPayments,
            'daily'           => $daily,
        ];
    }
}
