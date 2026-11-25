<?php

namespace App\Console\Commands;

use App\Models\FaceRegistration;
use App\Services\FaceDuplicateService;
use Illuminate\Console\Command;

/**
 * php artisan face:calibrate [--sample=500] [--top=15]
 *
 * Compares every pair of ACTIVE registrations with the exact scoring used by
 * the duplicate check and prints the score distribution.
 *
 * Almost every pair is two DIFFERENT people ("impostor" pairs), so the upper
 * tail of this distribution tells you how high different faces really score
 * with your capture pipeline. Set the block thresholds above it.
 *
 * Pairs at the very top may be genuine duplicate accounts: open the
 * registration images for those before treating them as impostors.
 *
 * For the other half (same person scoring too LOW) have ~20-30 testers
 * register twice on different days / lighting / devices and check that their
 * scores stay above the thresholds you choose.
 */
class FaceCalibrate extends Command
{
    protected $signature = 'face:calibrate
        {--sample=0 : Compare at most N random registrations (0 = all)}
        {--top=15 : How many closest pairs to list}';

    protected $description = 'Show the impostor score distribution across active face registrations';

    public function handle(FaceDuplicateService $svc): int
    {
        $rows = FaceRegistration::query()
            ->where('is_active', true)
            ->get(['face_registration_id', 'user_id', 'front_encoding', 'left_encoding', 'right_encoding']);

        $sample = (int) $this->option('sample');
        if ($sample > 0 && $rows->count() > $sample) {
            $rows = $rows->shuffle()->take($sample)->values();
        }

        $items = [];
        foreach ($rows as $r) {
            $v = $svc->prepareStored($r);
            if (count($v) === 3) {
                $items[] = ['user_id' => $r->user_id, 'v' => $v];
            }
        }

        $n = count($items);
        if ($n < 2) {
            $this->warn('Need at least 2 complete active registrations to compare.');
            return self::SUCCESS;
        }

        $pairsTotal = intdiv($n * ($n - 1), 2);
        $this->info("Comparing {$n} registrations ({$pairsTotal} pairs)...");

        $cfg = $svc->thresholds();
        $fronts = [];
        $means = [];
        $pairs = [];
        $levels = ['block' => 0, 'review' => 0, 'none' => 0];

        for ($i = 0; $i < $n; $i++) {
            for ($j = $i + 1; $j < $n; $j++) {
                $score = $svc->score($items[$i]['v'], $items[$j]['v'], $cfg);
                if ($score === null) {
                    continue;
                }
                $level = $svc->levelFor($score, $cfg) ?? 'none';
                $levels[$level]++;

                $fronts[] = $score['front'] ?? 0.0;
                $means[] = $score['mean'];
                $pairs[] = [
                    $score['rank'],
                    $items[$i]['user_id'],
                    $items[$j]['user_id'],
                    $score['front'],
                    $score['mean'],
                    $level,
                ];
            }
        }

        sort($fronts);
        sort($means);

        $this->newLine();
        $this->line('<options=bold>Impostor score percentiles</options>');
        $rowsOut = [];
        foreach ([50, 90, 99, 99.9, 100] as $p) {
            $rowsOut[] = [
                $p === 100 ? 'max' : "p{$p}",
                number_format($this->percentile($fronts, $p), 4),
                number_format($this->percentile($means, $p), 4),
            ];
        }
        $this->table(['percentile', 'front best', 'mean of best'], $rowsOut);

        $this->newLine();
        $this->line('Pairs hit by CURRENT thresholds: '
            . "block={$levels['block']}  review={$levels['review']}  none={$levels['none']}");
        $this->line(sprintf(
            'Current: block_front=%.2f block_pose=%.2f (min %d poses)  review_front=%.2f review_pose=%.2f (min %d)',
            $cfg['block_front'],
            $cfg['block_pose'],
            $cfg['block_min_poses'],
            $cfg['review_front'],
            $cfg['review_pose'],
            $cfg['review_min_poses'],
        ));

        usort($pairs, fn ($a, $b) => $b[0] <=> $a[0]);
        $top = max(1, (int) $this->option('top'));
        $this->newLine();
        $this->line("<options=bold>Closest {$top} pairs</options> (check the photos: these may be real duplicate accounts)");
        $this->table(
            ['rank', 'user A', 'user B', 'front best', 'mean of best', 'level now'],
            array_map(
                fn ($p) => [$p[0], $p[1], $p[2], $p[3], $p[4], $p[5]],
                array_slice($pairs, 0, $top),
            ),
        );

        $this->newLine();
        $this->line('Guidance: set block_front (and block_pose) ABOVE the highest impostor score you trust,');
        $this->line('then confirm with repeat registrations of the same people that genuine scores stay above them.');

        return self::SUCCESS;
    }

    /** @param float[] $sorted ascending */
    private function percentile(array $sorted, float $p): float
    {
        $count = count($sorted);
        if ($count === 0) {
            return 0.0;
        }
        $idx = (int) ceil(($p / 100) * $count) - 1;
        return (float) $sorted[max(0, min($count - 1, $idx))];
    }
}