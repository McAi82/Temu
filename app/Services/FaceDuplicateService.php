<?php

namespace App\Services;

use App\Models\FaceRegistration;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Cross-account face duplicate detection (server database only).
 *
 * Same-pose cosine similarity on L2-normalised 192-d embeddings.
 * Thresholds live in config/face.php (override with FACE_DUP_* in .env).
 *
 * Returns the closest other account when it is at least in the review band:
 *   level 'block'  : front >= block  OR any pose >= hard  -> reject
 *   level 'review' : review <= front < block              -> allow + warn
 *
 * ASSUMPTIONS (adjust to your schema):
 *  - Model App\Models\FaceRegistration, one row per user
 *  - Columns: user_id, front_encoding, left_encoding, right_encoding
 *    (JSON arrays of 192 floats; array-cast or raw JSON string both work)
 */
class FaceDuplicateService
{
    public const EMBEDDING_SIZE = 192;
    private const POSES = ['front', 'left', 'right'];

    /**
     * @return array{level:string,user_id:mixed,name:string,similarity:float,pose:string,scores:array}|null
     */
    public function findDuplicate(array $encodings, int|string $excludeUserId): ?array
    {
        $block = (float) config('face.duplicate.block', 0.72);
        $review = (float) config('face.duplicate.review', 0.65);
        $hard = (float) config('face.duplicate.hard', 0.95);

        $live = [];
        foreach (self::POSES as $pose) {
            $v = $encodings[$pose] ?? null;
            if (is_array($v) && count($v) === self::EMBEDDING_SIZE) {
                $live[$pose] = $this->normalize(array_map('floatval', $v));
            }
        }
        if (!$live) {
            return null;
        }

        $best = null;
        $candidates = []; // for tuning logs

        foreach ($this->registrationsQuery($excludeUserId)->cursor() as $reg) {
            $sims = [];
            foreach ($live as $pose => $vec) {
                $stored = $this->decode($reg->{$pose . '_encoding'} ?? null);
                if ($stored === null) {
                    continue;
                }
                $sims[$pose] = round($this->cosine($vec, $this->normalize($stored)), 4);
            }
            if (!$sims) {
                continue;
            }

            $front = $sims['front'] ?? null;
            $maxPose = array_search(max($sims), $sims, true);
            $maxSim = $sims[$maxPose];

            $level = null;
            if ($maxSim >= $hard || ($front !== null && $front >= $block)) {
                $level = 'block';
            } elseif ($front !== null && $front >= $review) {
                $level = 'review';
            }

            // Rank candidates by front score (fall back to best pose).
            $rank = $front ?? $maxSim;

            $candidates[] = [
                'user_id' => $reg->user_id,
                'sims' => $sims,
                'level' => $level,
            ];

            if ($level !== null) {
                $better = $best === null
                    || ($level === 'block' && $best['level'] !== 'block')
                    || ($level === $best['level'] && $rank > $best['similarity']);
                if ($better) {
                    $best = [
                        'level' => $level,
                        'user_id' => $reg->user_id,
                        'similarity' => $rank,
                        'pose' => $front !== null ? 'front' : $maxPose,
                        'scores' => $sims,
                    ];
                }
            }
        }

        usort(
            $candidates,
            fn ($a, $b) => ($b['sims']['front'] ?? 0) <=> ($a['sims']['front'] ?? 0)
        );
        Log::info('face-duplicate check', [
            'checking_user_id' => $excludeUserId,
            'compared' => count($candidates),
            'thresholds' => compact('block', 'review', 'hard'),
            'top' => array_slice($candidates, 0, 3),
        ]);

        if ($best === null) {
            return null;
        }

        $user = User::find($best['user_id']);
        $best['name'] = $user
            ? trim(($user->firstname ?? '') . ' ' . ($user->lastname ?? ''))
            : 'another account';
        if ($best['name'] === '') {
            $best['name'] = 'another account';
        }

        return $best;
    }

    private function registrationsQuery(int|string $excludeUserId)
    {
        return FaceRegistration::query()->where('user_id', '!=', $excludeUserId);
    }

    private function decode(mixed $raw): ?array
    {
        if (is_string($raw)) {
            $raw = json_decode($raw, true);
        }
        if (!is_array($raw) || count($raw) !== self::EMBEDDING_SIZE) {
            return null;
        }
        return array_map('floatval', $raw);
    }

    private function normalize(array $v): array
    {
        $sum = 0.0;
        foreach ($v as $x) {
            $sum += $x * $x;
        }
        $norm = sqrt($sum);
        if ($norm <= 0.0) {
            return $v;
        }
        foreach ($v as $i => $x) {
            $v[$i] = $x / $norm;
        }
        return $v;
    }

    private function cosine(array $a, array $b): float
    {
        $dot = 0.0;
        $n = min(count($a), count($b));
        for ($i = 0; $i < $n; $i++) {
            $dot += $a[$i] * $b[$i];
        }
        return $dot;
    }
}