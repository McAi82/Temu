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
     * Run the database seeds.
     */
    public function run(): void
    {
        // Disable foreign key checks
        DB::statement('SET FOREIGN_KEY_CHECKS=0');

        // Truncate all tables
        $this->truncateTables();

        // Seed all tables
        $this->seedUsers();
        $this->seedVehicles();
        $this->seedViolationTypes();
        $this->seedViolators();
        $this->seedTickets();
        $this->seedTicketViolations();
        $this->seedEnforcerAttendance();
        $this->seedPayments();
        $this->seedAppeals();
        $this->seedNotifications();
        $this->seedSettings();

        // Enable foreign key checks
        DB::statement('SET FOREIGN_KEY_CHECKS=1');

        $this->command->info('All tables seeded successfully!');
    }

    /**
     * Truncate all tables
     */
    private function truncateTables(): void
    {
        $tables = [
            'users',
            'vehicles',
            'violation_types',
            'violators',
            'tickets',
            'ticket_violations',
            'enforcer_attendance',
            'payments',
            'appeals',
            'notifications',
            'settings',
            'repeat_offenders',
            'violator_vehicles'
        ];

        foreach ($tables as $table) {
            DB::table($table)->truncate();
        }
    }

    /**
     * Seed users table
     */
    private function seedUsers(): void
    {
        $users = [
            // Admin Users
            [
                'email' => 'occ.balasabas.johnpaul@gmail.com',
                'password_hash' => Hash::make('password123'),
                'firstname' => 'John',
                'middlename' => 'A',
                'lastname' => 'Santos',
                'role' => 'admin',
                'contact_number' => '09123456789',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],

            // Staff Users
            [
                'email' => 'luiskarlcons@gmail.com',
                'password_hash' => Hash::make('password123'),
                'firstname' => 'Juanito',
                'middlename' => 'B',
                'lastname' => 'Enerio',
                'role' => 'staff',
                'contact_number' => '09123456791',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],


        ];

        DB::table('users')->insert($users);
        $this->command->info('Users seeded: ' . count($users));
    }

    /**
     * Seed vehicles table
     */
    private function seedVehicles(): void
    {
        $vehicles = [
            ['platenumber' => 'ABC-1234', 'owner' => 'Juan Dela Cruz', 'address' => '123 Manila St', 'make' => 'Toyota', 'color' => 'White', 'model' => 'Vios', 'year_model' => 2020, 'body_type' => 'Sedan'],
            ['platenumber' => 'DEF-5678', 'owner' => 'Maria Santos', 'address' => '456 Quezon Ave', 'make' => 'Honda', 'color' => 'Black', 'model' => 'Civic', 'year_model' => 2021, 'body_type' => 'Sedan'],
            ['platenumber' => 'GHI-9012', 'owner' => 'Pedro Garcia', 'address' => '789 Makati St', 'make' => 'Mitsubishi', 'color' => 'Red', 'model' => 'Montero', 'year_model' => 2019, 'body_type' => 'SUV'],
            ['platenumber' => 'JKL-3456', 'owner' => 'Ana Lopez', 'address' => '321 Pasay Rd', 'make' => 'Ford', 'color' => 'Blue', 'model' => 'Ranger', 'year_model' => 2022, 'body_type' => 'Pickup'],
            ['platenumber' => 'MNO-7890', 'owner' => 'Ramon Fernandez', 'address' => '654 Taguig St', 'make' => 'Nissan', 'color' => 'Gray', 'model' => 'Navara', 'year_model' => 2020, 'body_type' => 'Pickup'],
            ['platenumber' => 'PQR-1234', 'owner' => 'Elena Rivera', 'address' => '987 Pasig Blvd', 'make' => 'Hyundai', 'color' => 'Silver', 'model' => 'Accent', 'year_model' => 2021, 'body_type' => 'Sedan'],
            ['platenumber' => 'STU-5678', 'owner' => 'Victor Reyes', 'address' => '147 Caloocan St', 'make' => 'Kia', 'color' => 'White', 'model' => 'Seltos', 'year_model' => 2022, 'body_type' => 'SUV'],
            ['platenumber' => 'VWX-9012', 'owner' => 'Cecilia Cruz', 'address' => '258 Mandaluyong Ave', 'make' => 'Suzuki', 'color' => 'Yellow', 'model' => 'Swift', 'year_model' => 2020, 'body_type' => 'Hatchback'],
            ['platenumber' => 'YZA-3456', 'owner' => 'Benjamin Tan', 'address' => '369 San Juan St', 'make' => 'Mazda', 'color' => 'Red', 'model' => '3', 'year_model' => 2021, 'body_type' => 'Sedan'],
            ['platenumber' => 'BCD-7890', 'owner' => 'Natalie Ong', 'address' => '741 Malabon Rd', 'make' => 'Chevrolet', 'color' => 'Black', 'model' => 'Trailblazer', 'year_model' => 2019, 'body_type' => 'SUV'],
            ['platenumber' => 'EFG-2345', 'owner' => 'Gregory Ramos', 'address' => '852 Navotas St', 'make' => 'Isuzu', 'color' => 'Blue', 'model' => 'D-Max', 'year_model' => 2022, 'body_type' => 'Pickup'],
            ['platenumber' => 'HIJ-6789', 'owner' => 'Angela Mercado', 'address' => '963 Valenzuela Ave', 'make' => 'Toyota', 'color' => 'Silver', 'model' => 'Innova', 'year_model' => 2021, 'body_type' => 'MPV'],
            ['platenumber' => 'KLM-0123', 'owner' => 'Ferdinand Marcos', 'address' => '159 Las Pinas St', 'make' => 'Honda', 'color' => 'White', 'model' => 'CR-V', 'year_model' => 2020, 'body_type' => 'SUV'],
            ['platenumber' => 'NOP-4567', 'owner' => 'Imelda Reyes', 'address' => '357 Muntinlupa Rd', 'make' => 'Mitsubishi', 'color' => 'Black', 'model' => 'Mirage', 'year_model' => 2019, 'body_type' => 'Hatchback'],
            ['platenumber' => 'QRS-8901', 'owner' => 'Corazon Aquino', 'address' => '246 Paranaque St', 'make' => 'Ford', 'color' => 'Red', 'model' => 'Everest', 'year_model' => 2022, 'body_type' => 'SUV'],
        ];

        foreach ($vehicles as $vehicle) {
            $vehicle['created_at'] = now();
            $vehicle['updated_at'] = now();
            DB::table('vehicles')->insert($vehicle);
        }
        $this->command->info('Vehicles seeded: ' . count($vehicles));
    }

    /**
     * Seed violation_types table
     */
    private function seedViolationTypes(): void
    {
        $violations = [
            ['violation_code' => 'TR-001', 'violation_name' => 'Reckless Driving', 'description' => 'Driving without due care and caution', 'fine_amount' => 2000.00, 'demerit_points' => 5, 'category' => 'Traffic Rules'],
            ['violation_code' => 'TR-002', 'violation_name' => 'Over Speeding', 'description' => 'Exceeding the speed limit', 'fine_amount' => 1500.00, 'demerit_points' => 3, 'category' => 'Traffic Rules'],
            ['violation_code' => 'TR-003', 'violation_name' => 'Illegal Parking', 'description' => 'Parking in no parking zone', 'fine_amount' => 500.00, 'demerit_points' => 1, 'category' => 'Parking'],
            ['violation_code' => 'TR-004', 'violation_name' => 'No Seatbelt', 'description' => 'Driver or passenger without seatbelt', 'fine_amount' => 1000.00, 'demerit_points' => 2, 'category' => 'Safety'],
            ['violation_code' => 'TR-005', 'violation_name' => 'Using Mobile Phone', 'description' => 'Using mobile phone while driving', 'fine_amount' => 3000.00, 'demerit_points' => 5, 'category' => 'Traffic Rules'],
            ['violation_code' => 'TR-006', 'violation_name' => 'Disregarding Traffic Signal', 'description' => 'Running red light or ignoring stop sign', 'fine_amount' => 1500.00, 'demerit_points' => 3, 'category' => 'Traffic Rules'],
            ['violation_code' => 'TR-007', 'violation_name' => 'No Driver\'s License', 'description' => 'Driving without valid license', 'fine_amount' => 3000.00, 'demerit_points' => 5, 'category' => 'Documents'],
            ['violation_code' => 'TR-008', 'violation_name' => 'No OR/CR', 'description' => 'No official receipt or certificate of registration', 'fine_amount' => 2000.00, 'demerit_points' => 3, 'category' => 'Documents'],
            ['violation_code' => 'TR-009', 'violation_name' => 'Expired Registration', 'description' => 'Vehicle registration expired', 'fine_amount' => 1500.00, 'demerit_points' => 2, 'category' => 'Documents'],
            ['violation_code' => 'TR-010', 'violation_name' => 'Drunk Driving', 'description' => 'Operating vehicle under influence of alcohol', 'fine_amount' => 5000.00, 'demerit_points' => 10, 'category' => 'Serious Violation'],
            ['violation_code' => 'TR-011', 'violation_name' => 'Smoke Belching', 'description' => 'Excessive smoke emission', 'fine_amount' => 2000.00, 'demerit_points' => 2, 'category' => 'Vehicle Condition'],
            ['violation_code' => 'TR-012', 'violation_name' => 'Modified Exhaust', 'description' => 'Unauthorized exhaust modification', 'fine_amount' => 2000.00, 'demerit_points' => 2, 'category' => 'Vehicle Condition'],
            ['violation_code' => 'TR-013', 'violation_name' => 'No Side Mirror', 'description' => 'Vehicle without side mirror', 'fine_amount' => 1000.00, 'demerit_points' => 1, 'category' => 'Vehicle Condition'],
            ['violation_code' => 'TR-014', 'violation_name' => 'Defective Lights', 'description' => 'Broken or missing headlights/tail lights', 'fine_amount' => 1000.00, 'demerit_points' => 1, 'category' => 'Vehicle Condition'],
            ['violation_code' => 'TR-015', 'violation_name' => 'No Plate Number', 'description' => 'Vehicle without plate number', 'fine_amount' => 3000.00, 'demerit_points' => 3, 'category' => 'Documents'],
            ['violation_code' => 'TR-016', 'violation_name' => 'Obstructing Traffic', 'description' => 'Causing traffic obstruction', 'fine_amount' => 1000.00, 'demerit_points' => 2, 'category' => 'Traffic Rules'],
            ['violation_code' => 'TR-017', 'violation_name' => 'Wrong Turn', 'description' => 'Making illegal turn', 'fine_amount' => 500.00, 'demerit_points' => 1, 'category' => 'Traffic Rules'],
            ['violation_code' => 'TR-018', 'violation_name' => 'Oversized Load', 'description' => 'Carrying oversized load without permit', 'fine_amount' => 2500.00, 'demerit_points' => 3, 'category' => 'Cargo'],
            ['violation_code' => 'TR-019', 'violation_name' => 'Colorum Operation', 'description' => 'Unauthorized public transport operation', 'fine_amount' => 6000.00, 'demerit_points' => 5, 'category' => 'Serious Violation'],
            ['violation_code' => 'TR-020', 'violation_name' => 'Tinted Windows', 'description' => 'Excessively dark or prohibited tint', 'fine_amount' => 1500.00, 'demerit_points' => 1, 'category' => 'Vehicle Condition'],
        ];

        foreach ($violations as $violation) {
            $violation['created_at'] = now();
            $violation['updated_at'] = now();
            DB::table('violation_types')->insert($violation);
        }
        $this->command->info('Violations seeded: ' . count($violations));
    }

    /**
     * Seed violators table
     */
    private function seedViolators(): void
    {
        $violators = [
            ['firstname' => 'Juan', 'lastname' => 'Dela Cruz', 'license' => 'L123456789', 'expiry' => '2025-12-31', 'birthday' => '1985-05-15', 'gender' => 'Male', 'prof_non_prof' => 'Professional', 'nationality' => 'Filipino', 'restriction' => 'A,B,B1,B2'],
            ['firstname' => 'Maria', 'lastname' => 'Santos', 'license' => 'L987654321', 'expiry' => '2026-03-20', 'birthday' => '1990-08-22', 'gender' => 'Female', 'prof_non_prof' => 'Non-Professional', 'nationality' => 'Filipino', 'restriction' => 'A,B'],
            ['firstname' => 'Pedro', 'lastname' => 'Garcia', 'license' => 'L456789123', 'expiry' => '2024-11-10', 'birthday' => '1982-03-10', 'gender' => 'Male', 'prof_non_prof' => 'Professional', 'nationality' => 'Filipino', 'restriction' => 'A,B,B1,B2,C'],
            ['firstname' => 'Ana', 'lastname' => 'Lopez', 'license' => 'L789123456', 'expiry' => '2025-07-18', 'birthday' => '1995-12-05', 'gender' => 'Female', 'prof_non_prof' => 'Non-Professional', 'nationality' => 'Filipino', 'restriction' => 'A,B'],
            ['firstname' => 'Ramon', 'lastname' => 'Fernandez', 'license' => 'L321654987', 'expiry' => '2024-09-25', 'birthday' => '1988-06-30', 'gender' => 'Male', 'prof_non_prof' => 'Professional', 'nationality' => 'Filipino', 'restriction' => 'A,B,C,D'],
            ['firstname' => 'Elena', 'lastname' => 'Rivera', 'license' => 'L654987321', 'expiry' => '2026-01-14', 'birthday' => '1992-11-18', 'gender' => 'Female', 'prof_non_prof' => 'Professional', 'nationality' => 'Filipino', 'restriction' => 'A,B'],
            ['firstname' => 'Victor', 'lastname' => 'Reyes', 'license' => 'L147258369', 'expiry' => '2025-05-08', 'birthday' => '1980-09-25', 'gender' => 'Male', 'prof_non_prof' => 'Professional', 'nationality' => 'Filipino', 'restriction' => 'A,B,C'],
            ['firstname' => 'Cecilia', 'lastname' => 'Cruz', 'license' => 'L369258147', 'expiry' => '2024-12-03', 'birthday' => '1998-04-12', 'gender' => 'Female', 'prof_non_prof' => 'Non-Professional', 'nationality' => 'Filipino', 'restriction' => 'A'],
            ['firstname' => 'Benjamin', 'lastname' => 'Tan', 'license' => 'L741852963', 'expiry' => '2025-10-22', 'birthday' => '1987-07-08', 'gender' => 'Male', 'prof_non_prof' => 'Professional', 'nationality' => 'Filipino-Chinese', 'restriction' => 'A,B,B1,B2'],
            ['firstname' => 'Natalie', 'lastname' => 'Ong', 'license' => 'L852963741', 'expiry' => '2026-06-17', 'birthday' => '1993-02-28', 'gender' => 'Female', 'prof_non_prof' => 'Professional', 'nationality' => 'Filipino-Chinese', 'restriction' => 'A,B'],
            ['firstname' => 'Gregory', 'lastname' => 'Ramos', 'license' => 'L963741852', 'expiry' => '2024-08-30', 'birthday' => '1984-10-14', 'gender' => 'Male', 'prof_non_prof' => 'Professional', 'nationality' => 'Filipino', 'restriction' => 'A,B,C'],
            ['firstname' => 'Angela', 'lastname' => 'Mercado', 'license' => 'L159753486', 'expiry' => '2025-04-05', 'birthday' => '1991-01-20', 'gender' => 'Female', 'prof_non_prof' => 'Non-Professional', 'nationality' => 'Filipino', 'restriction' => 'A,B'],
        ];

        foreach ($violators as $violator) {
            $violator['created_at'] = now();
            $violator['updated_at'] = now();
            DB::table('violators')->insert($violator);
        }
        $this->command->info('Violators seeded: ' . count($violators));
    }

    /**
     * Seed tickets table
     */
    private function seedTickets(): void
    {
        $enforcers = DB::table('users')->where('role', 'enforcer')->pluck('user_id')->toArray();
        $violators = DB::table('violators')->pluck('violator_id')->toArray();
        $vehicles = DB::table('vehicles')->pluck('vehicle_id')->toArray();

        $statuses = ['issued', 'paid', 'contested', 'dismissed'];
        $locations = ['Edsa corner Ayala', 'C5 Road', 'Commonwealth Ave', 'Taft Avenue', 'Roxas Blvd', 'Quirino Highway', 'Marcos Highway', 'Ortigas Ave', 'Shaw Blvd', 'Quezon Ave'];

        $tickets = [];

        for ($i = 1; $i <= 100; $i++) {
            $date = Carbon::now()->subDays(rand(0, 90));
            $status = $statuses[array_rand($statuses)];

            $tickets[] = [
                'ticket_number' => 'TKT-' . date('Ymd', strtotime($date)) . '-' . str_pad($i, 4, '0', STR_PAD_LEFT),
                'violator_id' => $violators[array_rand($violators)],
                'vehicle_id' => $vehicles[array_rand($vehicles)],
                'enforcer_id' => $enforcers[array_rand($enforcers)],
                'location' => $locations[array_rand($locations)],
                'latitude' => 14.5995 + (rand(-100, 100) / 1000),
                'longitude' => 120.9842 + (rand(-100, 100) / 1000),
                'violation_datetime' => $date,
                'remarks' => rand(0, 1) ? 'Driver warned about violation' : null,
                'status' => $status,
                'created_at' => $date,
                'updated_at' => $date,
            ];
        }

        DB::table('tickets')->insert($tickets);
        $this->command->info('Tickets seeded: ' . count($tickets));
    }

    /**
     * Seed ticket_violations table
     */
    private function seedTicketViolations(): void
    {
        $tickets = DB::table('tickets')->pluck('ticket_id')->toArray();
        $violationTypes = DB::table('violation_types')->get();

        $ticketViolations = [];

        foreach ($tickets as $ticketId) {
            // Each ticket gets 1-3 violations
            $numViolations = rand(1, 3);
            $selectedViolations = array_rand($violationTypes->toArray(), min($numViolations, count($violationTypes)));

            if (!is_array($selectedViolations)) {
                $selectedViolations = [$selectedViolations];
            }

            foreach ($selectedViolations as $index) {
                $violation = $violationTypes[$index];
                $ticketViolations[] = [
                    'ticket_id' => $ticketId,
                    'violation_id' => $violation->violation_id,
                    'fine_amount' => $violation->fine_amount,
                    'demerit_points' => $violation->demerit_points,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
        }

        DB::table('ticket_violations')->insert($ticketViolations);
        $this->command->info('Ticket violations seeded: ' . count($ticketViolations));
    }

    /**
     * Seed enforcer_attendance table
     */
    private function seedEnforcerAttendance(): void
    {
        $enforcers = DB::table('users')->where('role', 'enforcer')->pluck('user_id')->toArray();
        $statuses = ['present', 'late', 'absent', 'on_leave', 'half_day'];

        $attendances = [];

        foreach ($enforcers as $enforcerId) {
            // Generate attendance for last 30 days
            for ($i = 0; $i < 30; $i++) {
                $date = Carbon::now()->subDays($i);
                if ($date->isWeekend())
                    continue; // Skip weekends

                $status = $statuses[array_rand($statuses)];
                $timeIn = null;
                $timeOut = null;
                $lateMinutes = 0;
                $overtimeMinutes = 0;

                if ($status !== 'absent') {
                    $baseTimeIn = Carbon::parse($date->format('Y-m-d') . ' 08:00:00');
                    $lateMinutes = $status === 'late' ? rand(5, 60) : 0;
                    $timeIn = $baseTimeIn->copy()->addMinutes($lateMinutes);

                    $timeOut = Carbon::parse($date->format('Y-m-d') . ' 17:00:00');
                    $overtimeMinutes = rand(0, 120);
                    $timeOut->addMinutes($overtimeMinutes);
                }

                $attendances[] = [
                    'enforcer_id' => $enforcerId,
                    'date' => $date->format('Y-m-d'),
                    'time_in' => $timeIn,
                    'time_out' => $timeOut,
                    'status' => $status,
                    'late_minutes' => $lateMinutes,
                    'overtime_minutes' => $overtimeMinutes,
                    'created_at' => $date,
                    'updated_at' => $date,
                ];
            }
        }

        DB::table('enforcer_attendance')->insert($attendances);
        $this->command->info('Attendance records seeded: ' . count($attendances));
    }

    /**
     * Seed payments table
     */
    private function seedPayments(): void
    {
        $paidTickets = DB::table('tickets')->where('status', 'paid')->pluck('ticket_id')->toArray();
        $paymentMethods = ['cash', 'gcash', 'maya', 'over_the_counter'];

        $payments = [];

        foreach ($paidTickets as $ticketId) {
            $ticket = DB::table('tickets')->where('ticket_id', $ticketId)->first();
            $totalFine = DB::table('ticket_violations')
                ->where('ticket_id', $ticketId)
                ->sum('fine_amount');

            if ($totalFine > 0) {
                $payments[] = [
                    'ticket_id' => $ticketId,
                    'payment_reference' => 'PAY-' . strtoupper(Str::random(10)),
                    'amount_paid' => $totalFine,
                    'payment_date' => Carbon::parse($ticket->created_at)->addDays(rand(1, 30)),
                    'payment_method' => $paymentMethods[array_rand($paymentMethods)],
                    'payment_status' => 'completed',
                    'receipt_number' => 'RCP-' . strtoupper(Str::random(8)),
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
        }

        if (!empty($payments)) {
            DB::table('payments')->insert($payments);
            $this->command->info('Payments seeded: ' . count($payments));
        }
    }

    /**
     * Seed appeals table
     */
    private function seedAppeals(): void
    {
        $contestedTickets = DB::table('tickets')->where('status', 'contested')->pluck('ticket_id')->toArray();
        $reviewers = DB::table('users')->whereIn('role', ['admin', 'staff'])->pluck('user_id')->toArray();
        $statuses = ['pending', 'approved', 'rejected', 'under_review'];

        $appeals = [];

        foreach ($contestedTickets as $ticketId) {
            $ticket = DB::table('tickets')->where('ticket_id', $ticketId)->first();
            $status = $statuses[array_rand($statuses)];

            $appeals[] = [
                'ticket_id' => $ticketId,
                'violator_id' => $ticket->violator_id,
                'appeal_reason' => 'I believe this ticket was issued in error. Please review my case.',
                'status' => $status,
                'reviewed_by' => $status !== 'pending' ? $reviewers[array_rand($reviewers)] : null,
                'review_notes' => $status !== 'pending' ? 'Case under review by traffic adjudication board.' : null,
                'decision_date' => $status !== 'pending' ? Carbon::now()->subDays(rand(1, 10)) : null,
                'created_at' => Carbon::parse($ticket->created_at)->addDays(rand(1, 5)),
                'updated_at' => now(),
            ];
        }

        if (!empty($appeals)) {
            DB::table('appeals')->insert($appeals);
            $this->command->info('Appeals seeded: ' . count($appeals));
        }
    }

    /**
     * Seed notifications table
     */
    private function seedNotifications(): void
    {
        $users = DB::table('users')->pluck('user_id')->toArray();
        $types = ['ticket_created', 'payment_received', 'ticket_paid', 'reminder', 'announcement'];
        $titles = [
            'New Ticket Issued',
            'Payment Received',
            'Ticket Status Updated',
            'Attendance Reminder',
            'System Announcement'
        ];
        $messages = [
            'A new traffic ticket has been issued.',
            'Your payment has been successfully processed.',
            'Your ticket status has been updated.',
            'Please complete your attendance for today.',
            'Please be informed of the new traffic guidelines.'
        ];

        $notifications = [];

        for ($i = 1; $i <= 50; $i++) {
            $type = $types[array_rand($types)];
            $index = array_rand($titles);

            $notifications[] = [
                'user_id' => $users[array_rand($users)],
                'title' => $titles[$index],
                'message' => $messages[$index] . ' Reference: ' . strtoupper(Str::random(6)),
                'type' => $type,
                'is_read' => rand(0, 1),
                'created_at' => Carbon::now()->subDays(rand(0, 30)),
                'updated_at' => now(),
            ];
        }

        DB::table('notifications')->insert($notifications);
        $this->command->info('Notifications seeded: ' . count($notifications));
    }

    /**
     * Seed settings table
     */
    private function seedSettings(): void
    {
        $settings = [
            ['setting_key' => 'company_name', 'setting_value' => 'TEMU Traffic System', 'setting_type' => 'text', 'description' => 'Company name', 'group_name' => 'general'],
            ['setting_key' => 'company_address', 'setting_value' => 'El Salvador City, Philippines', 'setting_type' => 'text', 'description' => 'Company address', 'group_name' => 'general'],
            ['setting_key' => 'time_in_start', 'setting_value' => '08:00:00', 'setting_type' => 'text', 'description' => 'Official time in start', 'group_name' => 'attendance'],
            ['setting_key' => 'time_out_end', 'setting_value' => '17:00:00', 'setting_type' => 'text', 'description' => 'Official time out end', 'group_name' => 'attendance'],
            ['setting_key' => 'grace_period_minutes', 'setting_value' => '15', 'setting_type' => 'number', 'description' => 'Grace period before marking late', 'group_name' => 'attendance'],
            ['setting_key' => 'repeat_offender_threshold', 'setting_value' => '3', 'setting_type' => 'number', 'description' => 'Number of violations to flag as repeat offender', 'group_name' => 'enforcement'],
            ['setting_key' => 'demerit_suspension_points', 'setting_value' => '12', 'setting_type' => 'number', 'description' => 'Demerit points for license suspension', 'group_name' => 'enforcement'],
            ['setting_key' => 'fine_payment_due_days', 'setting_value' => '15', 'setting_type' => 'number', 'description' => 'Days to pay fine before penalty', 'group_name' => 'payments'],
            ['setting_key' => 'enable_notifications', 'setting_value' => 'true', 'setting_type' => 'boolean', 'description' => 'Enable push notifications', 'group_name' => 'notifications'],
            ['setting_key' => 'maintenance_mode', 'setting_value' => 'false', 'setting_type' => 'boolean', 'description' => 'System maintenance mode', 'group_name' => 'system'],
            ['setting_key' => 'max_ticket_appeal_days', 'setting_value' => '30', 'setting_type' => 'number', 'description' => 'Maximum days to file an appeal', 'group_name' => 'enforcement'],
            ['setting_key' => 'attendance_required_hours', 'setting_value' => '8', 'setting_type' => 'number', 'description' => 'Required working hours per day', 'group_name' => 'attendance'],
        ];

        foreach ($settings as $setting) {
            $setting['created_at'] = now();
            $setting['updated_at'] = now();
            DB::table('settings')->insert($setting);
        }
        $this->command->info('Settings seeded: ' . count($settings));
    }
}
