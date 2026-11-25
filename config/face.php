<?php
return [
    'duplicate' => [
        // A face is a duplicate only when at least `min_poses` of the 3 poses
        // (front, left, right) each reach their threshold against the SAME
        // pose of another account. 3 = all poses must match.
        'min_poses' => (int) env('FACE_DUP_MIN_POSES', 2),

        // Cosine-similarity threshold applied to every pose (front by default).
        'block' => (float) env('FACE_DUP_BLOCK', 0.80),

        // Optional separate thresholds for the turned-head poses, which
        // normally score lower than the front. Default: same as 'block'.
        'block_left' => (float) env('FACE_DUP_BLOCK_LEFT', env('FACE_DUP_BLOCK', 0.50)),
        'block_right' => (float) env('FACE_DUP_BLOCK_RIGHT', env('FACE_DUP_BLOCK', 0.80)),

        // "review" band: logged for admin review but allowed. A pose counts
        // toward review when it is within (block - review) of its threshold.
        'review' => (float) env('FACE_DUP_REVIEW', 0.80),

        // While tuning: also return the closest account's scores to the app
        // in the check-duplicate response (key "debug"). Keep false in production.
        'debug' => (bool) env('FACE_DUP_DEBUG', false),
    ],
];