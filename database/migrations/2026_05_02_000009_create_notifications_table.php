<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id('notification_id');
            $table->foreignId('user_id')->constrained('users', 'user_id')->onDelete('cascade');
            $table->string('title', 255);
            $table->text('message');
            // ✅ Changed from enum -> string so any notification type is allowed
            $table->string('type', 50)->default('announcement');
            $table->boolean('is_read')->default(false);
            $table->string('related_entity_type', 50)->nullable();
            $table->integer('related_entity_id')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'is_read']);
            $table->index('created_at');
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};