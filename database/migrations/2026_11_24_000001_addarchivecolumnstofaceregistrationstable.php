<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('face_registrations', function (Blueprint $table) {
            // Set when a registration is archived together with its user.
            // Distinct from replaced_at, which marks transfers/takeovers.
            $table->timestamp('archived_at')->nullable()->after('replaced_at');
            $table->unsignedBigInteger('archived_by')->nullable()->after('archived_at');
            $table->index(['user_id', 'archived_at']);
        });
    }

    public function down(): void
    {
        Schema::table('face_registrations', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'archived_at']);
            $table->dropColumn(['archived_at', 'archived_by']);
        });
    }
};