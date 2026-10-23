<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->id('vehicle_id');
            $table->string('platenumber', 20)->unique();
            $table->string('owner', 100);
            $table->text('address')->nullable();
            $table->string('make', 50)->nullable();
            $table->string('color', 30)->nullable();
            $table->string('model', 50)->nullable();
            $table->integer('year_model')->nullable();
            $table->string('body_type', 50)->nullable();
            $table->string('engine_number', 50)->nullable();
            $table->string('chassis_number', 50)->nullable();
            $table->string('marking', 100)->nullable();
            $table->string('place_of_violation', 255)->nullable();
            $table->string('or_number', 50)->nullable();
            $table->string('cr_number', 50)->nullable();
            $table->date('registration_expiry')->nullable();
            $table->timestamps();
            
            $table->index('platenumber');
            $table->index('owner');
            $table->index('registration_expiry');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicles');
    }
};