<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->timestamp('warning_sent_at')->nullable()->after('payment_due_at');
            $table->unsignedSmallInteger('warning_count')->default(0)->after('warning_sent_at');
            // null = not yet eligible | for_visit | visited
            $table->string('warrant_status', 20)->nullable()->after('warning_count');
            $table->timestamp('warrant_flagged_at')->nullable()->after('warrant_status');
            $table->timestamp('warrant_visited_at')->nullable()->after('warrant_flagged_at');
            $table->index(['status', 'payment_due_at']);
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropIndex(['status', 'payment_due_at']);
            $table->dropColumn([
                'warning_sent_at', 'warning_count', 'warrant_status',
                'warrant_flagged_at', 'warrant_visited_at',
            ]);
        });
    }
};