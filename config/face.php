<?php
return [
    'duplicate' => [
        // How many of the 3 poses must reach 80% to block.
        // 3 = all poses must match, 2 = any two poses.
        'min_poses' => (int) env('FACE_DUP_MIN_POSES', 2),

        // Block at 0.80 and above, for every pose.
        'block'       => (float) env('FACE_DUP_BLOCK', 0.83),
        'block_left'  => (float) env('FACE_DUP_BLOCK_LEFT', 0.80),
        'block_right' => (float) env('FACE_DUP_BLOCK_RIGHT', 0.83),

        // Same as block = no separate "review" band.
        'review' => (float) env('FACE_DUP_REVIEW', 0.83),

        'debug' => (bool) env('FACE_DUP_DEBUG', false),
    ],
];