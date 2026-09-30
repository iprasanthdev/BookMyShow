-- ============================================================================
-- BookMyShow Ticketing System - Sample Seed Data Script (MySQL 8.0+)
-- Description: Realistic sample data including Cities, Theatres, Screens,
--              Seats, Movies, Shows across next 7 dates, Users, and ShowSeats.
-- ============================================================================

USE `bookmyshow_db`;

-- 1. Seed Cities
INSERT INTO `cities` (`city_id`, `name`, `state`, `country`) VALUES
(1, 'Bengaluru', 'Karnataka', 'India'),
(2, 'Mumbai', 'Maharashtra', 'India'),
(3, 'Delhi NCR', 'Delhi', 'India');

-- 2. Seed Theatres
INSERT INTO `theatres` (`theatre_id`, `city_id`, `name`, `address`, `latitude`, `longitude`) VALUES
(1, 1, 'PVR Directors Cut - Forum Mall Koramangala', 'Hosur Rd, Koramangala, Bengaluru, Karnataka 560095', 12.93450000, 77.61140000),
(2, 1, 'INOX Lido Mall - MG Road', 'Lido Mall, Ulsoor, Bengaluru, Karnataka 560008', 12.97380000, 77.62010000),
(3, 2, 'PVR Icon - Phoenix Palladium Lower Parel', '462, Senapati Bapat Marg, Lower Parel, Mumbai, Maharashtra 400013', 18.99500000, 72.82420000);

-- 3. Seed Screens
INSERT INTO `screens` (`screen_id`, `theatre_id`, `name`, `total_seats`) VALUES
(1, 1, 'Screen 1 (IMAX 3D)', 60),
(2, 1, 'Screen 2 (4DX)', 40),
(3, 1, 'Screen 3 (Gold Class)', 30),
(4, 2, 'Screen 1 (Dolby Atmos)', 50);

-- 4. Seed Physical Seats for Screen 1 (60 Seats: 3 Rows x 20 Seats)
-- Row A: VIP, Row B: BALCONY, Row C: REGULAR
INSERT INTO `seats` (`screen_id`, `row_identifier`, `seat_number`, `seat_type`, `price_multiplier`) VALUES
-- Row A (VIP)
(1, 'A', 1, 'VIP', 1.50), (1, 'A', 2, 'VIP', 1.50), (1, 'A', 3, 'VIP', 1.50), (1, 'A', 4, 'VIP', 1.50), (1, 'A', 5, 'VIP', 1.50),
(1, 'A', 6, 'VIP', 1.50), (1, 'A', 7, 'VIP', 1.50), (1, 'A', 8, 'VIP', 1.50), (1, 'A', 9, 'VIP', 1.50), (1, 'A', 10, 'VIP', 1.50),
(1, 'A', 11, 'VIP', 1.50), (1, 'A', 12, 'VIP', 1.50), (1, 'A', 13, 'VIP', 1.50), (1, 'A', 14, 'VIP', 1.50), (1, 'A', 15, 'VIP', 1.50),
(1, 'A', 16, 'VIP', 1.50), (1, 'A', 17, 'VIP', 1.50), (1, 'A', 18, 'VIP', 1.50), (1, 'A', 19, 'VIP', 1.50), (1, 'A', 20, 'VIP', 1.50),

-- Row B (BALCONY)
(1, 'B', 1, 'BALCONY', 1.20), (1, 'B', 2, 'BALCONY', 1.20), (1, 'B', 3, 'BALCONY', 1.20), (1, 'B', 4, 'BALCONY', 1.20), (1, 'B', 5, 'BALCONY', 1.20),
(1, 'B', 6, 'BALCONY', 1.20), (1, 'B', 7, 'BALCONY', 1.20), (1, 'B', 8, 'BALCONY', 1.20), (1, 'B', 9, 'BALCONY', 1.20), (1, 'B', 10, 'BALCONY', 1.20),
(1, 'B', 11, 'BALCONY', 1.20), (1, 'B', 12, 'BALCONY', 1.20), (1, 'B', 13, 'BALCONY', 1.20), (1, 'B', 14, 'BALCONY', 1.20), (1, 'B', 15, 'BALCONY', 1.20),
(1, 'B', 16, 'BALCONY', 1.20), (1, 'B', 17, 'BALCONY', 1.20), (1, 'B', 18, 'BALCONY', 1.20), (1, 'B', 19, 'BALCONY', 1.20), (1, 'B', 20, 'BALCONY', 1.20),

