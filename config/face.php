<?php

// config/face.php
// Tune via .env on Hostinger, then run: php artisan config:clear
return [
    'duplicate' => [
        // One pose at or above this = definite duplicate.
        'hard' => (float) env('FACE_DUP_HARD', 0.90),

        // Otherwise: at least `min_poses` poses >= soft AND the FRONT pose >= soft.
        // Side poses are weakly discriminative (your own verify threshold for
        // left/right is 0.50), so they can never decide a duplicate alone.
        'soft' => (float) env('FACE_DUP_SOFT', 0.80),
        'min_poses' => (int) env('FACE_DUP_MIN_POSES', 2),
        'require_front' => (bool) env('FACE_DUP_REQUIRE_FRONT', true),
    ],
];