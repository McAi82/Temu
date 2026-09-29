<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckMobileAccess
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        
        // Only enforcers can access mobile features
        if ($user->role !== 'enforcer') {
            return response()->json([
                'message' => 'Mobile access denied. Only enforcers can access this resource.'
            ], 403);
        }
        
        return $next($request);
    }
}