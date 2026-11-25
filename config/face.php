<?php
return [
    'duplicate' => [
        // Minimum number of captured poses required before a check is run.
        'min_poses' => (int) env('FACE_DUP_MIN_POSES', 3),

        /*
         * How a candidate account is scored
         * ---------------------------------
         * Each live pose (front/left/right) is compared against ALL stored
         * poses of the candidate and the BEST similarity is kept. That makes
         * the check robust to the user turning their head a bit more or less
         * than the first time. Then:
         *
         *   BLOCK  when  front best  >= block_front
         *          OR    at least block_min_poses poses have best >= block_pose
         *   REVIEW when  front best  >= review_front
         *          OR    at least review_min_poses poses have best >= review_pose
         *
         * !!  These numbers are PLACEHOLDERS until you calibrate them.
         * !!  Run `php artisan face:calibrate` to see the real distribution of
         * !!  scores between different people on your own data, then set the
         * !!  block thresholds ABOVE the highest impostor score you trust.
         * !!  Re-run it after every change to the capture pipeline.
         */
        'block_front'     => (float) env('FACE_DUP_BLOCK_FRONT', 0.75),
        'block_pose'      => (float) env('FACE_DUP_BLOCK_POSE', 0.75),
        'block_min_poses' => (int) env('FACE_DUP_BLOCK_MIN_POSES', 2),

        'review_front'     => (float) env('FACE_DUP_REVIEW_FRONT', 0.70),
        'review_pose'      => (float) env('FACE_DUP_REVIEW_POSE', 0.70),
        'review_min_poses' => (int) env('FACE_DUP_REVIEW_MIN_POSES', 1),

        // What to do with a "review" match:
        //   'flag'  = register the face, log it and notify admins
        //   'block' = treat it like a block (strictest)
        'review_action' => env('FACE_DUP_REVIEW_ACTION', 'flag'),

        // Also compare against registrations that were archived WITHOUT being
        // replaced (e.g. admin reset) for accounts that still exist, so a reset
        // face can't simply be enrolled again under another account.
        // Archived rows that were transferred to another user are skipped (the
        // active copy under the new owner already covers them).
        'include_archived' => (bool) env('FACE_DUP_INCLUDE_ARCHIVED', true),

        // Return the matched account's name / id / scores to the app in the
        // 409 response. Keep false in production: it tells a would-be
        // fraudster whose face is on file and lets them tune an attack.
        'expose_match_details' => (bool) env('FACE_DUP_EXPOSE_MATCH', false),

        // While tuning: also return the closest account's scores to the app
        // in the check-duplicate response (key "debug"). Keep false in production.
        // NOTE: an old FACE_DUP_DEBUG=true in your .env still overrides this.
        'debug' => (bool) env('FACE_DUP_DEBUG', false),
    ],
];