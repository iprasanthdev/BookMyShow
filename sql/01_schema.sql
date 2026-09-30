-- ============================================================================
-- BookMyShow Ticketing System - Database Schema Definition (MySQL 8.0+)
-- Description: Fully normalized (1NF, 2NF, 3NF, BCNF) high-concurrency schema 
--              with seat-level locking constraints and payment idempotency.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `bookmyshow_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `bookmyshow_db`;

-- Drop tables in reverse order of foreign key dependency for clean re-creation
DROP TABLE IF EXISTS `payment_webhooks`;
DROP TABLE IF EXISTS `show_seats`;
DROP TABLE IF EXISTS `bookings`;
DROP TABLE IF EXISTS `seats`;
DROP TABLE IF EXISTS `shows`;
DROP TABLE IF EXISTS `screens`;
DROP TABLE IF EXISTS `theatres`;
DROP TABLE IF EXISTS `cities`;
DROP TABLE IF EXISTS `movies`;
DROP TABLE IF EXISTS `users`;

-- ----------------------------------------------------------------------------
-- Table: cities
-- Stores geographical cities where theatres operate.
-- ----------------------------------------------------------------------------
CREATE TABLE `cities` (
    `city_id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `state` VARCHAR(100) NOT NULL,
    `country` VARCHAR(100) NOT NULL DEFAULT 'India',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`city_id`),
    UNIQUE KEY `uk_city_state` (`name`, `state`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table: theatres
-- Cinema halls located within a city.
-- ----------------------------------------------------------------------------
CREATE TABLE `theatres` (
    `theatre_id` BIGINT NOT NULL AUTO_INCREMENT,
    `city_id` BIGINT NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `address` TEXT NOT NULL,
    `latitude` DECIMAL(10,8) DEFAULT NULL,
    `longitude` DECIMAL(11,8) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`theatre_id`),
    CONSTRAINT `fk_theatres_city` FOREIGN KEY (`city_id`) REFERENCES `cities` (`city_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX `idx_theatres_city` (`city_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table: screens
-- Auditoriums/Screens inside a specific theatre.
-- ----------------------------------------------------------------------------
CREATE TABLE `screens` (
    `screen_id` BIGINT NOT NULL AUTO_INCREMENT,
    `theatre_id` BIGINT NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `total_seats` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`screen_id`),
    CONSTRAINT `fk_screens_theatre` FOREIGN KEY (`theatre_id`) REFERENCES `theatres` (`theatre_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX `idx_screens_theatre` (`theatre_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table: seats
-- Physical seat positions inside a screen.
-- ----------------------------------------------------------------------------
CREATE TABLE `seats` (
    `seat_id` BIGINT NOT NULL AUTO_INCREMENT,
    `screen_id` BIGINT NOT NULL,
    `row_identifier` VARCHAR(5) NOT NULL,
    `seat_number` INT NOT NULL,
    `seat_type` ENUM('REGULAR', 'BALCONY', 'VIP') NOT NULL DEFAULT 'REGULAR',
    `price_multiplier` DECIMAL(3,2) NOT NULL DEFAULT 1.00,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`seat_id`),
    CONSTRAINT `fk_seats_screen` FOREIGN KEY (`screen_id`) REFERENCES `screens` (`screen_id`) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY `uk_screen_row_seat` (`screen_id`, `row_identifier`, `seat_number`),
    INDEX `idx_seats_screen` (`screen_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table: movies
-- Catalog of movies available for scheduling.
-- ----------------------------------------------------------------------------
CREATE TABLE `movies` (
    `movie_id` BIGINT NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT DEFAULT NULL,
    `duration_minutes` INT NOT NULL,
    `language` VARCHAR(50) NOT NULL,
    `genre` VARCHAR(100) DEFAULT NULL,
    `rating` VARCHAR(10) DEFAULT 'UA',
    `release_date` DATE DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`movie_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table: shows
-- Specific movie show screening event scheduled in a theatre screen.
-- Note: Includes composite index (screen_id, start_time) to optimize P2 showtimes.
-- ----------------------------------------------------------------------------
CREATE TABLE `shows` (
    `show_id` BIGINT NOT NULL AUTO_INCREMENT,
    `movie_id` BIGINT NOT NULL,
    `screen_id` BIGINT NOT NULL,
    `start_time` DATETIME NOT NULL,
    `end_time` DATETIME NOT NULL,
    `base_price` DECIMAL(10,2) NOT NULL,
    `status` ENUM('SCHEDULED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'SCHEDULED',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`show_id`),
    CONSTRAINT `fk_shows_movie` FOREIGN KEY (`movie_id`) REFERENCES `movies` (`movie_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_shows_screen` FOREIGN KEY (`screen_id`) REFERENCES `screens` (`screen_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX `idx_shows_screen_start` (`screen_id`, `start_time`),
    INDEX `idx_shows_movie_start` (`movie_id`, `start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table: users
-- Platform users purchasing tickets.
-- ----------------------------------------------------------------------------
CREATE TABLE `users` (
    `user_id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`),
    UNIQUE KEY `uk_users_email` (`email`),
    UNIQUE KEY `uk_users_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table: bookings
-- Ticket purchase order placed by a user for a show.
-- ----------------------------------------------------------------------------
CREATE TABLE `bookings` (
    `booking_id` BIGINT NOT NULL AUTO_INCREMENT,
    `booking_ref` VARCHAR(36) NOT NULL,
    `user_id` BIGINT NOT NULL,
    `show_id` BIGINT NOT NULL,
    `total_amount` DECIMAL(10,2) NOT NULL,
    `status` ENUM('PENDING_PAYMENT', 'CONFIRMED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_PAYMENT',
    `idempotency_key` VARCHAR(100) DEFAULT NULL,
    `hold_expires_at` DATETIME NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`booking_id`),
    UNIQUE KEY `uk_booking_ref` (`booking_ref`),
    UNIQUE KEY `uk_idempotency_key` (`idempotency_key`),
    CONSTRAINT `fk_bookings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_bookings_show` FOREIGN KEY (`show_id`) REFERENCES `shows` (`show_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX `idx_bookings_user` (`user_id`),
    INDEX `idx_bookings_show_status` (`show_id`, `status`),
    INDEX `idx_bookings_expires` (`status`, `hold_expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table: show_seats
-- Instance of a physical seat for a specific show.
-- CRITICAL CONCURRENCY CONTROL:
-- 1. UNIQUE KEY `uk_show_seat` (`show_id`, `seat_id`) prevents duplicate seat records.
-- 2. `version` column supports optimistic concurrency control (OCC).
-- 3. `status` transitions: AVAILABLE -> HELD -> BOOKED (or HELD -> AVAILABLE on expiry).
-- ----------------------------------------------------------------------------
CREATE TABLE `show_seats` (
    `show_seat_id` BIGINT NOT NULL AUTO_INCREMENT,
    `show_id` BIGINT NOT NULL,
    `seat_id` BIGINT NOT NULL,
    `booking_id` BIGINT DEFAULT NULL,
    `status` ENUM('AVAILABLE', 'HELD', 'BOOKED') NOT NULL DEFAULT 'AVAILABLE',
    `price` DECIMAL(10,2) NOT NULL,
    `version` INT UNSIGNED NOT NULL DEFAULT 1,
    `hold_expires_at` DATETIME DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`show_seat_id`),
    CONSTRAINT `fk_show_seats_show` FOREIGN KEY (`show_id`) REFERENCES `shows` (`show_id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_show_seats_seat` FOREIGN KEY (`seat_id`) REFERENCES `seats` (`seat_id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_show_seats_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`) ON DELETE SET NULL ON UPDATE CASCADE,
    UNIQUE KEY `uk_show_seat` (`show_id`, `seat_id`),
    INDEX `idx_show_seats_booking` (`booking_id`),
    INDEX `idx_show_seats_hold_expiry` (`status`, `hold_expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table: payment_webhooks
-- Audit log for incoming gateway payment notifications.
-- CRITICAL IDEMPOTENCY CONTROL:
-- UNIQUE KEY `uk_payment_txn_event` (`transaction_id`, `event_type`) ensures
-- duplicate payment webhook callbacks from Razorpay/Stripe are safely ignored.
-- ----------------------------------------------------------------------------
CREATE TABLE `payment_webhooks` (
    `webhook_id` BIGINT NOT NULL AUTO_INCREMENT,
    `transaction_id` VARCHAR(100) NOT NULL,
    `booking_id` BIGINT NOT NULL,
    `event_type` VARCHAR(50) NOT NULL,
    `payload_hash` VARCHAR(64) NOT NULL,
    `amount` DECIMAL(10,2) NOT NULL,
    `status` ENUM('PROCESSED', 'FAILED', 'DUPLICATE_IGNORED') NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`webhook_id`),
    CONSTRAINT `fk_webhooks_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY `uk_payment_txn_event` (`transaction_id`, `event_type`),
    INDEX `idx_webhooks_booking` (`booking_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
