<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('password_resets', function (Blueprint $table) {
            $table->id('reset_id');
            $table->string('email', 100);
            $table->string('token', 255);
            $table->datetime('expires_at');
            $table->timestamps();
            
            $table->index('email');
            $table->index('token');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('password_resets');
    }
};