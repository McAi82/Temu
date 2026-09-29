<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id('setting_id');
            $table->string('setting_key', 100)->unique();
            $table->text('setting_value')->nullable();
            $table->enum('setting_type', ['text', 'number', 'boolean', 'json', 'file'])->default('text');
            $table->text('description')->nullable();
            $table->string('group_name', 50)->nullable();
            $table->timestamps();
            
            $table->index('setting_key');
            $table->index('group_name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};