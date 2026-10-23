<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::create('enforcer_locations', function (Blueprint $table) {
            $table->id('location_id');
            $table->foreignId('enforcer_id')->constrained('users', 'user_id')->onDelete('cascade');
            $table->decimal('latitude', 10, 8);
            $table->decimal('longitude', 11, 8);
            $table->decimal('accuracy', 10, 2)->nullable();
            $table->decimal('speed', 10, 2)->nullable();
            $table->datetime('last_updated');
            $table->boolean('is_online')->default(true);
            $table->timestamps();

            $table->unique('enforcer_id');
            $table->index(['latitude', 'longitude']);
            $table->index('is_online');
            $table->index('last_updated');
        });
    }

    public function down()
    {
        Schema::dropIfExists('enforcer_locations');
    }
};