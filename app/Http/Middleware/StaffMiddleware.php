<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class StaffMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user || !in_array($user->role, ['admin', 'staff'], true)) {
            return response()->json([
                'message' => 'Access denied. Staff only.',
            ], 403);
        }

        return $next($request);
    }
}