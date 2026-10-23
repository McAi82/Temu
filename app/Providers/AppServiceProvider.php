<?php

namespace App\Providers;

use App\Models\FaceRegistration;
use App\Observers\FaceRegistrationObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        FaceRegistration::observe(FaceRegistrationObserver::class);
    }
}