<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Remap any legacy 'dismissed' rows.
        DB::table('tickets')
            ->where('status', 'dismissed')
            ->update(['status' => 'issued']);

        // 2. Shrink the enum.
        DB::statement("
            ALTER TABLE tickets
            MODIFY COLUMN status ENUM('issued', 'paid') NOT NULL DEFAULT 'issued'
        ");
    }

    public function down(): void
    {
        DB::statement("
            ALTER TABLE tickets
            MODIFY COLUMN status ENUM('issued', 'paid', 'dismissed') NOT NULL DEFAULT 'issued'
        ");
    }
};