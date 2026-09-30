<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Carbon\Carbon;

class DatabaseSeeder extends Seeder
{
    /**
     * Number of tickets to generate. Sized for a demo dataset that's big
     * enough to page through but small enough to insert quickly.
     */
    private const TICKET_COUNT = 120;

    /** Days of history for tickets and payments. */
    private const TICKET_HISTORY_DAYS = 120;

    /** Days of attendance history to generate (weekends skipped). */
    private const ATTENDANCE_HISTORY_DAYS = 60;

    /** Repeat-offender threshold — matches `settings.repeat_offender_threshold`. */
    private const REPEAT_OFFENDER_THRESHOLD = 3;

    /**
     * Official start-of-day and end-of-day for attendance.
     * Matches `settings.time_in_start` / `settings.time_out_end`.
     */
    private const WORK_START_HOUR = 8;
    private const WORK_END_HOUR = 17;

    /** Grace period (minutes) before a time-in counts as "late". */
    private const GRACE_MINUTES = 15;

    /**
     * Skip these fixed dates when generating attendance.
     * Extend as needed for real holidays.
     */
    private const HOLIDAYS = [
        // Add 'YYYY-MM-DD' => 'Holiday name' entries here
    ];

    public function run(): void
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        $this->truncateTables();
        DB::statement('SET FOREIGN_KEY_CHECKS=1');

        // Seed order matters: parents first, then children.
        $this->seedSettings();
        $this->seedUsers();
        $this->seedVehicles();
        $this->seedViolationTypes();
        $this->seedViolators();
        $this->seedViolatorVehicles();
        $this->seedTicketsAndViolations();
        $this->seedPayments();
        $this->seedRepeatOffenders();
        $this->seedEnforcerAttendance();
        $this->seedAppeals();
        $this->seedNotifications();

