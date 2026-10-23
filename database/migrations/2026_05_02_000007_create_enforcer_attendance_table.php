<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('enforcer_attendance', function (Blueprint $table) {
            $table->id('attendance_id');
            $table->foreignId('enforcer_id')->constrained('users', 'user_id')->onDelete('cascade');
            $table->date('date');
            $table->datetime('time_in')->nullable();
            $table->datetime('time_out')->nullable();
            $table->string('time_in_photo', 255)->nullable();
            $table->string('time_in_location', 255)->nullable();
            $table->string('time_out_photo', 255)->nullable();
            $table->string('time_out_location', 255)->nullable();
            $table->enum('status', ['present', 'absent', 'late', 'on_leave', 'half_day'])->default('present');
            $table->integer('late_minutes')->default(0);
            $table->integer('overtime_minutes')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
            
            $table->unique(['enforcer_id', 'date']);
            $table->index('date');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('enforcer_attendance');
    }
};