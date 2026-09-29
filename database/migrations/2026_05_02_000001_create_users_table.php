<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id('user_id');
            $table->string('email', 100)->unique();
            $table->string('password_hash', 255);
            $table->string('temp_password', 255)->nullable();
            $table->string('firstname', 50);
            $table->string('middlename', 50)->nullable();
            $table->string('lastname', 50);
            $table->string('suffix', 10)->nullable()->comment('Jr., Sr., III, etc.');
            $table->enum('role', ['admin', 'staff', 'enforcer'])->default('enforcer');
            $table->string('contact_number', 20)->nullable();
            $table->string('profile_image', 255)->nullable();
            $table->datetime('last_login')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('has_face_registered')->default(false);
            $table->timestamps();

            $table->index('role');
            $table->index('is_active');
            $table->index('email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};