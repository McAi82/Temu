<?php
return [
    'duplicate' => [
        // front >= block  -> reject registration (409 FACE_DUPLICATE)
        'block' => (float) env('FACE_DUP_BLOCK', 0.72),

        // review <= front < block -> allow, but log a warning for admin review
        'review' => (float) env('FACE_DUP_REVIEW', 0.65),

        // ANY pose >= hard -> reject (practically certain match)
        'hard' => (float) env('FACE_DUP_HARD', 0.80),
    ],
];