-- Row C (REGULAR)
(1, 'C', 1, 'REGULAR', 1.00), (1, 'C', 2, 'REGULAR', 1.00), (1, 'C', 3, 'REGULAR', 1.00), (1, 'C', 4, 'REGULAR', 1.00), (1, 'C', 5, 'REGULAR', 1.00),
(1, 'C', 6, 'REGULAR', 1.00), (1, 'C', 7, 'REGULAR', 1.00), (1, 'C', 8, 'REGULAR', 1.00), (1, 'C', 9, 'REGULAR', 1.00), (1, 'C', 10, 'REGULAR', 1.00),
(1, 'C', 11, 'REGULAR', 1.00), (1, 'C', 12, 'REGULAR', 1.00), (1, 'C', 13, 'REGULAR', 1.00), (1, 'C', 14, 'REGULAR', 1.00), (1, 'C', 15, 'REGULAR', 1.00),
(1, 'C', 16, 'REGULAR', 1.00), (1, 'C', 17, 'REGULAR', 1.00), (1, 'C', 18, 'REGULAR', 1.00), (1, 'C', 19, 'REGULAR', 1.00), (1, 'C', 20, 'REGULAR', 1.00);

-- 5. Seed Movies
INSERT INTO `movies` (`movie_id`, `title`, `description`, `duration_minutes`, `language`, `genre`, `rating`, `release_date`) VALUES
(1, 'Avatar: The Way of Water', 'Jake Sully lives with his newfound family formed on the extrasolar moon Pandora.', 192, 'English', 'Sci-Fi / Action', 'UA', '2026-09-15'),
(2, 'Oppenheimer', 'The story of American scientist J. Robert Oppenheimer and his role in the Manhattan Project.', 180, 'English', 'Biography / Drama', 'U', '2026-09-20'),
(3, 'Kantara: Chapter 1', 'A legend born out of coastal Karnataka exploring the divine bond between man and forest.', 160, 'Kannada', 'Action / Mythological', 'UA', '2026-09-25');

-- 6. Seed Shows for Next 7 Days at PVR Koramangala (Theatre 1)
-- Dynamically seeded using CURDATE() + INTERVAL 0..6 DAY
INSERT INTO `shows` (`movie_id`, `screen_id`, `start_time`, `end_time`, `base_price`, `status`) VALUES
-- Day 0 (Today)
(1, 1, CONCAT(CURDATE() + INTERVAL 0 DAY, ' 10:30:00'), CONCAT(CURDATE() + INTERVAL 0 DAY, ' 13:42:00'), 350.00, 'SCHEDULED'),
(1, 1, CONCAT(CURDATE() + INTERVAL 0 DAY, ' 14:30:00'), CONCAT(CURDATE() + INTERVAL 0 DAY, ' 17:42:00'), 400.00, 'SCHEDULED'),
(2, 2, CONCAT(CURDATE() + INTERVAL 0 DAY, ' 18:00:00'), CONCAT(CURDATE() + INTERVAL 0 DAY, ' 21:00:00'), 300.00, 'SCHEDULED'),
(3, 3, CONCAT(CURDATE() + INTERVAL 0 DAY, ' 21:30:00'), CONCAT(CURDATE() + INTERVAL 0 DAY, ' 00:10:00'), 450.00, 'SCHEDULED'),

-- Day 1 (Tomorrow)
(1, 1, CONCAT(CURDATE() + INTERVAL 1 DAY, ' 11:00:00'), CONCAT(CURDATE() + INTERVAL 1 DAY, ' 14:12:00'), 350.00, 'SCHEDULED'),
(2, 1, CONCAT(CURDATE() + INTERVAL 1 DAY, ' 15:00:00'), CONCAT(CURDATE() + INTERVAL 1 DAY, ' 18:00:00'), 400.00, 'SCHEDULED'),
(3, 2, CONCAT(CURDATE() + INTERVAL 1 DAY, ' 19:30:00'), CONCAT(CURDATE() + INTERVAL 1 DAY, ' 22:10:00'), 450.00, 'SCHEDULED'),

