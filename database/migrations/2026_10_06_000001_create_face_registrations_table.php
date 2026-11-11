<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('face_registrations', function (Blueprint $table) {
            $table->id('face_registration_id');

            // One active registration per user, enforced by the controller.
            $table->foreignId('user_id')
                ->constrained('users', 'user_id')
                ->onDelete('cascade');

            // 3 encodings as JSON arrays (length 192 each).
            $table->json('front_encoding');
            $table->json('left_encoding');
            $table->json('right_encoding');

            // Paths on the public disk (storage/app/public/faces/...).
            $table->string('front_image', 255);
            $table->string('left_image', 255);
            $table->string('right_image', 255);

            // Diagnostic metadata — helps the admin spot bad captures.
            $table->string('device_id', 64)->nullable();
            $table->string('app_version', 32)->nullable();
            $table->decimal('threshold_used', 5, 3)->default(0.880);

            // When the admin changes the owner, we archive the old row
            // rather than deleting it, so there's an audit trail.
            $table->boolean('is_active')->default(true);
            $table->timestamp('replaced_at')->nullable();
            $table->foreignId('replaced_by_registration_id')
                ->nullable()
                ->constrained('face_registrations', 'face_registration_id')
                ->onDelete('set null');

            $table->timestamps();

            $table->index(['user_id', 'is_active']);
            $table->index('is_active');
            $table->index('device_id');
        });

        Schema::create('face_takeover_requests', function (Blueprint $table) {
            $table->id('request_id');

            // The user who is asking to become the new owner.
            $table->foreignId('requester_user_id')
                ->constrained('users', 'user_id')
                ->onDelete('cascade');

            // The existing registration on the device (owned by someone else).
            $table->foreignId('existing_registration_id')
                ->constrained('face_registrations', 'face_registration_id')
                ->onDelete('cascade');

            // The enforcer who currently owns the face.
            $table->foreignId('current_owner_user_id')
                ->constrained('users', 'user_id')
                ->onDelete('cascade');

            $table->string('device_id', 64);
            $table->decimal('similarity', 5, 4)
                ->comment('Cosine similarity of the match');

            // Snapshot of the requester's captured poses.
            $table->json('requester_front_encoding')->nullable();
            $table->json('requester_left_encoding')->nullable();
            $table->json('requester_right_encoding')->nullable();
            $table->string('requester_front_image', 255)->nullable();
            $table->string('requester_left_image', 255)->nullable();
            $table->string('requester_right_image', 255)->nullable();

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

            $table->index(['requester_user_id', 'status']);
            $table->index('status');
            $table->index('device_id');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('face_takeover_requests');
        Schema::dropIfExists('face_registrations');
    }
};