<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id('payment_id');

            // ---- Foreign keys ----
            $table->foreignId('ticket_id')
                ->constrained('tickets', 'ticket_id')
                ->onDelete('cascade');

            // ---- Payment identity ----
            $table->string('payment_reference', 100)->unique();
            $table->string('receipt_number', 50)->unique();   // ← enforced unique (staff input)
            $table->string('transaction_id', 100)->nullable()
                ->comment('Gateway transaction ID (GCash/Maya/bank ref)');

            // ---- Amount & timing ----
            $table->decimal('amount_paid', 10, 2);
            $table->datetime('payment_date')->useCurrent();

            // ---- Method & state ----
            $table->enum('payment_method', [
                'cash',
                'online_banking',
                'gcash',
                'maya',
                'over_the_counter',
            ]);

            $table->enum('payment_status', [
                'pending',
                'completed',
                'failed',
                'refunded',
            ])->default('pending');

            // ---- Receipt / payer metadata ----
            $table->string('receipt_path', 255)->nullable();
            $table->string('paid_by', 100)->nullable();
            $table->text('notes')->nullable();

            $table->timestamps();

            // ---- Indexes ----
            $table->index('ticket_id');
            $table->index('payment_reference');
            $table->index('payment_status');
            $table->index('payment_date');
            $table->index(['ticket_id', 'payment_status'], 'payments_ticket_status_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};