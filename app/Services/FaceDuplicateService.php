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
 * Duplicate when:
 *   - any pose >= hard, OR
 *   - >= min_poses poses >= soft AND (front >= soft when require_front)
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

    public function findDuplicate(array $encodings, int|string $excludeUserId): ?array
    {
        $hard = (float) config('face.duplicate.hard', 0.90);
        $soft = (float) config('face.duplicate.soft', 0.80);
        $minPoses = (int) config('face.duplicate.min_poses', 2);
        $requireFront = (bool) config('face.duplicate.require_front', true);

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

            arsort($sims);
            $bestPose = array_key_first($sims);
            $bestSim = $sims[$bestPose];
            $softPoses = count(array_filter($sims, fn ($s) => $s >= $soft));
            $frontOk = isset($sims['front']) && $sims['front'] >= $soft;

            $isDuplicate = $bestSim >= $hard
                || ($softPoses >= $minPoses && (!$requireFront || $frontOk));

            $candidates[] = [
                'user_id' => $reg->user_id,
                'sims' => $sims,
                'best' => $bestSim,
                'dup' => $isDuplicate,
            ];

            if ($isDuplicate && ($best === null || $bestSim > $best['similarity'])) {
                $best = [
                    'user_id' => $reg->user_id,
                    'similarity' => $bestSim,
                    'pose' => $bestPose,
                    'matching_poses' => $softPoses,
                    'scores' => $sims,
                ];
            }
        }

        // Log the closest 3 candidates so thresholds can be tuned from real data.
        usort($candidates, fn ($a, $b) => $b['best'] <=> $a['best']);
        Log::info('face-duplicate check', [
            'checking_user_id' => $excludeUserId,
            'compared' => count($candidates),
            'thresholds' => compact('hard', 'soft', 'minPoses', 'requireFront'),
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