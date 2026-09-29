<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('tickets', function (Blueprint $table) {
            $table->id('ticket_id');
            $table->string('ticket_number', 50)->unique();
            $table->string('idempotency_key', 64)->nullable()->unique();
            $table->foreignId('violator_id')->constrained('violators', 'violator_id')->onDelete('cascade');
            $table->foreignId('vehicle_id')->constrained('vehicles', 'vehicle_id')->onDelete('cascade');
            $table->foreignId('enforcer_id')->constrained('users', 'user_id')->onDelete('cascade');
            $table->string('location', 255);
            $table->decimal('latitude', 10, 8)->nullable()->comment('GPS latitude');
            $table->decimal('longitude', 11, 8)->nullable()->comment('GPS longitude');
            $table->datetime('violation_datetime');
            $table->text('remarks')->nullable();
            $table->enum('status', ['issued', 'paid', 'contested', 'dismissed', 'partial_paid'])->default('issued');
            $table->string('qr_code', 255)->nullable();
            $table->string('pdf_path', 255)->nullable();
            $table->timestamps();

            $table->index('ticket_number');
            $table->index('status');
            $table->index('violation_datetime');
            $table->index('enforcer_id');
            $table->index('violator_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};