        $this->command->info('');
        $this->command->info('✅ All tables seeded successfully.');
        $this->command->info('');
    }

    /* ==================================================================
     |  TRUNCATE
     ================================================================== */

    private function truncateTables(): void
    {
        // Order: leaf tables first, then roots.
        $tables = [
            'notifications',
            'appeals',
            'payments',
            'ticket_violations',
            'tickets',
            'repeat_offenders',
            'violator_vehicles',
            'enforcer_attendance',
            'enforcer_schedules',
            'duty_locations',
            'enforcer_locations',
            'faces',
            'biometric_requests',
            'otp_codes',
            'personal_access_tokens',
            'sessions',
            'password_resets',
            'system_logs',
            'settings',
            'violators',
            'vehicles',
            'violation_types',
            'users',
            'cache',
            'cache_locks',
        ];

        foreach ($tables as $table) {
            if ($this->tableExists($table)) {
                DB::table($table)->truncate();
            }
        }
    }

    private function tableExists(string $table): bool
    {
        try {
            DB::table($table)->limit(1)->get();
            return true;
        } catch (\Throwable $e) {
            return false;
        }
    }

    /* ==================================================================
     |  SETTINGS
     ================================================================== */

    private function seedSettings(): void
    {
        $settings = [
            [
                'setting_key' => 'company_name',
                'setting_value' => 'TEMU Traffic System',
                'setting_type' => 'text',
                'description' => 'Company name',
                'group_name' => 'general',
            ],
            [
                'setting_key' => 'company_address',
                'setting_value' => 'El Salvador City, Misamis Oriental, Philippines',
                'setting_type' => 'text',
                'description' => 'Company address',
                'group_name' => 'general',
            ],
            [
                'setting_key' => 'time_in_start',
                'setting_value' => '08:00:00',
                'setting_type' => 'text',
                'description' => 'Official time-in start',
                'group_name' => 'attendance',
            ],
            [
                'setting_key' => 'time_out_end',
                'setting_value' => '17:00:00',
                'setting_type' => 'text',
                'description' => 'Official time-out end',
                'group_name' => 'attendance',
            ],
            [
                'setting_key' => 'grace_period_minutes',
                'setting_value' => (string) self::GRACE_MINUTES,
                'setting_type' => 'number',
                'description' => 'Grace period before marking late',
                'group_name' => 'attendance',
            ],
            [
                'setting_key' => 'repeat_offender_threshold',
                'setting_value' => (string) self::REPEAT_OFFENDER_THRESHOLD,
                'setting_type' => 'number',
                'description' => 'Number of violations to flag as repeat offender',
                'group_name' => 'enforcement',
            ],
            [
                'setting_key' => 'demerit_suspension_points',
                'setting_value' => '12',
                'setting_type' => 'number',
                'description' => 'Demerit points that trigger license suspension',
                'group_name' => 'enforcement',
            ],
            [
                'setting_key' => 'fine_payment_due_days',
                'setting_value' => '15',
                'setting_type' => 'number',
                'description' => 'Days to pay a fine before it becomes overdue',
                'group_name' => 'payments',
            ],
            [
                'setting_key' => 'enable_notifications',
                'setting_value' => 'true',
                'setting_type' => 'boolean',
                'description' => 'Enable push notifications',
                'group_name' => 'notifications',
            ],
            [
                'setting_key' => 'maintenance_mode',
                'setting_value' => 'false',
                'setting_type' => 'boolean',
                'description' => 'System maintenance mode',
                'group_name' => 'system',
            ],
            [
                'setting_key' => 'max_ticket_appeal_days',
                'setting_value' => '30',
                'setting_type' => 'number',
                'description' => 'Maximum days to file an appeal',
                'group_name' => 'enforcement',
            ],
            [
                'setting_key' => 'attendance_required_hours',
                'setting_value' => '8',
                'setting_type' => 'number',
                'description' => 'Required working hours per day',
                'group_name' => 'attendance',
            ],
        ];

        $now = now();
        foreach ($settings as &$s) {
            $s['created_at'] = $now;
            $s['updated_at'] = $now;
        }

        DB::table('settings')->insert($settings);
        $this->command->info('  ✓ Settings: ' . count($settings));
    }

    /* ==================================================================
     |  USERS
     ================================================================== */

    private function seedUsers(): void
    {
        $users = [
            /* ---------------- Admins ---------------- */
            [
                'email' => 'occ.balasabas.johnpaul@gmail.com',
                'firstname' => 'Johnpaul',
                'middlename' => 'Alonzo',
                'lastname' => 'Balasabas',
                'role' => 'admin',
                'contact_number' => '09171234501',
            ],

            /* ---------------- Staff ---------------- */
            [
                'email' => 'luiskarlcons@gmail.com',
                'firstname' => 'Luis Karl',
                'middlename' => 'Bautista',
                'lastname' => 'Consolacion',
                'role' => 'staff',
                'contact_number' => '09171234503',
            ],

            /* ---------------- Enforcers ---------------- */
            [
                'email' => 'occ.detchos.juliane@gmail.com',
                'firstname' => 'Juliane',
                'middlename' => 'Gonzales',
                'lastname' => 'Detchos',
                'role' => 'enforcer',
                'contact_number' => '09171234510',
            ],
            [
                'email' => 'occ.villanueva.jessamae@gmail.com',
                'firstname' => 'Jessamae',
                'middlename' => 'Bautista',
                'lastname' => 'Villanueva',
                'role' => 'enforcer',
                'contact_number' => '09171234511',
            ],
        ];

        $now = now();
        $rows = [];

        foreach ($users as $u) {
            $rows[] = [
                'email' => $u['email'],
                'password_hash' => Hash::make('password123'),
                'firstname' => $u['firstname'],
                'middlename' => $u['middlename'],
                'lastname' => $u['lastname'],
                'suffix' => null,
                'role' => $u['role'],
                'contact_number' => $u['contact_number'],
                'profile_image' => null,
                'last_login' => null,
                'is_active' => true,
                'has_face_registered' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::table('users')->insert($rows);
        $this->command->info('  ✓ Users: ' . count($rows));
    }

    /* ==================================================================
     |  VEHICLES
     ================================================================== */

    private function seedVehicles(): void
    {
        $vehicles = [
            ['ABC-1234', 'Juan Dela Cruz', 'Toyota', 'Vios', 'White', 'Sedan', 2020],
            ['DEF-5678', 'Maria Santos', 'Honda', 'Civic', 'Black', 'Sedan', 2021],
            ['GHI-9012', 'Pedro Garcia', 'Mitsubishi', 'Montero Sport', 'Red', 'SUV', 2019],
            ['JKL-3456', 'Ana Lopez', 'Ford', 'Ranger', 'Blue', 'Pickup', 2022],
            ['MNO-7890', 'Ramon Fernandez', 'Nissan', 'Navara', 'Gray', 'Pickup', 2020],
            ['PQR-1234', 'Elena Rivera', 'Hyundai', 'Accent', 'Silver', 'Sedan', 2021],
            ['STU-5678', 'Victor Reyes', 'Kia', 'Seltos', 'White', 'SUV', 2022],
            ['VWX-9012', 'Cecilia Cruz', 'Suzuki', 'Swift', 'Yellow', 'Hatchback', 2020],
            ['YZA-3456', 'Benjamin Tan', 'Mazda', 'Mazda 3', 'Red', 'Sedan', 2021],
            ['BCD-7890', 'Natalie Ong', 'Chevrolet', 'Trailblazer', 'Black', 'SUV', 2019],
            ['EFG-2345', 'Gregory Ramos', 'Isuzu', 'D-Max', 'Blue', 'Pickup', 2022],
            ['HIJ-6789', 'Angela Mercado', 'Toyota', 'Innova', 'Silver', 'MPV', 2021],
            ['KLM-0123', 'Ferdinand Marcos', 'Honda', 'CR-V', 'White', 'SUV', 2020],
            ['NOP-4567', 'Imelda Reyes', 'Mitsubishi', 'Mirage', 'Black', 'Hatchback', 2019],
            ['QRS-8901', 'Corazon Aquino', 'Ford', 'Everest', 'Red', 'SUV', 2022],
            ['TUV-2345', 'Rodrigo Duterte', 'Toyota', 'Hilux', 'Silver', 'Pickup', 2021],
            ['WXY-6789', 'Leni Robredo', 'Honda', 'City', 'Blue', 'Sedan', 2020],
            ['ZAB-0123', 'Manny Pacquiao', 'Mitsubishi', 'L300', 'White', 'Van', 2019],
            ['CDE-4567', 'Sarah Geronimo', 'Suzuki', 'Ertiga', 'Gray', 'MPV', 2022],
            ['FGH-8901', 'Daniel Padilla', 'Nissan', 'Almera', 'Red', 'Sedan', 2021],
        ];

        $now = now();
        $rows = [];

        foreach ($vehicles as $v) {
            [$plate, $owner, $make, $model, $color, $body, $year] = $v;
            $rows[] = [
                'platenumber' => $plate,
                'owner' => $owner,
                'address' => null,
                'make' => $make,
                'color' => $color,
                'model' => $model,
                'year_model' => $year,
                'body_type' => $body,
                'engine_number' => null,
                'chassis_number' => null,
                'marking' => null,
                'place_of_violation' => null,
                'or_number' => null,
                'cr_number' => null,
                'registration_expiry' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::table('vehicles')->insert($rows);
        $this->command->info('  ✓ Vehicles: ' . count($rows));
    }

    /* ==================================================================
     |  VIOLATION TYPES
     ================================================================== */

    private function seedViolationTypes(): void
    {
        $violations = [
            ['TR-001', 'Reckless Driving', 'Driving without due care and caution', 2000.00, 5, 'Traffic Rules'],
            ['TR-002', 'Over Speeding', 'Exceeding the posted speed limit', 1500.00, 3, 'Traffic Rules'],
            ['TR-003', 'Illegal Parking', 'Parking in a no-parking zone', 500.00, 1, 'Parking'],
            ['TR-004', 'No Seatbelt', 'Driver or passenger without seatbelt', 1000.00, 2, 'Safety'],
            ['TR-005', 'Using Mobile Phone', 'Using a mobile phone while driving', 3000.00, 5, 'Traffic Rules'],
            ['TR-006', 'Disregarding Traffic Signal', 'Running a red light or ignoring a stop sign', 1500.00, 3, 'Traffic Rules'],
            ['TR-007', 'No Driver\'s License', 'Driving without a valid license', 3000.00, 5, 'Documents'],
            ['TR-008', 'No OR/CR', 'No official receipt or certificate of registration', 2000.00, 3, 'Documents'],
            ['TR-009', 'Expired Registration', 'Vehicle registration is expired', 1500.00, 2, 'Documents'],
            ['TR-010', 'Drunk Driving', 'Operating a vehicle under the influence of alcohol', 5000.00, 10, 'Serious Violation'],
            ['TR-011', 'Smoke Belching', 'Excessive smoke emission', 2000.00, 2, 'Vehicle Condition'],
            ['TR-012', 'Modified Exhaust', 'Unauthorized exhaust modification', 2000.00, 2, 'Vehicle Condition'],
            ['TR-013', 'No Side Mirror', 'Vehicle without a side mirror', 1000.00, 1, 'Vehicle Condition'],
            ['TR-014', 'Defective Lights', 'Broken or missing headlights/tail lights', 1000.00, 1, 'Vehicle Condition'],
            ['TR-015', 'No Plate Number', 'Vehicle without a plate number', 3000.00, 3, 'Documents'],
            ['TR-016', 'Obstructing Traffic', 'Causing traffic obstruction', 1000.00, 2, 'Traffic Rules'],
            ['TR-017', 'Wrong Turn', 'Making an illegal turn', 500.00, 1, 'Traffic Rules'],
            ['TR-018', 'Oversized Load', 'Carrying an oversized load without a permit', 2500.00, 3, 'Cargo'],
            ['TR-019', 'Colorum Operation', 'Unauthorized public transport operation', 6000.00, 5, 'Serious Violation'],
            ['TR-020', 'Tinted Windows', 'Excessively dark or prohibited tint', 1500.00, 1, 'Vehicle Condition'],
        ];

        $now = now();
        $rows = [];

        foreach ($violations as $v) {
            [$code, $name, $desc, $fine, $points, $category] = $v;
            $rows[] = [
                'violation_code' => $code,
                'violation_name' => $name,
                'description' => $desc,
                'fine_amount' => $fine,
                'demerit_points' => $points,
                'is_active' => true,
                'category' => $category,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::table('violation_types')->insert($rows);
        $this->command->info('  ✓ Violation types: ' . count($rows));
    }

    /* ==================================================================
     |  VIOLATORS
     ================================================================== */

    private function seedViolators(): void
    {
        $violators = [
            ['Juan', 'Reyes', 'Dela Cruz', 'L123456789', '2027-12-31', '1985-05-15', 'Male', 'Professional', 'A,B,B1,B2', 'juan.delacruz@example.ph', '09171111111', 'Cagayan de Oro City'],
            ['Maria', 'Lopez', 'Santos', 'L987654321', '2028-03-20', '1990-08-22', 'Female', 'Non-Professional', 'A,B', 'maria.santos@example.ph', '09171111112', 'El Salvador City'],
            ['Pedro', 'Cruz', 'Garcia', 'L456789123', '2027-11-10', '1982-03-10', 'Male', 'Professional', 'A,B,B1,B2,C', 'pedro.garcia@example.ph', '09171111113', 'Iligan City'],
            ['Ana', 'Reyes', 'Lopez', 'L789123456', '2029-07-18', '1995-12-05', 'Female', 'Non-Professional', 'A,B', 'ana.lopez@example.ph', '09171111114', 'Cagayan de Oro City'],
            ['Ramon', 'Santos', 'Fernandez', 'L321654987', '2026-09-25', '1988-06-30', 'Male', 'Professional', 'A,B,C,D', 'ramon.fernandez@example.ph', '09171111115', 'Gingoog City'],
            ['Elena', 'Garcia', 'Rivera', 'L654987321', '2030-01-14', '1992-11-18', 'Female', 'Professional', 'A,B', 'elena.rivera@example.ph', '09171111116', 'El Salvador City'],
            ['Victor', 'Lim', 'Reyes', 'L147258369', '2027-05-08', '1980-09-25', 'Male', 'Professional', 'A,B,C', 'victor.reyes@example.ph', '09171111117', 'Valencia City'],
            ['Cecilia', 'Tan', 'Cruz', 'L369258147', '2026-12-03', '1998-04-12', 'Female', 'Non-Professional', 'A', 'cecilia.cruz@example.ph', '09171111118', 'Malaybalay City'],
            ['Benjamin', 'Ong', 'Tan', 'L741852963', '2028-10-22', '1987-07-08', 'Male', 'Professional', 'A,B,B1,B2', 'benjamin.tan@example.ph', '09171111119', 'Cagayan de Oro City'],
            ['Natalie', 'Go', 'Ong', 'L852963741', '2030-06-17', '1993-02-28', 'Female', 'Professional', 'A,B', 'natalie.ong@example.ph', '09171111120', 'Iligan City'],
            ['Gregory', 'Sy', 'Ramos', 'L963741852', '2026-08-30', '1984-10-14', 'Male', 'Professional', 'A,B,C', 'gregory.ramos@example.ph', '09171111121', 'El Salvador City'],
            ['Angela', 'Uy', 'Mercado', 'L159753486', '2028-04-05', '1991-01-20', 'Female', 'Non-Professional', 'A,B', 'angela.mercado@example.ph', '09171111122', 'Valencia City'],
            ['Roberto', 'Chua', 'Diaz', 'L357159852', '2027-02-11', '1979-08-04', 'Male', 'Professional', 'A,B,B1,B2', 'roberto.diaz@example.ph', '09171111123', 'Cagayan de Oro City'],
            ['Katrina', 'Villanueva', 'Roxas', 'L258147369', '2029-11-19', '1996-06-22', 'Female', 'Non-Professional', 'A,B', 'katrina.roxas@example.ph', '09171111124', 'El Salvador City'],
            ['Michael', 'Tan', 'Lim', 'L951753852', '2026-05-28', '1986-03-17', 'Male', 'Professional', 'A,B,C', 'michael.lim@example.ph', '09171111125', 'Malaybalay City'],
        ];

        $now = now();
        $rows = [];

        foreach ($violators as $v) {
            [$first, $mid, $last, $license, $expiry, $birthday, $gender, $prof, $restriction, $email, $contact, $address] = $v;
            $rows[] = [
                'firstname' => $first,
                'middlename' => $mid,
                'lastname' => $last,
                'suffix' => null,
                'license' => $license,
                'expiry' => $expiry,
                'birthday' => $birthday,
                'height' => null,
                'gender' => $gender,
                'prof_non_prof' => $prof,
                'nationality' => 'Filipino',
                'weight' => null,
                'restriction' => $restriction,
                'email' => $email,
                'contact_number' => $contact,
                'address' => $address,
                'profile_photo' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::table('violators')->insert($rows);
        $this->command->info('  ✓ Violators: ' . count($rows));
    }

    /* ==================================================================
     |  VIOLATOR-VEHICLE LINKS
     ================================================================== */

    private function seedViolatorVehicles(): void
    {
        $violatorIds = DB::table('violators')->pluck('violator_id')->toArray();
        $vehicleIds = DB::table('vehicles')->pluck('vehicle_id')->toArray();

        $now = now();
        $rows = [];

        foreach ($violatorIds as $i => $violatorId) {
            // Each violator owns one vehicle, indexed mod so vehicle and
            // violator lists stay aligned even if sizes differ.
            $vehicleId = $vehicleIds[$i % count($vehicleIds)];

            $rows[] = [
                'violator_id' => $violatorId,
                'vehicle_id' => $vehicleId,
                'is_primary' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::table('violator_vehicles')->insert($rows);
        $this->command->info('  ✓ Violator–vehicle links: ' . count($rows));
    }

    /* ==================================================================
     |  TICKETS + TICKET VIOLATIONS
     ================================================================== */

    private function seedTicketsAndViolations(): void
    {
        $enforcerIds = DB::table('users')
            ->where('role', 'enforcer')
            ->pluck('user_id')
            ->toArray();

        $violatorIds = DB::table('violators')->pluck('violator_id')->toArray();
        $vehicleIds = DB::table('vehicles')->pluck('vehicle_id')->toArray();
        $violationTypes = DB::table('violation_types')
            ->select('violation_id', 'fine_amount', 'demerit_points')
            ->get()
            ->toArray();

        $locations = [
            'C.M. Recto Avenue, corner Rizal Street',
            'Roxas Boulevard, near City Hall',
            'Divisoria Bridge, Barangay Poblacion',
            'Aguinaldo Street, near Public Market',
            'Bonifacio Drive, Barangay San Roque',
            'Rizal Park, corner Burgos Street',
            'Apovel Drive, Barangay San Juan',
            'Zone 5, National Highway, Barangay Sta. Cruz',
        ];

        $statuses = ['issued', 'issued', 'issued', 'paid', 'paid', 'partial_paid', 'contested', 'dismissed'];

        $tickets = [];
        $ticketViolations = [];
        $ticketSequence = []; // "Ymd" => next number
        $now = Carbon::now();

        for ($i = 0; $i < self::TICKET_COUNT; $i++) {
            // Spread tickets across the history window, biased toward
            // recent days so the dashboard has a lot of "today" data.
            $daysAgo = (int) floor(
                pow($i / max(1, self::TICKET_COUNT - 1), 0.7) *
                    self::TICKET_HISTORY_DAYS,
            );
            $date = $now->copy()->subDays($daysAgo);

            // Spread tickets through the working day.
            $hour = 7 + ($i * 3) % 11; // 7..17
            $minute = ($i * 7) % 60;
            $date->setTime($hour, $minute, 0);

            $dateKey = $date->format('Ymd');
            if (!isset($ticketSequence[$dateKey])) {
                $ticketSequence[$dateKey] = 0;
            }
            $ticketSequence[$dateKey]++;

            $ticketNumber = sprintf(
                'TKT-%s-%04d',
                $dateKey,
                $ticketSequence[$dateKey],
            );

            $status = $statuses[$i % count($statuses)];

            $tickets[] = [
                'ticket_number' => $ticketNumber,
                'idempotency_key' => null,
                'violator_id' => $violatorIds[$i % count($violatorIds)],
                'vehicle_id' => $vehicleIds[$i % count($vehicleIds)],
                'enforcer_id' => $enforcerIds[$i % count($enforcerIds)],
                'location' => $locations[$i % count($locations)],
                'latitude' => 8.558 + (($i % 20) - 10) / 1000,
                'longitude' => 124.524 + (($i % 20) - 10) / 1000,
                'violation_datetime' => $date->format('Y-m-d H:i:s'),
                'remarks' => $i % 3 === 0 ? 'Driver verbally warned.' : null,
                'status' => $status,
                'qr_code' => null,
                'pdf_path' => null,
                'created_at' => $date,
                'updated_at' => $date,
            ];
        }

        DB::table('tickets')->insert($tickets);

        // Re-fetch with their server-assigned IDs so we can attach
        // violations precisely.
        $insertedTickets = DB::table('tickets')
            ->orderBy('ticket_id')
            ->get(['ticket_id', 'created_at']);

        foreach ($insertedTickets as $index => $ticket) {
            // 1–3 violations, deterministic by index.
            $count = 1 + ($index % 3);

            // Pick a distinct set of violations by walking the
            // violation_types list from a per-ticket offset.
            $used = [];
            for ($k = 0; $k < $count; $k++) {
                $vi = ($index * 3 + $k * 7) % count($violationTypes);
                // Guard against duplicates within the same ticket.
                $guard = 0;
                while (in_array($vi, $used, true) && $guard < 20) {
                    $vi = ($vi + 1) % count($violationTypes);
                    $guard++;
                }
                $used[] = $vi;

                $vt = $violationTypes[$vi];
                $ticketViolations[] = [
                    'ticket_id' => $ticket->ticket_id,
                    'violation_id' => $vt->violation_id,
                    'fine_amount' => $vt->fine_amount,
                    'demerit_points' => $vt->demerit_points,
                    'created_at' => $ticket->created_at,
                    'updated_at' => $ticket->created_at,
                ];
            }
        }

        DB::table('ticket_violations')->insert($ticketViolations);

        $this->command->info('  ✓ Tickets: ' . count($tickets));
        $this->command->info('  ✓ Ticket violations: ' . count($ticketViolations));
    }

    /* ==================================================================
     |  PAYMENTS
     ================================================================== */

    private function seedPayments(): void
    {
        // Only seed payments for tickets whose status is 'paid' or
        // 'partial_paid'. The rest are unpaid / contested / dismissed.
        $tickets = DB::table('tickets')
            ->whereIn('status', ['paid', 'partial_paid'])
            ->orderBy('ticket_id')
            ->get(['ticket_id', 'status', 'created_at']);

        $methods = ['cash',];
        $now = Carbon::now();
        $rows = [];
        $counter = 0;

        foreach ($tickets as $ticket) {
            // Sum of violations for this ticket.
            $totalFine = (float) DB::table('ticket_violations')
                ->where('ticket_id', $ticket->ticket_id)
                ->sum('fine_amount');

            if ($totalFine <= 0) {
                continue;
            }

            // Payment lands 0–14 days after the ticket.
            $paymentDate = Carbon::parse($ticket->created_at)
                ->addDays(($counter * 3) % 15)
                ->setTime(9 + ($counter % 8), ($counter * 11) % 60, 0);

            // Don't let a payment land in the future.
            if ($paymentDate->isAfter($now)) {
                $paymentDate = $now->copy()->subHours(1);
            }

            $counter++;

            $reference = sprintf(
                'PAY-%s-%s',
                $paymentDate->format('Ymd'),
                strtoupper(Str::random(6)),
            );
            $receipt = sprintf(
                'RCP-%s-%04d',
                $paymentDate->format('Ymd'),
                $counter,
            );

            if ($ticket->status === 'paid') {
                // Full payment.
                $rows[] = [
                    'ticket_id' => $ticket->ticket_id,
                    'payment_reference' => $reference,
                    'amount_paid' => $totalFine,
                    'payment_date' => $paymentDate,
                    'payment_method' => $methods[$counter % count($methods)],
                    'payment_status' => 'completed',
                    'transaction_id' => null,
                    'receipt_number' => $receipt,
                    'receipt_path' => null,
                    'paid_by' => null,
                    'notes' => null,
                    'created_at' => $paymentDate,
                    'updated_at' => $paymentDate,
                ];
            } else {
                // Partial payment — pay roughly half, rounded to the
                // nearest peso, but never less than ₱100.
                $partial = max(100, round($totalFine * 0.5));
                $rows[] = [
                    'ticket_id' => $ticket->ticket_id,
                    'payment_reference' => $reference,
                    'amount_paid' => $partial,
                    'payment_date' => $paymentDate,
                    'payment_method' => $methods[$counter % count($methods)],
                    'payment_status' => 'completed',
                    'transaction_id' => null,
                    'receipt_number' => $receipt,
                    'receipt_path' => null,
                    'paid_by' => null,
                    'notes' => 'Partial payment received at counter.',
                    'created_at' => $paymentDate,
                    'updated_at' => $paymentDate,
                ];
            }
        }

        if (!empty($rows)) {
            DB::table('payments')->insert($rows);
        }

        $this->command->info('  ✓ Payments: ' . count($rows));
    }

    /* ==================================================================
     |  REPEAT OFFENDERS
     ================================================================== */

    private function seedRepeatOffenders(): void
    {
        // Aggregate ticket counts per violator.
        $aggregates = DB::table('tickets')
            ->join('ticket_violations', 'tickets.ticket_id', '=', 'ticket_violations.ticket_id')
            ->select(
                'tickets.violator_id',
                DB::raw('COUNT(DISTINCT tickets.ticket_id) as total_violations'),
                DB::raw('SUM(ticket_violations.demerit_points) as total_demerit_points'),
                DB::raw('SUM(ticket_violations.fine_amount) as total_fines'),
                DB::raw('MAX(tickets.violation_datetime) as last_violation_date'),
            )
            ->groupBy('tickets.violator_id')
            ->get();

        $now = now();
        $rows = [];

        foreach ($aggregates as $agg) {
            $isFlagged = $agg->total_violations >= self::REPEAT_OFFENDER_THRESHOLD;

            $rows[] = [
                'violator_id' => $agg->violator_id,
                'total_violations' => (int) $agg->total_violations,
                'total_demerit_points' => (int) $agg->total_demerit_points,
                'total_fines' => (float) $agg->total_fines,
                'last_violation_date' => $agg->last_violation_date,
                'is_flagged' => $isFlagged,
                'flag_reason' => $isFlagged
                    ? sprintf(
                        'Exceeded %d violation(s)',
                        self::REPEAT_OFFENDER_THRESHOLD,
                    )
                    : null,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        if (!empty($rows)) {
            DB::table('repeat_offenders')->insert($rows);
        }

        $this->command->info('  ✓ Repeat offender records: ' . count($rows));
    }

    /* ==================================================================
     |  ATTENDANCE
     ================================================================== */

    private function seedEnforcerAttendance(): void
    {
        $enforcerIds = DB::table('users')
            ->where('role', 'enforcer')
            ->pluck('user_id')
            ->toArray();

        $today = Carbon::today();
        $now = now();
        $rows = [];

        foreach ($enforcerIds as $enforcerIndex => $enforcerId) {
            for ($daysAgo = 0; $daysAgo < self::ATTENDANCE_HISTORY_DAYS; $daysAgo++) {
                $date = $today->copy()->subDays($daysAgo);

                // Skip weekends — enforcers don't work Sat/Sun in this
                // dataset.
                if ($date->isWeekend()) {
                    continue;
                }

                // Skip configured holidays.
                if (array_key_exists($date->format('Y-m-d'), self::HOLIDAYS)) {
                    continue;
                }

                // Don't seed today's attendance — let the mobile app do
                // that through the real flow so we have real photos.
                if ($daysAgo === 0) {
                    continue;
                }

                // Deterministic status roll: ~80% present, ~10% late,
                // ~5% half-day, ~5% on-leave.
                $roll = ($enforcerIndex * 7 + $daysAgo * 3) % 20;

                $status = 'present';
                $lateMinutes = 0;
                $overtimeMinutes = 0;

                if ($roll === 0 || $roll === 5) {
                    $status = 'late';
                    $lateMinutes = 5 + ($enforcerIndex * 11 + $daysAgo * 7) % 45;
                } elseif ($roll === 10) {
                    $status = 'half_day';
                } elseif ($roll === 15) {
                    $status = 'on_leave';
                }

                if ($status === 'on_leave') {
                    $rows[] = [
                        'enforcer_id' => $enforcerId,
                        'date' => $date->format('Y-m-d'),
                        'time_in' => null,
                        'time_out' => null,
                        'time_in_photo' => null,
                        'time_in_location' => null,
                        'time_out_photo' => null,
                        'time_out_location' => null,
                        'status' => $status,
                        'late_minutes' => 0,
                        'overtime_minutes' => 0,
                        'notes' => 'Approved leave',
                        'created_at' => $date->copy()->setTime(8, 0, 0),
                        'updated_at' => $date->copy()->setTime(8, 0, 0),
                    ];
                    continue;
                }

                $timeIn = $date->copy()->setTime(
                    self::WORK_START_HOUR,
                    0,
                    0,
                )->addMinutes($lateMinutes);

                $timeOut = $date->copy()->setTime(
                    self::WORK_END_HOUR,
                    0,
                    0,
                );

                if ($status === 'half_day') {
                    // Half day = leave at noon.
                    $timeOut = $date->copy()->setTime(12, 0, 0);
                } else {
                    // Occasionally add overtime.
                    if (($enforcerIndex + $daysAgo) % 8 === 0) {
                        $overtimeMinutes = 30 + (($enforcerIndex * 5 + $daysAgo) % 90);
                        $timeOut->addMinutes($overtimeMinutes);
                    }
                }

                $rows[] = [
                    'enforcer_id' => $enforcerId,
                    'date' => $date->format('Y-m-d'),
                    'time_in' => $timeIn,
                    'time_out' => $timeOut,
                    'time_in_photo' => null,
                    'time_in_location' => $this->fakeLocation($enforcerIndex, $daysAgo),
                    'time_out_photo' => null,
                    'time_out_location' => $this->fakeLocation($enforcerIndex, $daysAgo + 1),
                    'status' => $status,
                    'late_minutes' => $lateMinutes,
                    'overtime_minutes' => $overtimeMinutes,
                    'notes' => null,
                    'created_at' => $timeIn,
                    'updated_at' => $timeOut,
                ];
            }
        }

        // Insert in chunks to keep the parameter count below SQL limits.
        foreach (array_chunk($rows, 200) as $chunk) {
            DB::table('enforcer_attendance')->insert($chunk);
        }

        $this->command->info('  ✓ Attendance records: ' . count($rows));
    }

    /**
     * Fake but consistent coordinates around El Salvador City.
     */
    private function fakeLocation(int $enforcerIndex, int $offset): string
    {
        $lat = 8.5580 + (($enforcerIndex * 3 + $offset * 7) % 40 - 20) / 10000;
        $lng = 124.5240 + (($enforcerIndex * 5 + $offset * 3) % 40 - 20) / 10000;
        return sprintf('%.6f,%.6f', $lat, $lng);
    }

    /* ==================================================================
     |  APPEALS
     ================================================================== */

    private function seedAppeals(): void
    {
        $contestedTickets = DB::table('tickets')
            ->where('status', 'contested')
            ->get(['ticket_id', 'violator_id', 'created_at']);

        if ($contestedTickets->isEmpty()) {
            $this->command->info('  ✓ Appeals: 0');
            return;
        }

        $reviewers = DB::table('users')
            ->whereIn('role', ['admin', 'staff'])
            ->pluck('user_id')
            ->toArray();

        $statuses = ['pending', 'under_review', 'approved', 'rejected'];
        $now = now();
        $rows = [];

        foreach ($contestedTickets as $i => $ticket) {
            $status = $statuses[$i % count($statuses)];
            $createdAt = Carbon::parse($ticket->created_at)->addDays(1);
            $decided = $status === 'approved' || $status === 'rejected';

            $rows[] = [
                'ticket_id' => $ticket->ticket_id,
                'violator_id' => $ticket->violator_id,
                'appeal_reason' => 'I believe this ticket was issued in error. Requesting adjudication.',
                'supporting_documents' => null,
                'status' => $status,
                'reviewed_by' => $decided ? $reviewers[$i % count($reviewers)] : null,
                'review_notes' => $decided
                    ? 'Reviewed by the traffic adjudication board.'
                    : null,
                'decision_date' => $decided ? $createdAt->copy()->addDays(5) : null,
                'created_at' => $createdAt,
                'updated_at' => $decided ? $createdAt->copy()->addDays(5) : $createdAt,
            ];
        }

        DB::table('appeals')->insert($rows);
        $this->command->info('  ✓ Appeals: ' . count($rows));
    }

    /* ==================================================================
     |  NOTIFICATIONS
     ================================================================== */

    private function seedNotifications(): void
    {
        $enforcers = DB::table('users')
            ->where('role', 'enforcer')
            ->get(['user_id', 'firstname', 'lastname']);

        $admins = DB::table('users')
            ->where('role', 'admin')
            ->pluck('user_id')
            ->toArray();

        // The 15 most recent tickets — a small, focused set of
        // notifications that reflects real activity.
        $recentTickets = DB::table('tickets')
            ->orderBy('created_at', 'desc')
            ->limit(15)
            ->get();

        $now = now();
        $rows = [];

        foreach ($recentTickets as $i => $ticket) {
            $enforcerId = $ticket->enforcer_id;

            // Ticket-created notification → the issuing enforcer.
            $rows[] = [
                'user_id' => $enforcerId,
                'title' => 'Ticket Issued',
                'message' => "Ticket {$ticket->ticket_number} issued successfully.",
                'type' => 'ticket_created',
                'is_read' => $i > 3,
                'related_entity_type' => 'ticket',
                'related_entity_id' => $ticket->ticket_id,
                'created_at' => $ticket->created_at,
                'updated_at' => $ticket->created_at,
            ];

            // Also notify admins about the new ticket, but only for a
            // handful so the admin bell doesn't get flooded.
            if ($i < 5) {
                foreach ($admins as $adminId) {
                    $rows[] = [
                        'user_id' => $adminId,
                        'title' => 'New Ticket Issued',
                        'message' => "A new ticket ({$ticket->ticket_number}) was issued.",
                        'type' => 'ticket_created',
                        'is_read' => true,
                        'related_entity_type' => 'ticket',
                        'related_entity_id' => $ticket->ticket_id,
                        'created_at' => $ticket->created_at,
                        'updated_at' => $ticket->created_at,
                    ];
                }
            }
        }

        // A couple of system announcements to every enforcer.
        foreach ($enforcers as $enforcer) {
            $rows[] = [
                'user_id' => $enforcer->user_id,
                'title' => 'Welcome to TEMU',
                'message' => 'Your mobile app account is ready. Use it to issue tickets and log attendance.',
                'type' => 'announcement',
                'is_read' => false,
                'related_entity_type' => null,
                'related_entity_id' => null,
                'created_at' => $now->copy()->subDays(7),
                'updated_at' => $now->copy()->subDays(7),
            ];
        }

        DB::table('notifications')->insert($rows);
        $this->command->info('  ✓ Notifications: ' . count($rows));
    }
}
