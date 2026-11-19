<?php

namespace App\Services;

use App\Models\FaceRegistration;
use App\Models\User;

/**
 * Cross-account face duplicate detection.
 *
 * Mirrors the mobile app (faceStore.ts): same-pose cosine similarity on
 * L2-normalised 192-d MobileFaceNet embeddings. A registration is a
 * duplicate when ONE pose >= HARD_THRESHOLD, or at least SOFT_MIN_POSES
 * poses >= SOFT_THRESHOLD.
 *
 * ASSUMPTIONS (adjust to your schema):
 *  - Model App\Models\FaceRegistration, one row per user
 *  - Columns: user_id, front_encoding, left_encoding, right_encoding
 *    (JSON arrays of 192 floats; array-cast or raw JSON string both work)
 *  - If you keep inactive/rejected rows, filter them in registrationsQuery().
 */
class FaceDuplicateService
{
    public const HARD_THRESHOLD = 0.80;
    public const SOFT_THRESHOLD = 0.68;
    public const SOFT_MIN_POSES = 2;
    public const EMBEDDING_SIZE = 192;

    private const POSES = ['front', 'left', 'right'];

    /**
     * @param  array{front?:array,left?:array,right?:array}  $encodings
     * @return array{user_id:mixed,name:string,similarity:float,pose:string,matching_poses:int}|null
     */
    public function findDuplicate(array $encodings, int|string $excludeUserId): ?array
    {
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

        foreach ($this->registrationsQuery($excludeUserId)->cursor() as $reg) {
            $bestSim = -1.0;
            $bestPose = null;
            $softPoses = 0;

            foreach ($live as $pose => $vec) {
                $stored = $this->decode($reg->{$pose . '_encoding'} ?? null);
                if ($stored === null) {
                    continue;
                }
                $sim = $this->cosine($vec, $this->normalize($stored));
                if ($sim > $bestSim) {
                    $bestSim = $sim;
                    $bestPose = $pose;
                }
                if ($sim >= self::SOFT_THRESHOLD) {
                    $softPoses++;
                }
            }

            if ($bestPose === null) {
                continue;
            }

            $isDuplicate = $bestSim >= self::HARD_THRESHOLD
                || $softPoses >= self::SOFT_MIN_POSES;

            if ($isDuplicate && ($best === null || $bestSim > $best['similarity'])) {
                $best = [
                    'user_id' => $reg->user_id,
                    'similarity' => round($bestSim, 4),
                    'pose' => $bestPose,
                    'matching_poses' => $softPoses,
                ];
            }
        }

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