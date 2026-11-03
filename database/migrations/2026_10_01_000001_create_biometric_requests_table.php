<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('biometric_requests', function (Blueprint $table) {
            $table->id('request_id');
            $table->foreignId('user_id')
                ->constrained('users', 'user_id')
                ->onDelete('cascade');
            $table->enum('request_type', [
                'switch_to_fingerprint',
                'switch_to_face',
                'reset_biometric',
            ])->default('switch_to_fingerprint');
            $table->string('source', 32)->default('attendance')
                ->comment('attendance = time-in/out flow, login = mobile login flow');
            $table->unsignedInteger('failure_count')->default(0);
            $table->text('reason')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])
                ->default('pending');
            $table->foreignId('reviewed_by')
                ->nullable()
                ->constrained('users', 'user_id')
                ->onDelete('set null');
            $table->text('review_notes')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('consumed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index('status');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('biometric_requests');
    }
};
