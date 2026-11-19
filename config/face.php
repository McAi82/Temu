<?php

// config/face.php
// Tune via .env on Hostinger, then run: php artisan config:clear
//
// Decision is made on the FRONT pose (the only pose that separates people
// reliably in your logs). Left/right are logged but never decide alone.
return [
    'duplicate' => [
        // front >= block  -> reject registration (409 FACE_DUPLICATE)
        'block' => (float) env('FACE_DUP_BLOCK', 0.72),

        // review <= front < block -> allow, but log a warning for admin review
        'review' => (float) env('FACE_DUP_REVIEW', 0.65),

        // ANY pose >= hard -> reject (practically certain match)
        'hard' => (float) env('FACE_DUP_HARD', 0.95),
    ],
];