<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\DutyLocation;
use App\Models\EnforcerSchedule;
use App\Models\Notification;
use App\Models\Payment;
use App\Models\Ticket;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\ViolationType;
use App\Models\Violator;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ArchiveController extends Controller
{
    /**
     * Map of resource slug => [model class, primary key, search columns,
     * eager-load relationships for the list response].
     */
    private const RESOURCES = [
        'tickets' => [
            'model'  => Ticket::class,
            'pk'     => 'ticket_id',
            'search' => ['ticket_number', 'location'],
            'with'   => ['violator', 'vehicle', 'enforcer', 'violations.violationType'],
        ],
        'violators' => [
            'model'  => Violator::class,
            'pk'     => 'violator_id',
            'search' => ['firstname', 'middlename', 'lastname', 'license', 'email'],
            'with'   => [],
        ],
        'vehicles' => [
            'model'  => Vehicle::class,
            'pk'     => 'vehicle_id',
            'search' => ['platenumber', 'owner', 'make', 'model'],
            'with'   => [],
        ],
        'violations' => [
            'model'  => ViolationType::class,
            'pk'     => 'violation_id',
            'search' => ['violation_code', 'violation_name', 'category'],
            'with'   => [],
        ],
        'users' => [
            'model'  => User::class,
            'pk'     => 'user_id',
            'search' => ['firstname', 'middlename', 'lastname', 'email', 'role'],
            'with'   => [],
        ],
        'schedules' => [
            'model'  => EnforcerSchedule::class,
            'pk'     => 'schedule_id',
            'search' => ['duties', 'notes', 'shift_type'],
            'with'   => ['enforcer', 'dutyLocation'],
        ],
        'duty-locations' => [
            'model'  => DutyLocation::class,
            'pk'     => 'id',
            'search' => ['name', 'address'],
            'with'   => ['enforcer'],
        ],
        'payments' => [
            'model'  => Payment::class,
            'pk'     => 'payment_id',
            'search' => ['payment_reference', 'receipt_number', 'transaction_id'],
            'with'   => ['ticket.violator', 'ticket.vehicle'],
        ],
    ];

    /* ==================================================================
     |  LIST ARCHIVED
     ================================================================== */

    public function index(Request $request, string $resource)
    {
        $config = $this->config($resource);

        $perPage = (int) $request->get('per_page', 20);
        $page    = (int) $request->get('page', 1);
        $search  = trim((string) $request->get('search', ''));

        $query = $config['model']::query()
            ->archived()
            ->with(array_merge($config['with'], ['archivedBy']));

        if ($search !== '' && !empty($config['search'])) {
            $query->where(function ($q) use ($config, $search) {
                foreach ($config['search'] as $col) {
                    $q->orWhere($col, 'like', "%{$search}%");
                }
            });
        }

        if ($request->filled('date_from') && $this->hasColumn($config['model'], 'archived_at')) {
            $query->whereDate('archived_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to') && $this->hasColumn($config['model'], 'archived_at')) {
            $query->whereDate('archived_at', '<=', $request->date_to);
        }

        $paginator = $query
            ->orderByDesc('archived_at')
            ->orderByDesc($config['pk'])
            ->paginate($perPage, ['*'], 'page', $page);

        // Decorate each row with a human-friendly label + archived_by name.
        $paginator->getCollection()->transform(function ($row) use ($resource) {
            $row->resource_label = $this->label($resource, $row);
            $row->archived_by_name = $row->archivedBy
                ? trim("{$row->archivedBy->firstname} {$row->archivedBy->lastname}")
                : null;
            return $row;
        });

        return response()->json($paginator);
    }

    /* ==================================================================
     |  RESTORE
     ================================================================== */

    public function restore(Request $request, string $resource, int $id)
    {
        $config = $this->config($resource);

        $row = $config['model']::query()
            ->archived()
            ->where($config['pk'], $id)
            ->first();

        if (!$row) {
            return response()->json([
                'message' => 'Archived record not found.',
            ], 404);
        }

        try {
            $row->restoreArchive();

            try {
                $restorer = $request->user();
                $name = trim("{$restorer->firstname} {$restorer->lastname}");
                $label = $this->label($resource, $row);

                NotificationService::notifyAdmins(
                    $this->restoreTitle($resource),
                    "{$name} restored {$label}",
                    $this->restoreType($resource),
                    $this->entityType($resource),
                    $id
                );
            } catch (\Throwable $ne) {
                Log::warning("Archive restore notification failed: " . $ne->getMessage());
            }

            return response()->json([
                'message' => 'Record restored successfully.',
                'data'    => $row->fresh(),
            ]);
        } catch (\Throwable $e) {
            Log::error("Archive restore failed for {$resource}#{$id}: " . $e->getMessage());
            return response()->json([
                'message' => 'Failed to restore record.',
            ], 500);
        }
    }

    /* ==================================================================
     |  HELPERS
     ================================================================== */

    private function config(string $resource): array
    {
        if (!isset(self::RESOURCES[$resource])) {
            abort(404, 'Unknown archive resource.');
        }
        return self::RESOURCES[$resource];
    }

    private function hasColumn(string $modelClass, string $column): bool
    {
        try {
            return \Schema::hasColumn((new $modelClass)->getTable(), $column);
        } catch (\Throwable $e) {
            return false;
        }
    }

    private function label(string $resource, $row): string
    {
        return match ($resource) {
            'tickets'        => "ticket {$row->ticket_number}",
            'violators'      => "violator {$row->firstname} {$row->lastname}",
            'vehicles'       => "vehicle {$row->platenumber}",
            'violations'     => "violation {$row->violation_name}",
            'users'          => "user {$row->firstname} {$row->lastname}",
            'schedules'      => "schedule #{$row->schedule_id}",
            'duty-locations' => "duty location {$row->name}",
            'payments'       => "payment {$row->payment_reference}",
            default          => "record #{$row->getKey()}",
        };
    }

    private function entityType(string $resource): string
    {
        return match ($resource) {
            'duty-locations' => 'duty_location',
            'schedules'      => 'schedule',
            'violations'     => 'violation',
            default          => rtrim($resource, 's'), // tickets -> ticket
        };
    }

    private function restoreType(string $resource): string
    {
        return match ($resource) {
            'tickets'        => Notification::TYPE_TICKET_RESTORED,
            'violators'      => Notification::TYPE_VIOLATOR_RESTORED,
            'vehicles'       => Notification::TYPE_VEHICLE_RESTORED,
            'violations'     => Notification::TYPE_VIOLATION_RESTORED,
            'users'          => Notification::TYPE_USER_RESTORED,
            'schedules'      => Notification::TYPE_SCHEDULE_RESTORED,
            'duty-locations' => Notification::TYPE_DUTY_LOCATION_RESTORED,
            'payments'       => Notification::TYPE_PAYMENT_RESTORED,
            default          => Notification::TYPE_ANNOUNCEMENT,
        };
    }

    private function restoreTitle(string $resource): string
    {
        return match ($resource) {
            'tickets'        => 'Ticket Restored',
            'violators'      => 'Violator Restored',
            'vehicles'       => 'Vehicle Restored',
            'violations'     => 'Violation Restored',
            'users'          => 'User Restored',
            'schedules'      => 'Schedule Restored',
            'duty-locations' => 'Duty Location Restored',
            'payments'       => 'Payment Restored',
            default          => 'Record Restored',
        };
    }
}