-- Day 2
(1, 1, CONCAT(CURDATE() + INTERVAL 2 DAY, ' 10:30:00'), CONCAT(CURDATE() + INTERVAL 2 DAY, ' 13:42:00'), 350.00, 'SCHEDULED'),
(2, 2, CONCAT(CURDATE() + INTERVAL 2 DAY, ' 14:00:00'), CONCAT(CURDATE() + INTERVAL 2 DAY, ' 17:00:00'), 350.00, 'SCHEDULED'),

-- Day 3
(1, 1, CONCAT(CURDATE() + INTERVAL 3 DAY, ' 14:30:00'), CONCAT(CURDATE() + INTERVAL 3 DAY, ' 17:42:00'), 400.00, 'SCHEDULED'),
(3, 3, CONCAT(CURDATE() + INTERVAL 3 DAY, ' 18:30:00'), CONCAT(CURDATE() + INTERVAL 3 DAY, ' 21:10:00'), 450.00, 'SCHEDULED'),

-- Day 4
(2, 1, CONCAT(CURDATE() + INTERVAL 4 DAY, ' 12:00:00'), CONCAT(CURDATE() + INTERVAL 4 DAY, ' 15:00:00'), 350.00, 'SCHEDULED'),

-- Day 5
(1, 1, CONCAT(CURDATE() + INTERVAL 5 DAY, ' 16:00:00'), CONCAT(CURDATE() + INTERVAL 5 DAY, ' 19:12:00'), 400.00, 'SCHEDULED'),

-- Day 6
(3, 1, CONCAT(CURDATE() + INTERVAL 6 DAY, ' 20:00:00'), CONCAT(CURDATE() + INTERVAL 6 DAY, ' 22:40:00'), 450.00, 'SCHEDULED');

-- 7. Seed Users
INSERT INTO `users` (`user_id`, `name`, `email`, `phone`) VALUES
(1, 'Aarav Sharma', 'aarav.sharma@example.com', '+919876543210'),
(2, 'Diya Patel', 'diya.patel@example.com', '+919876543211'),
(3, 'Rohan Verma', 'rohan.verma@example.com', '+919876543212');

-- 8. Seed ShowSeats for Show #1 (60 seats mapped from seats table for Screen 1)
INSERT INTO `show_seats` (`show_id`, `seat_id`, `status`, `price`, `version`)
SELECT 
    1 AS show_id, 
    s.seat_id, 
    'AVAILABLE' AS status, 
    ROUND(350.00 * s.price_multiplier, 2) AS price, 
    1 AS version
FROM `seats` s
WHERE s.screen_id = 1;

-- 9. Seed a Sample Booking & Held/Booked Seats for demonstration
-- User 1 holds Seats A1, A2 for Show 1
INSERT INTO `bookings` (`booking_id`, `booking_ref`, `user_id`, `show_id`, `total_amount`, `status`, `idempotency_key`, `hold_expires_at`) VALUES
(1, 'BK-2026-9901-XYZ', 1, 1, 1050.00, 'CONFIRMED', 'IDEMP-PAY-1001-A', DATE_ADD(NOW(), INTERVAL 10 MINUTE));

-- Mark Seat A1 (seat_id=1) and Seat A2 (seat_id=2) as BOOKED under booking_id 1
UPDATE `show_seats` 
SET `status` = 'BOOKED', `booking_id` = 1 
WHERE `show_id` = 1 AND `seat_id` IN (1, 2);

-- User 2 holds Seat B1 (seat_id=21) for Show 1 (Currently HELD, expiring in 10 mins)
INSERT INTO `bookings` (`booking_id`, `booking_ref`, `user_id`, `show_id`, `total_amount`, `status`, `idempotency_key`, `hold_expires_at`) VALUES
(2, 'BK-2026-9902-ABC', 2, 1, 420.00, 'PENDING_PAYMENT', 'IDEMP-HOLD-1002-B', DATE_ADD(NOW(), INTERVAL 10 MINUTE));

UPDATE `show_seats` 
SET `status` = 'HELD', `booking_id` = 2, `hold_expires_at` = DATE_ADD(NOW(), INTERVAL 10 MINUTE)
WHERE `show_id` = 1 AND `seat_id` = 21;

-- 10. Seed Payment Webhook sample
INSERT INTO `payment_webhooks` (`webhook_id`, `transaction_id`, `booking_id`, `event_type`, `payload_hash`, `amount`, `status`) VALUES
(1, 'pay_RZR_987654321', 1, 'payment.captured', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 1050.00, 'PROCESSED');
