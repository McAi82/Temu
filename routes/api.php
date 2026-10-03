<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\API\TicketController;
use App\Http\Controllers\API\ViolatorController;
use App\Http\Controllers\API\VehicleController;
use App\Http\Controllers\API\ViolationController;
use App\Http\Controllers\API\UserController;
use App\Http\Controllers\API\AttendanceController;
use App\Http\Controllers\API\ReportController;
use App\Http\Controllers\API\FaceController;
use App\Http\Controllers\API\DutyLocationController;
use App\Http\Controllers\API\ScheduleController;
use App\Http\Controllers\API\LocationController;
use App\Http\Controllers\API\ProfileController;
use App\Http\Controllers\API\NotificationController;
use App\Http\Controllers\API\PaymentController;
use App\Http\Controllers\API\PasswordResetController;
use App\Http\Controllers\API\DeviceSwitchController;
use App\Http\Controllers\API\ArchiveController;

/*
|--------------------------------------------------------------------------
| PUBLIC ROUTES
|--------------------------------------------------------------------------
*/

Route::get('/public-ticket/{ticketNumber}', [TicketController::class, 'publicShow']);
Route::post('/tickets/{id}/save-qr',        [TicketController::class, 'saveQRCode']);

Route::get('/attendance/photo/{path}', function ($path) {
    if (Storage::disk('public')->exists($path)) {
        return response()->file(Storage::disk('public')->path($path));
    }
    abort(404);
})->where('path', '.*');

/*
|--------------------------------------------------------------------------
| HEALTH CHECK
|--------------------------------------------------------------------------
*/
Route::get('/health', fn() => response()->json([
    'status' => 'ok',
    'time'   => now()->toIso8601String(),
]));

/*
|--------------------------------------------------------------------------
| AUTHENTICATION ROUTES (public)
|--------------------------------------------------------------------------
*/

Route::post('/Mobilelogin', [AuthController::class, 'Mobilelogin']);
Route::post('/Weblogin',    [AuthController::class, 'Weblogin']);

Route::post('/Weblogin/otp/verify', [AuthController::class, 'WebloginVerifyOtp'])
    ->middleware('throttle:10,1');

Route::post('/PasswordReset/request', [PasswordResetController::class, 'request'])
    ->middleware('throttle:5,1');
Route::post('/PasswordReset/verify', [PasswordResetController::class, 'verify'])
    ->middleware('throttle:10,1');

Route::post('/DeviceSwitch/request', [DeviceSwitchController::class, 'request'])
    ->middleware('throttle:5,1');
Route::post('/DeviceSwitch/verify', [DeviceSwitchController::class, 'verify'])
    ->middleware('throttle:10,1');
Route::get('/DeviceSwitch/status', [DeviceSwitchController::class, 'status'])
    ->middleware('throttle:30,1');

/*
|--------------------------------------------------------------------------
| FACE SERVICE ROUTES (X-API-Key, NOT Sanctum)
|--------------------------------------------------------------------------
*/

Route::prefix('faces')->group(function () {
    Route::post('/register',   [FaceController::class, 'register']);
    Route::get('/encodings',   [FaceController::class, 'getEncodings']);
    Route::delete('/{userId}', [FaceController::class, 'delete'])
        ->where('userId', '[0-9]+');
});

