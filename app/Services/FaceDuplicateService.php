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
 * A registration is a duplicate only when ENOUGH POSES agree (default: all 3).
 * Each pose (front / left / right) is compared to the same pose of the other
 * account and must reach its own threshold:
 *   level 'block'  : at least min_poses poses >= their block threshold -> reject
 *   level 'review' : at least min_poses poses >= (block - margin)      -> allow + warn
 * One strong pose on its own (e.g. only the front matching) never blocks.
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
     * Closest other account from the LAST findDuplicate() call, even when it
     * was not a duplicate (so callers can log / show the real scores).
     * @var array{user_id:mixed,sims:array,mean:float,poses_passed:int,level:?string}|null
     */
    public ?array $lastComparison = null;

    /**
     * @return array{level:string,user_id:mixed,name:string,similarity:float,pose:string,scores:array}|null
     */
    public function findDuplicate(array $encodings, int|string $excludeUserId): ?array
    {
        $block = (float) config('face.duplicate.block', 0.72);
        $review = (float) config('face.duplicate.review', 0.65);
        $minPoses = max(1, min(count(self::POSES), (int) config('face.duplicate.min_poses', 3)));
        $margin = max(0.0, $block - $review);

        // Per-pose block thresholds. Left/right turns usually score lower than
        // the front, so they can be tuned separately (default: same as front).
        $poseBlock = [
            'front' => $block,
            'left'  => (float) config('face.duplicate.block_left', $block),
            'right' => (float) config('face.duplicate.block_right', $block),
        ];

        $live = [];
        foreach (self::POSES as $pose) {
            $v = $encodings[$pose] ?? null;
            if (is_array($v) && count($v) === self::EMBEDDING_SIZE) {
                $live[$pose] = $this->normalize(array_map('floatval', $v));
            }
        }
        // Can't confirm a duplicate if we were not given enough poses.
        if (count($live) < $minPoses) {
            return null;
        }

        $best = null;
        $candidates = []; // for tuning logs
        $this->lastComparison = null;

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

            // How many poses agree with this account?
            $passBlock = 0;
            $passReview = 0;
            foreach ($sims as $pose => $sim) {
                if ($sim >= $poseBlock[$pose]) {
                    $passBlock++;
                }
                if ($sim >= $poseBlock[$pose] - $margin) {
                    $passReview++;
                }
            }

            $level = null;
            if ($passBlock >= $minPoses) {
                $level = 'block';
            } elseif ($passReview >= $minPoses) {
                $level = 'review';
            }

            // Rank by the average over all compared poses.
            $rank = round(array_sum($sims) / count($sims), 4);

            $candidates[] = [
                'user_id' => $reg->user_id,
                'sims' => $sims,
                'mean' => $rank,
                'poses_passed' => $passBlock,
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
                        'pose' => isset($sims['front']) ? 'front' : array_key_first($sims),
                        'scores' => $sims,
                    ];
                }
            }
        }

        usort($candidates, fn ($a, $b) => $b['mean'] <=> $a['mean']);
        $this->lastComparison = $candidates[0] ?? null;
        Log::info('face-duplicate check', [
            'checking_user_id' => $excludeUserId,
            'compared' => count($candidates),
            'min_poses' => $minPoses,
            'pose_thresholds' => $poseBlock,
            'review_margin' => $margin,
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
        // Only ACTIVE registrations count. Archived rows (replaced, reset or
        // transferred faces) must not block anyone, otherwise a transferred
        // face would keep matching its own old copy forever.
        return FaceRegistration::query()
            ->where('is_active', true)
            ->where('user_id', '!=', $excludeUserId);
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