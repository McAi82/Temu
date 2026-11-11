<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ticket_violations', function (Blueprint $table) {
            $table->id('ticket_violation_id');
            $table->foreignId('ticket_id')->constrained('tickets', 'ticket_id')->onDelete('cascade');
            $table->foreignId('violation_id')->constrained('violation_types', 'violation_id')->onDelete('cascade');
            $table->decimal('fine_amount', 10, 2)->comment('Fine at time of violation');
            $table->integer('demerit_points')->default(0);
            $table->timestamps();
            
            $table->unique(['ticket_id', 'violation_id']);
            $table->index('ticket_id');
            $table->index('violation_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_violations');
    }
};