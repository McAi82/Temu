<?php
return [
    'duplicate' => [
        // front >= block  -> reject registration (409 FACE_DUPLICATE)
        'block' => (float) env('FACE_DUP_BLOCK', 0.85),

        // review <= front < block -> allow, but log a warning for admin review
        'review' => (float) env('FACE_DUP_REVIEW', 0.80),

        // ANY pose >= hard -> reject (practically certain match)
        'hard' => (float) env('FACE_DUP_HARD', 0.95),
    ],
];