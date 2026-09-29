<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OtpCode extends Model
{
    use HasFactory;

    public const PURPOSE_LOGIN = 'login';
    public const PURPOSE_PASSWORD_RESET = 'password_reset';

    public const MAX_ATTEMPTS = 5;
    public const TTL_MINUTES = 10;
    public const CODE_LENGTH = 6;

    protected $fillable = [
        'challenge_id',
        'user_id',
        'purpose',
        'code_hash',
        'expires_at',
        'consumed_at',
        'attempts',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'consumed_at' => 'datetime',
        'attempts' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    public function isConsumed(): bool
    {
        return $this->consumed_at !== null;
    }

    public function isExhausted(): bool
    {
        return $this->attempts >= self::MAX_ATTEMPTS;
    }

    public function isUsable(): bool
    {
        return !$this->isExpired() && !$this->isConsumed() && !$this->isExhausted();
    }

    /**
     * Invalidate every other unconsumed code for this user + purpose.
     * Prevents a user from having 5 live challenges at once.
     */
    public static function invalidatePrevious(int $userId, string $purpose): void
    {
        static::where('user_id', $userId)
            ->where('purpose', $purpose)
            ->whereNull('consumed_at')
            ->update(['consumed_at' => now()]);
    }

    /**
     * Generate a fresh code + challenge, hashed, ready to store.
     * Returns [challengeId, plaintextCode].
     */
    public static function issue(int $userId, string $purpose, ?string $ip, ?string $ua): array
    {
        static::invalidatePrevious($userId, $purpose);

        $code = self::generateCode();
        $challengeId = bin2hex(random_bytes(20)); // 40 hex chars

        static::create([
            'challenge_id' => $challengeId,
            'user_id' => $userId,
            'purpose' => $purpose,
            'code_hash' => bcrypt($code),
            'expires_at' => now()->addMinutes(self::TTL_MINUTES),
            'ip_address' => $ip,
            'user_agent' => $ua ? substr($ua, 0, 255) : null,
        ]);

        return [$challengeId, $code];
    }

    /**
     * Six-digit numeric, left-padded (so "42" becomes "000042").
     * random_int is cryptographically secure.
     */
    public static function generateCode(): string
    {
        $max = (10 ** self::CODE_LENGTH) - 1;
        return str_pad((string) random_int(0, $max), self::CODE_LENGTH, '0', STR_PAD_LEFT);
    }

    /**
     * How many codes has this user requested in the last N minutes?
     */
    public static function recentRequestCount(int $userId, string $purpose, int $minutes = 15): int
    {
        return static::where('user_id', $userId)
            ->where('purpose', $purpose)
            ->where('created_at', '>=', now()->subMinutes($minutes))
            ->count();
    }

    /**
     * Per-IP cap, independent of user, so a botnet spraying emails gets
     * blocked at the network layer.
     */
    public static function recentIpCount(string $ip, int $minutes = 60): int
    {
        return static::where('ip_address', $ip)
            ->where('created_at', '>=', now()->subMinutes($minutes))
            ->count();
    }
}