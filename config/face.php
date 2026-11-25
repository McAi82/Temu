<?php
return [
    'duplicate' => [
        // Only used to require a minimum number of captured poses before a
        // check is run (the block decision itself uses the average score).
        'min_poses' => (int) env('FACE_DUP_MIN_POSES', 3),

        // BLOCK when the average similarity of the 3 poses is >= this value.
        // 0.80 and above = blocked, 0.7999 and below = registered.
        'block' => (float) env('FACE_DUP_BLOCK', 0.75),

        // Per-pose values are only used for the "poses_passed" log value.
        'block_left' => (float) env('FACE_DUP_BLOCK_LEFT', 075),
        'block_right' => (float) env('FACE_DUP_BLOCK_RIGHT', 0.75),

        // "review" band: average >= review but < block is registered,
        // and logged as a warning for admin review.
        'review' => (float) env('FACE_DUP_REVIEW', 0.70),

        // While tuning: also return the closest account's scores to the app
        // in the check-duplicate response (key "debug"). Keep false in production.
        'debug' => (bool) env('FACE_DUP_DEBUG', true),
    ],
];