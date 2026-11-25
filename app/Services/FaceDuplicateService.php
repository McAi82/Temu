<?php

namespace App\Services;

use App\Models\FaceRegistration;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class FaceDuplicateService
{
    public const EMBEDDING_SIZE = 192;
    private const POSES = ['front', 'left', 'right'];

    /**
     * Closest other account from the LAST findDuplicate() call, even when it
     * was not a duplicate (so callers can log / show the real scores).
     *
     * 'sims' = best similarity per live pose (best over the candidate's stored poses)
     *
     * @var array{user_id:mixed,registration_id:mixed,archived:bool,sims:array,same_pose:array,front:?float,mean:float,rank:float,poses_passed:int,level:?string}|null
     */
    public ?array $lastComparison = null;

    /**
     * @return array{level:string,user_id:mixed,registration_id:mixed,archived:bool,name:string,similarity:float,pose:string,scores:array}|null
     */
    public function findDuplicate(array $encodings, int|string $excludeUserId): ?array
    {
        $cfg = $this->thresholds();
        $minPoses = max(1, min(count(self::POSES), (int) config('face.duplicate.min_poses', 3)));

        $this->lastComparison = null;

        $live = $this->prepareLive($encodings);
        // Can't confirm a duplicate if we were not given enough poses.
        if (count($live) < $minPoses) {
            return null;
        }

        $best = null;
        $candidates = []; // for tuning logs

        foreach ($this->registrationsQuery($excludeUserId)->cursor() as $reg) {
            $score = $this->score($live, $this->prepareStored($reg), $cfg);
            if ($score === null) {
                continue;
            }

            $level = $this->levelFor($score, $cfg);

            $candidates[] = [
                'user_id'         => $reg->user_id,
                'registration_id' => $reg->getKey(),
                'archived'        => !$reg->is_active,
                'sims'            => $score['best'],
                'same_pose'       => $score['same'],
                'front'           => $score['front'],
                'mean'            => $score['mean'],
                'rank'            => $score['rank'],
                'poses_passed'    => $score['passed_block'],
                'level'           => $level,
            ];

            if ($level !== null) {
                $better = $best === null
                    || ($level === 'block' && $best['level'] !== 'block')
                    || ($level === $best['level'] && $score['rank'] > $best['similarity']);
                if ($better) {
                    $best = [
                        'level'           => $level,
                        'user_id'         => $reg->user_id,
                        'registration_id' => $reg->getKey(),
                        'archived'        => !$reg->is_active,
                        'similarity'      => $score['rank'],
                        'pose'            => (string) array_search(max($score['best']), $score['best']),
                        'scores'          => $score['best'],
                    ];
                }
            }
        }

        usort($candidates, fn ($a, $b) => $b['rank'] <=> $a['rank']);
        $this->lastComparison = $candidates[0] ?? null;

        Log::info('face-duplicate check', [
            'checking_user_id' => $excludeUserId,
            'compared'         => count($candidates),
            'thresholds'       => $cfg,
            'top'              => array_slice($candidates, 0, 3),
        ]);

        if ($best === null) {
            return null;
        }

        // Strict mode: treat "review" like "block".
        if ($best['level'] === 'review' && config('face.duplicate.review_action', 'flag') === 'block') {
            $best['level'] = 'block';
            if ($this->lastComparison !== null) {
                $this->lastComparison['level'] = 'block';
            }
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

    /**
     * What the mobile app is allowed to see about the matched account.
     * Empty unless face.duplicate.expose_match_details is on.
     */
    public function publicMatch(array $match): array
    {
        if (!config('face.duplicate.expose_match_details', false)) {
            return [];
        }

        return [
            'user_id'    => $match['user_id'],
            'name'       => $match['name'],
            'similarity' => $match['similarity'],
            'pose'       => $match['pose'],
            'scores'     => $match['scores'],
        ];
    }

    /* ------------------------------------------------------------------ */
    /* Scoring (public so the face:calibrate command uses the SAME logic)  */
    /* ------------------------------------------------------------------ */

    /**
     * @return array{block_front:float,block_pose:float,block_min_poses:int,review_front:float,review_pose:float,review_min_poses:int}
     */
    public function thresholds(): array
    {
        $max = count(self::POSES);

        return [
            'block_front'      => (float) config('face.duplicate.block_front', 0.75),
            'block_pose'       => (float) config('face.duplicate.block_pose', 0.75),
            'block_min_poses'  => max(1, min($max, (int) config('face.duplicate.block_min_poses', 2))),
            'review_front'     => (float) config('face.duplicate.review_front', 0.70),
            'review_pose'      => (float) config('face.duplicate.review_pose', 0.70),
            'review_min_poses' => max(1, min($max, (int) config('face.duplicate.review_min_poses', 1))),
        ];
    }

    /**
     * Normalised live vectors keyed by pose (only valid 192-d poses kept).
     *
     * @return array<string,float[]>
     */
    public function prepareLive(array $encodings): array
    {
        $live = [];
        foreach (self::POSES as $pose) {
            $v = $encodings[$pose] ?? null;
            if (is_array($v) && count($v) === self::EMBEDDING_SIZE) {
                $live[$pose] = $this->normalize(array_map('floatval', $v));
            }
        }
        return $live;
    }

    /**
     * Normalised stored vectors of a registration keyed by pose.
     *
     * @return array<string,float[]>
     */
    public function prepareStored(FaceRegistration $reg): array
    {
        $stored = [];
        foreach (self::POSES as $pose) {
            $decoded = $this->decode($reg->{$pose . '_encoding'} ?? null);
            if ($decoded !== null) {
                $stored[$pose] = $this->normalize($decoded);
            }
        }
        return $stored;
    }

    /**
     * Compare live poses against a candidate's stored poses.
     *
     * For every live pose we keep the BEST cosine over all stored poses, so a
     * head turn that differs a little between the two enrolments does not drag
     * a true duplicate below the threshold.
     *
     * @param  array<string,float[]> $live    normalised
     * @param  array<string,float[]> $stored  normalised
     * @return array{same:array,best:array,best_from:array,front:?float,mean:float,rank:float,passed_block:int,passed_review:int}|null
     */
    public function score(array $live, array $stored, ?array $cfg = null): ?array
    {
        if (!$live || !$stored) {
            return null;
        }
        $cfg ??= $this->thresholds();

        $same = [];
        $best = [];
        $bestFrom = [];
        foreach ($live as $lp => $lv) {
            foreach ($stored as $sp => $sv) {
                $s = $this->cosine($lv, $sv);
                if ($sp === $lp) {
                    $same[$lp] = round($s, 4);
                }
                if (!isset($best[$lp]) || $s > $best[$lp]) {
                    $best[$lp] = $s;
                    $bestFrom[$lp] = $sp;
                }
            }
        }
        foreach ($best as $p => $s) {
            $best[$p] = round($s, 4);
        }

        $front = $best['front'] ?? null;
        $mean = round(array_sum($best) / count($best), 4);

        $passedBlock = 0;
        $passedReview = 0;
        foreach ($best as $s) {
            if ($s >= $cfg['block_pose']) {
                $passedBlock++;
            }
            if ($s >= $cfg['review_pose']) {
                $passedReview++;
            }
        }

        return [
            'same'          => $same,
            'best'          => $best,
            'best_from'     => $bestFrom,
            'front'         => $front,
            'mean'          => $mean,
            'rank'          => round(max($front ?? 0.0, $mean), 4),
            'passed_block'  => $passedBlock,
            'passed_review' => $passedReview,
        ];
    }

    /** 'block' | 'review' | null for a score() result. */
    public function levelFor(array $score, ?array $cfg = null): ?string
    {
        $cfg ??= $this->thresholds();
        $front = $score['front'];

        if (($front !== null && $front >= $cfg['block_front'])
            || $score['passed_block'] >= $cfg['block_min_poses']) {
            return 'block';
        }
        if (($front !== null && $front >= $cfg['review_front'])
            || $score['passed_review'] >= $cfg['review_min_poses']) {
            return 'review';
        }
        return null;
    }

    /* ------------------------------------------------------------------ */
    /* Internals                                                           */
    /* ------------------------------------------------------------------ */

    private function registrationsQuery(int|string $excludeUserId)
    {
        $includeArchived = (bool) config('face.duplicate.include_archived', true);

        return FaceRegistration::query()
            ->select([
                'face_registration_id',
                'user_id',
                'front_encoding',
                'left_encoding',
                'right_encoding',
                'is_active',
            ])
            ->where('user_id', '!=', $excludeUserId)
            ->where(function ($q) use ($includeArchived) {
                $q->where('is_active', true);
                if ($includeArchived) {
                    // Archived but NOT transferred to someone else, and the
                    // account still exists.
                    $q->orWhere(function ($a) {
                        $a->whereNull('replaced_by_registration_id')
                            ->whereHas('user');
                    });
                }
            });
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