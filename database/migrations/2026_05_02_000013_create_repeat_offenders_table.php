<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('repeat_offenders', function (Blueprint $table) {
            $table->id('offender_id');
            $table->foreignId('violator_id')->constrained('violators', 'violator_id')->onDelete('cascade');
            $table->integer('total_violations')->default(0);
            $table->integer('total_demerit_points')->default(0);
            $table->decimal('total_fines', 12, 2)->default(0);
            $table->datetime('last_violation_date')->nullable();
            $table->boolean('is_flagged')->default(false);
            $table->string('flag_reason', 255)->nullable();
            $table->timestamps();
            
            $table->unique('violator_id');
            $table->index('total_violations');
            $table->index('is_flagged');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('repeat_offenders');
    }
};