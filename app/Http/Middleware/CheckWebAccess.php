<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckWebAccess
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        
        // Only admin and staff can access web features
        if (!in_array($user->role, ['admin', 'staff'])) {
            return response()->json([
                'message' => 'Web access denied. Only admin and staff can access this resource.'
            ], 403);
        }
        
        return $next($request);
    }
}