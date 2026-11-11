<?php
// backend/database/migrations/[timestamp]_create_faces_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::create('faces', function (Blueprint $table) {
            $table->id('face_id');
            $table->foreignId('user_id')->constrained('users', 'user_id')->onDelete('cascade');
            $table->json('encoding')->comment('Face encoding vector');
            $table->float('confidence')->default(0);
            $table->float('quality_score')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique('user_id');
            $table->index(['user_id', 'is_active']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('faces');
    }
};