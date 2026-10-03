<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tables whose existing delete paths become archive-only.
     * Each gets is_archived, archived_at, archived_by.
     */
    private array $tables = [
        'tickets',
        'violators',
        'vehicles',
        'violation_types',
        'users',
        'enforcer_schedules',
        'duty_locations',
        'payments',
    ];

    public function up(): void
    {
        foreach ($this->tables as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            Schema::table($table, function (Blueprint $t) use ($table) {
                if (!Schema::hasColumn($table, 'is_archived')) {
                    $t->boolean('is_archived')->default(false);
                }
                if (!Schema::hasColumn($table, 'archived_at')) {
                    $t->timestamp('archived_at')->nullable();
                }
                if (!Schema::hasColumn($table, 'archived_by')) {
                    $t->unsignedBigInteger('archived_by')->nullable();
                }
            });

            Schema::table($table, function (Blueprint $t) use ($table) {
                $t->index('is_archived', "{$table}_is_archived_idx");
            });
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            Schema::table($table, function (Blueprint $t) use ($table) {
                try {
                    $t->dropIndex("{$table}_is_archived_idx");
                } catch (\Throwable $e) {
                    // index already gone
                }
            });

            Schema::table($table, function (Blueprint $t) use ($table) {
                foreach (['is_archived', 'archived_at', 'archived_by'] as $col) {
                    if (Schema::hasColumn($table, $col)) {
                        $t->dropColumn($col);
                    }
                }
            });
        }
    }
};
