<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('appeals', function (Blueprint $table) {
            $table->id('appeal_id');
            $table->foreignId('ticket_id')->constrained('tickets', 'ticket_id')->onDelete('cascade');
            $table->foreignId('violator_id')->constrained('violators', 'violator_id')->onDelete('cascade');
            $table->text('appeal_reason');
            $table->string('supporting_documents', 255)->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected', 'under_review'])->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('users', 'user_id')->onDelete('set null');
            $table->text('review_notes')->nullable();
            $table->datetime('decision_date')->nullable();
            $table->timestamps();
            
            $table->index('ticket_id');
            $table->index('status');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appeals');
    }
};