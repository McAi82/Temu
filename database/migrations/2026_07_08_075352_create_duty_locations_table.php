<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('duty_locations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('address')->nullable();
            $table->decimal('latitude', 10, 8);
            $table->decimal('longitude', 11, 8);
            $table->foreignId('enforcer_id')->nullable()->constrained('users', 'user_id')->onDelete('set null');
            $table->string('schedule')->nullable();
            $table->integer('radius')->default(100)->comment('Duty radius in meters');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            $table->index('enforcer_id');
            $table->index('latitude');
            $table->index('longitude');
        });
    }

    public function down()
    {
        Schema::dropIfExists('duty_locations');
    }
};