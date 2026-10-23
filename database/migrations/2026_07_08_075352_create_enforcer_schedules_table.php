<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::create('enforcer_schedules', function (Blueprint $table) {
            $table->id('schedule_id');
            $table->foreignId('enforcer_id')->constrained('users', 'user_id')->onDelete('cascade');
            $table->foreignId('duty_location_id')->nullable()->constrained('duty_locations')->onDelete('set null');
            $table->date('schedule_date');
            $table->datetime('start_time');          
            $table->datetime('end_time');
            $table->string('shift_type')->nullable()->comment('morning, afternoon, night, full');
            $table->text('duties')->nullable()->comment('Specific duties for the day');
            $table->string('status')->default('scheduled')->comment('scheduled, in_progress, completed, cancelled');
            $table->text('notes')->nullable();
            $table->boolean('is_recurring')->default(false);
            $table->string('recurrence_pattern')->nullable()->comment('daily, weekly, monthly');
            $table->timestamps();

            $table->index(['enforcer_id', 'schedule_date']);
            $table->index('schedule_date');
            $table->index('status');
        });
    }

    public function down()
    {
        Schema::dropIfExists('enforcer_schedules');
    }
};
