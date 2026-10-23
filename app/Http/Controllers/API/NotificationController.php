<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $perPage = (int) $request->get('per_page', 30);

        $query = Notification::where('user_id', $user->user_id)
            ->orderBy('created_at', 'desc');

        if ($request->boolean('unread_only')) {
            $query->where('is_read', false);
        }

        if ($request->filled('since')) {
            $query->where('created_at', '>', $request->since);
        }

        $notifications = $query->paginate($perPage);

        return response()->json([
            'data' => $notifications->items(),
            'meta' => [
                'current_page' => $notifications->currentPage(),
                'last_page' => $notifications->lastPage(),
                'per_page' => $notifications->perPage(),
                'total' => $notifications->total(),
            ],
            'unread_count' => Notification::where('user_id', $user->user_id)
                ->where('is_read', false)
                ->count(),
        ]);
    }

    public function summary(Request $request)
    {
        $user = $request->user();

        $unreadCount = Notification::where('user_id', $user->user_id)
            ->where('is_read', false)
            ->count();

        $latest = Notification::where('user_id', $user->user_id)
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get();

        return response()->json([
            'unread_count' => $unreadCount,
            'latest' => $latest,
            'server_time' => now()->toIso8601String(),
        ]);
    }

    public function poll(Request $request)
    {
        $user = $request->user();
        $since = $request->get('since');

        $query = Notification::where('user_id', $user->user_id)
            ->orderBy('created_at', 'desc');

        if ($since) {
            $query->where('created_at', '>', $since);
        } else {
            $query->limit(30);
        }

        return response()->json([
            'data' => $query->get(),
            'unread_count' => Notification::where('user_id', $user->user_id)
                ->where('is_read', false)
                ->count(),
            'server_time' => now()->toIso8601String(),
        ]);
    }

    public function markAsRead(Request $request, $id)
    {
        $user = $request->user();

        $notification = Notification::where('notification_id', $id)
            ->where('user_id', $user->user_id)
            ->first();

        if (!$notification) {
            return response()->json(['message' => 'Notification not found'], 404);
        }

        $notification->is_read = true;
        $notification->save();

        return response()->json([
            'message' => 'Notification marked as read',
            'notification' => $notification,
        ]);
    }

    public function markAllAsRead(Request $request)
    {
        $user = $request->user();

        $updated = Notification::where('user_id', $user->user_id)
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return response()->json([
            'message' => 'All notifications marked as read',
            'updated' => $updated,
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $user = $request->user();

        $notification = Notification::where('notification_id', $id)
            ->where('user_id', $user->user_id)
            ->first();

        if (!$notification) {
            return response()->json(['message' => 'Notification not found'], 404);
        }

        $notification->delete();

        return response()->json(['message' => 'Notification deleted']);
    }

    public function clear(Request $request)
    {
        $user = $request->user();

        $deleted = Notification::where('user_id', $user->user_id)->delete();

        return response()->json([
            'message' => 'Notifications cleared',
            'deleted' => $deleted,
        ]);
    }
}