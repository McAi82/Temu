<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckRole
{
    public function handle(Request $request, Closure $next, ...$roles)
    {
        $user = $request->user();
        
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        
        // Check if user's role is in the allowed roles list
        if (!in_array($user->role, $roles)) {
            return response()->json([
                'message' => 'Access denied. Required role: ' . implode(' or ', $roles)
            ], 403);
        }
        
        return $next($request);
    }
}