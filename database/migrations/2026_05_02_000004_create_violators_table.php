<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('violators', function (Blueprint $table) {
            $table->id('violator_id');
            $table->string('firstname', 50);
            $table->string('middlename', 50)->nullable();
            $table->string('lastname', 50);
            $table->string('suffix', 10)->nullable()->comment('Jr., Sr., III, etc.');
            $table->string('license', 50)->unique();
            $table->date('expiry');
            $table->date('birthday');
            $table->string('height', 10)->nullable();
            $table->enum('gender', ['Male', 'Female', 'Other'])->nullable();
            $table->string('prof_non_prof', 20)->nullable()->comment('Professional or Non-Professional');
            $table->string('nationality', 50)->default('Filipino');
            $table->string('weight', 10)->nullable();
            $table->string('restriction', 50)->nullable();
            $table->string('email', 100)->nullable();
            $table->string('contact_number', 20)->nullable();
            $table->text('address')->nullable();
            $table->string('profile_photo', 255)->nullable();
            $table->timestamps();
            
            $table->index('license');
            $table->index(['firstname', 'lastname']);
            $table->index('expiry');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('violators');
    }
};