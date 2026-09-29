<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('violation_types', function (Blueprint $table) {
            $table->id('violation_id');
            $table->string('violation_code', 20)->unique();
            $table->string('violation_name', 100);
            $table->text('description')->nullable();
            $table->decimal('fine_amount', 10, 2)->default(0);
            $table->integer('demerit_points')->default(0);
            $table->boolean('is_active')->default(true);
            $table->string('category', 50)->nullable()->comment('Traffic Rules, Documents, Vehicle Condition, etc.');
            $table->timestamps();
            
            $table->index('violation_name');
            $table->index('category');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('violation_types');
    }
};