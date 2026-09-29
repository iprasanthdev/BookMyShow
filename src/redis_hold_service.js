/**
 * Redis Timed Seat Hold & Atomic Locking Service
 * Description: Prevents double-booking under high concurrency using atomic Redis locks,
 *              TTL seat holds, and automatic background expiry timers.
 */

const { db } = require('./db');

class RedisHoldService {
    constructor() {
        // In-Memory Redis Mock Store simulating Redis Key-Value TTL engine
        this.redisStore = new Map();
        this.timers = new Map();

        // Start background hold expiry worker running every 1000ms
        this.startExpiryWorker();
    }

    /**
     * Atomically hold requested seats for a show.
     * @param {number} showId 
     * @param {Array<number>} seatIds 
     * @param {number} userId 
     * @param {number} ttlSeconds 
     */
    async holdSeats(showId, seatIds, userId, ttlSeconds = 600) {
        showId = Number(showId);
        userId = Number(userId);
        seatIds = seatIds.map(Number);

        // 1. Check if show exists
        const show = db.shows.get(showId);
        if (!show) {
            throw new Error(`Show ID ${showId} not found`);
        }

        // 2. ATOMIC REDIS LOCK CHECK: Acquire locks for ALL requested seats
        const acquiredKeys = [];
        let lockFailed = false;
        let failedSeatId = null;

        for (const sId of seatIds) {
            const redisKey = `bms:hold:show:${showId}:seat:${sId}`;
            const existingHold = this.redisStore.get(redisKey);

            // Also check DB status
            const showSeatKey = `${showId}_${sId}`;
            const dbShowSeat = db.showSeats.get(showSeatKey);

            if (existingHold || !dbShowSeat || dbShowSeat.status !== 'AVAILABLE') {
                lockFailed = true;
                failedSeatId = sId;
                break;
            }

            // Provisionally place lock in Redis
            this.redisStore.set(redisKey, {
                userId,
                showId,
                seatId: sId,
                acquiredAt: Date.now(),
                ttlMs: ttlSeconds * 1000
            });
            acquiredKeys.push(redisKey);
        }

        // Rollback atomic lock if any seat lock failed
        if (lockFailed) {
            for (const key of acquiredKeys) {
                this.redisStore.delete(key);
            }
            return {
                success: false,
                code: 'SEAT_UNAVAILABLE',
                message: `Seat ID ${failedSeatId} is already held or booked.`,
                seatId: failedSeatId
            };
        }

        // 3. Create Booking Record in Database
        const bookingId = db.autoIds.booking++;
        const bookingRef = `BK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

        let totalAmount = 0;
        for (const sId of seatIds) {
            const showSeatKey = `${showId}_${sId}`;
            const ss = db.showSeats.get(showSeatKey);
            totalAmount += ss.price;

            // Transition DB state: AVAILABLE -> HELD
            ss.status = 'HELD';
            ss.booking_id = bookingId;
            ss.hold_expires_at = expiresAt.toISOString();
            ss.version += 1;
        }

        const booking = {
            booking_id: bookingId,
            booking_ref: bookingRef,
            user_id: userId,
            show_id: showId,
            seat_ids: seatIds,
            total_amount: Math.round(totalAmount * 100) / 100,
            status: 'PENDING_PAYMENT',
            idempotency_key: `IDEMP-HOLD-${bookingId}-${Date.now()}`,
            hold_expires_at: expiresAt.toISOString(),
            created_at: new Date().toISOString()
        };

        db.bookings.set(bookingId, booking);

        // 4. Attach Redis TTL Timer for automatic hold release
        const timerId = setTimeout(() => {
            this.releaseHoldIfExpired(bookingId);
        }, ttlSeconds * 1000);
        this.timers.set(bookingId, timerId);

        return {
            success: true,
            booking_id: bookingId,
            booking_ref: bookingRef,
            show_id: showId,
            seat_ids: seatIds,
            total_amount: booking.total_amount,
            status: booking.status,
            hold_expires_at: booking.hold_expires_at
        };
    }

    /**
     * Releasing seat hold if expired without payment confirmation
     */
    releaseHoldIfExpired(bookingId) {
        const booking = db.bookings.get(bookingId);
        if (!booking || booking.status !== 'PENDING_PAYMENT') {
            return; // Booking already confirmed or cancelled
        }

        console.log(`[RedisHoldService] Hold EXPIRED for Booking #${bookingId} (${booking.booking_ref}). Releasing seats...`);

        // Update Booking Status to EXPIRED
        booking.status = 'EXPIRED';

        // Revert show seats state back to AVAILABLE
        for (const sId of booking.seat_ids) {
            const redisKey = `bms:hold:show:${booking.show_id}:seat:${sId}`;
            this.redisStore.delete(redisKey);

            const showSeatKey = `${booking.show_id}_${sId}`;
            const ss = db.showSeats.get(showSeatKey);
            if (ss && ss.booking_id === bookingId && ss.status === 'HELD') {
                ss.status = 'AVAILABLE';
                ss.booking_id = null;
                ss.hold_expires_at = null;
                ss.version += 1;
            }
        }
    }

    /**
     * Background periodic expiry worker
     */
    startExpiryWorker() {
        setInterval(() => {
            const now = new Date();
            for (const booking of db.bookings.values()) {
                if (booking.status === 'PENDING_PAYMENT') {
                    const expiry = new Date(booking.hold_expires_at);
                    if (now > expiry) {
                        this.releaseHoldIfExpired(booking.booking_id);
                    }
                }
            }
        }, 1000);
    }
}

const redisHoldService = new RedisHoldService();

module.exports = {
    redisHoldService
};
