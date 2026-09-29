<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| The SPA handles all non-API routes. Client-side routing (React Router)
| resolves paths like /login, /tickets, /dashboard, etc.
|
*/

// SPA catch-all — must be LAST so /api/* and /storage/* don't get swallowed.
Route::get('/{any}', function () {
    return view('app');
})->where('any', '^(?!api|storage|build|favicon\.svg|robots\.txt).*$');