/*
|--------------------------------------------------------------------------
| PROTECTED ROUTES (Sanctum)
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {

    Route::get('/available-enforcers', [ScheduleController::class, 'availableEnforcers']);
    Route::put('/{id}/replace-enforcer', [ScheduleController::class, 'replaceEnforcer'])
        ->where('id', '[0-9]+');

    /*
    |----------------------- PAYMENTS (Staff + Admin) -----------------------
    */
    Route::prefix('payments')->middleware('staff')->group(function () {
        Route::get('/',              [PaymentController::class, 'index']);
        Route::get('/pending',       [PaymentController::class, 'pending']);
        Route::get('/ticket/{ticketId}', [PaymentController::class, 'byTicket'])
            ->where('ticketId', '[0-9]+');
        Route::get('/{id}',          [PaymentController::class, 'show'])
            ->where('id', '[0-9]+');
        Route::post('/',             [PaymentController::class, 'store']);
    });

    Route::put('/payments/{id}/void', [PaymentController::class, 'void'])
        ->where('id', '[0-9]+')
        ->middleware('admin');

    /*
    |----------------------- AUTH / PROFILE -----------------------
    */
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/me',               [AuthController::class, 'profile']);
    Route::get('/profile',          [AuthController::class, 'profile']);
    Route::put('/profile',          [ProfileController::class, 'update']);
    Route::post('/profile/image',   [ProfileController::class, 'uploadProfileImage']);
    Route::delete('/profile/image', [ProfileController::class, 'removeProfileImage']);

    /*
    |----------------------- FACES (mobile — flag only) -----------------------
    */
    Route::post('/faces/register-local', [FaceController::class, 'registerLocal']);
    Route::delete('/faces/register-local', [FaceController::class, 'unregisterLocal']);

    /*
    |----------------------- NOTIFICATIONS -----------------------
    */
    Route::prefix('notifications')->group(function () {
        Route::get('/',            [NotificationController::class, 'index']);
        Route::get('/summary',     [NotificationController::class, 'summary']);
        Route::get('/poll',        [NotificationController::class, 'poll']);
        Route::put('/read-all',    [NotificationController::class, 'markAllAsRead']);
        Route::put('/{id}/read',   [NotificationController::class, 'markAsRead'])
            ->where('id', '[0-9]+');
        Route::delete('/',         [NotificationController::class, 'clear']);
        Route::delete('/{id}',     [NotificationController::class, 'destroy'])
            ->where('id', '[0-9]+');
    });

    /*
    |----------------------- TICKETS -----------------------
    */
    Route::prefix('tickets')->group(function () {
        Route::get('/',            [TicketController::class, 'index']);
        Route::get('/statistics',  [TicketController::class, 'statistics']);
        Route::get('/search',      [TicketController::class, 'search']);
        Route::post('/',           [TicketController::class, 'store']);
        Route::get('/{id}',        [TicketController::class, 'show'])
            ->where('id', '[0-9]+');
        Route::put('/{id}/status', [TicketController::class, 'updateStatus'])
            ->where('id', '[0-9]+');

        // Archive (replaces destroy)
        Route::delete('/{id}',     [TicketController::class, 'destroy'])
            ->where('id', '[0-9]+')
            ->middleware('admin');
    });
    Route::get('/my-tickets', [TicketController::class, 'getMyTickets']);

    /*
    |----------------------- VIOLATORS -----------------------
    */
    Route::prefix('violators')->group(function () {
        Route::get('/',    [ViolatorController::class, 'index']);
        Route::post('/',   [ViolatorController::class, 'store']);
        Route::get('/search/license/{license}', [ViolatorController::class, 'searchByLicense']);
        Route::get('/{id}',    [ViolatorController::class, 'show'])->where('id', '[0-9]+');
        Route::put('/{id}',    [ViolatorController::class, 'update'])->where('id', '[0-9]+');

        Route::delete('/{id}', [ViolatorController::class, 'destroy'])
            ->where('id', '[0-9]+')
            ->middleware('admin');
    });

    /*
    |----------------------- VEHICLES -----------------------
    */
    Route::prefix('vehicles')->group(function () {
        Route::get('/',    [VehicleController::class, 'index']);
        Route::post('/',   [VehicleController::class, 'store']);
        Route::get('/search/plate/{plate}', [VehicleController::class, 'searchByPlate']);
        Route::get('/{id}',    [VehicleController::class, 'show'])->where('id', '[0-9]+');
        Route::put('/{id}',    [VehicleController::class, 'update'])->where('id', '[0-9]+');
        Route::delete('/{id}', [VehicleController::class, 'destroy'])->where('id', '[0-9]+');
    });

    /*
    |----------------------- VIOLATION TYPES -----------------------
    */
    Route::prefix('violations')->group(function () {
        Route::get('/',    [ViolationController::class, 'index']);
        Route::get('/{id}', [ViolationController::class, 'show'])->where('id', '[0-9]+');

        Route::middleware('admin')->group(function () {
            Route::post('/',   [ViolationController::class, 'store']);
            Route::put('/{id}', [ViolationController::class, 'update'])->where('id', '[0-9]+');
            Route::delete('/{id}', [ViolationController::class, 'destroy'])->where('id', '[0-9]+');
        });
    });

    /*
    |----------------------- USERS (Admin) -----------------------
    */
    Route::prefix('users')->group(function () {
        Route::get('/',     [UserController::class, 'index']);
        Route::post('/',    [UserController::class, 'store']);
        Route::get('/{id}',    [UserController::class, 'show'])->where('id', '[0-9]+');
        Route::put('/{id}',    [UserController::class, 'update'])->where('id', '[0-9]+');
        Route::delete('/{id}', [UserController::class, 'destroy'])->where('id', '[0-9]+');
        Route::put('/{id}/toggle-status',   [UserController::class, 'toggleStatus'])->where('id', '[0-9]+');
        Route::post('/{id}/reset-password', [UserController::class, 'resetPassword'])->where('id', '[0-9]+');
    });

    /*
    |----------------------- ATTENDANCE -----------------------
    */
    Route::prefix('attendance')->group(function () {
        Route::get('/',         [AttendanceController::class, 'index']);
        Route::get('/statistics', [AttendanceController::class, 'statistics']);
        Route::get('/today',    [AttendanceController::class, 'getTodayAttendance']);
        Route::get('/my-history', [AttendanceController::class, 'getMyAttendanceHistory']);
        Route::get('/enforcer/{enforcerId}', [AttendanceController::class, 'getByEnforcer'])
            ->where('enforcerId', '[0-9]+');
        Route::post('/time-in',  [AttendanceController::class, 'timeIn']);
        Route::post('/time-out', [AttendanceController::class, 'timeOut']);
        Route::get('/{id}',      [AttendanceController::class, 'show'])->where('id', '[0-9]+');
    });
    Route::get('/my-attendance',         [AttendanceController::class, 'getMyAttendance']);
    Route::get('/my-attendance-history', [AttendanceController::class, 'getMyAttendanceHistory']);
    Route::get('/today-attendance',      [AttendanceController::class, 'getTodayAttendance']);

    /*
    |----------------------- REPORTS -----------------------
    | NOTE: /reports must come before /reports/{anything} is not a
    | concern here, but declare the bare /reports AFTER the specific
    | routes so Laravel routes them predictably.
    */
    Route::prefix('reports')->group(function () {
        Route::get('/today',  [ReportController::class, 'todayReport']);
        Route::get('/weekly', [ReportController::class, 'weeklyReport']);
        Route::get('/export', [ReportController::class, 'exportReport']);
        Route::get('/',       [ReportController::class, 'report']);
    });

    /*
    |----------------------- DUTY LOCATIONS -----------------------
    */
    Route::prefix('duty-locations')->group(function () {
        Route::get('/',    [DutyLocationController::class, 'index']);
        Route::post('/',   [DutyLocationController::class, 'store']);
        Route::get('/nearby', [DutyLocationController::class, 'getNearby']);
        Route::get('/enforcer/{enforcerId}', [DutyLocationController::class, 'getEnforcerDuties'])
            ->where('enforcerId', '[0-9]+');
        Route::get('/{id}',    [DutyLocationController::class, 'show'])->where('id', '[0-9]+');
        Route::put('/{id}',    [DutyLocationController::class, 'update'])->where('id', '[0-9]+');
        Route::delete('/{id}', [DutyLocationController::class, 'destroy'])->where('id', '[0-9]+');
    });

    /*
    |----------------------- SCHEDULES -----------------------
    */
    Route::prefix('schedules')->group(function () {
        Route::get('/',                    [ScheduleController::class, 'index']);
        Route::post('/',                   [ScheduleController::class, 'store']);
        Route::get('/today',               [ScheduleController::class, 'getTodaySchedules']);
        Route::get('/weekly',              [ScheduleController::class, 'getWeeklySchedules']);
        Route::get('/available-enforcers', [ScheduleController::class, 'availableEnforcers']);

        Route::get('/enforcer/{enforcerId}', [ScheduleController::class, 'getEnforcerSchedules'])
            ->where('enforcerId', '[0-9]+');
        Route::get('/{id}',    [ScheduleController::class, 'show'])
            ->where('id', '[0-9]+');
        Route::put('/{id}',    [ScheduleController::class, 'update'])
            ->where('id', '[0-9]+');
        Route::delete('/{id}', [ScheduleController::class, 'destroy'])
            ->where('id', '[0-9]+');
        Route::put('/{id}/status', [ScheduleController::class, 'updateStatus'])
            ->where('id', '[0-9]+');
        Route::put('/{id}/replace-enforcer', [ScheduleController::class, 'replaceEnforcer'])
            ->where('id', '[0-9]+');
    });

    /*
    |----------------------- LOCATION -----------------------
    */
    Route::prefix('location')->group(function () {
        Route::get('/me',    [LocationController::class, 'get']);
        Route::get('/active', [LocationController::class, 'getAllActive']);
        Route::get('/enforcer/{enforcerId}', [LocationController::class, 'getEnforcer'])
            ->where('enforcerId', '[0-9]+');
        Route::post('/update',    [LocationController::class, 'update']);
        Route::post('/heartbeat', [LocationController::class, 'heartbeat']);
        Route::post('/offline',   [LocationController::class, 'markOffline']);
    });

    /*
    |----------------------- ARCHIVES -----------------------
    | GET  /archives/{resource}             — list archived (staff+admin)
    | PUT  /archives/{resource}/{id}/restore — restore (admin only)
    */
    Route::prefix('archives')->middleware('staff')->group(function () {
        Route::get('/{resource}', [ArchiveController::class, 'index'])
            ->where('resource', 'tickets|violators|vehicles|violations|users|schedules|duty-locations|payments');

        Route::put('/{resource}/{id}/restore', [ArchiveController::class, 'restore'])
            ->where('resource', 'tickets|violators|vehicles|violations|users|schedules|duty-locations|payments')
            ->where('id', '[0-9]+')
            ->middleware('admin');
    });
});
