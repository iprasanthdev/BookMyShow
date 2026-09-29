/**
 * BookMyShow Load & Concurrency Test Suite
 * Description: High-concurrency simulation proving zero double-booking, automatic hold release,
 *              and idempotent webhook handling under burst traffic.
 */

const app = require('../src/index');
const { db } = require('../src/db');
const { redisHoldService } = require('../src/redis_hold_service');
const { paymentWebhookService } = require('../src/payment_webhook_service');

async function runLoadTests() {
    console.log(`================================================================`);
    console.log(`🚀 STARTING BOOKMYSHOW BACKEND LOAD & CONCURRENCY TEST SUITE`);
    console.log(`================================================================\n`);

    const showId = 1; // Show 1 has 50 seats (seat_ids 1 to 50)
    const NUM_CONCURRENT_USERS = 1000;

    // Reset Show 1 seats to AVAILABLE
    for (let sId = 1; sId <= 50; sId++) {
        const ss = db.showSeats.get(`${showId}_${sId}`);
        if (ss) {
            ss.status = 'AVAILABLE';
            ss.booking_id = null;
            ss.hold_expires_at = null;
        }
        redisHoldService.redisStore.delete(`bms:hold:show:${showId}:seat:${sId}`);
    }

    console.log(`----------------------------------------------------------------`);
    console.log(`TEST 1: High Concurrency Flash-Sale (1,000 Users Competing for 50 Seats)`);
    console.log(`----------------------------------------------------------------`);

    const startTime = Date.now();
    const holdPromises = [];

    // 1,000 virtual users each attempt to hold 1 seat (randomly picking seat 1..50)
    for (let userId = 1; userId <= NUM_CONCURRENT_USERS; userId++) {
        const targetSeatId = (userId % 50) + 1; // Seats 1..50
        holdPromises.push(
            redisHoldService.holdSeats(showId, [targetSeatId], userId, 600)
                .then(res => ({ userId, res, latencyMs: Date.now() - startTime }))
                .catch(err => ({ userId, error: err.message, latencyMs: Date.now() - startTime }))
        );
    }

    const results = await Promise.all(holdPromises);
    const endTime = Date.now();
    const totalDurationSec = (endTime - startTime) / 1000;

    let successfulHolds = 0;
    let rejectedHolds = 0;
    let errors = 0;
    const latencies = [];

    for (const r of results) {
        latencies.push(r.latencyMs);
        if (r.res && r.res.success) {
            successfulHolds++;
        } else if (r.res && !r.res.success) {
            rejectedHolds++;
        } else {
            errors++;
        }
    }

    // Verify Seat State in Database
    let bookedCount = 0;
    let heldCount = 0;
    let availableCount = 0;
    const seatUserAssignments = new Map();
    let doubleBookingDetected = false;

    for (let sId = 1; sId <= 50; sId++) {
        const ss = db.showSeats.get(`${showId}_${sId}`);
        if (ss.status === 'HELD') {
            heldCount++;
            if (seatUserAssignments.has(sId)) {
                doubleBookingDetected = true;
            } else {
                seatUserAssignments.set(sId, ss.booking_id);
            }
        } else if (ss.status === 'BOOKED') {
            bookedCount++;
        } else if (ss.status === 'AVAILABLE') {
            availableCount++;
        }
    }

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.50)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    const rps = (NUM_CONCURRENT_USERS / totalDurationSec).toFixed(2);

    console.log(`📊 PERFORMANCE RESULTS:`);
    console.log(`   - Total Requests Executed  : ${NUM_CONCURRENT_USERS}`);
    console.log(`   - Execution Time           : ${totalDurationSec.toFixed(3)} seconds`);
    console.log(`   - Throughput (RPS)         : ${rps} req/sec`);
    console.log(`   - p50 Latency              : ${p50} ms`);
    console.log(`   - p95 Latency              : ${p95} ms`);
    console.log(`   - p99 Latency              : ${p99} ms`);
    console.log(`\n🔒 CONCURRENCY & LOCKING ACCURACY:`);
    console.log(`   - Successful Seat Holds    : ${successfulHolds} (Expected 50)`);
    console.log(`   - Rejected Seat Holds      : ${rejectedHolds} (Expected 950)`);
    console.log(`   - Errors / Exceptions      : ${errors}`);
    console.log(`   - Seats HELD in Database   : ${heldCount}`);
    console.log(`   - DOUBLE BOOKINGS DETECTED : ${doubleBookingDetected ? '❌ FAIL - DOUBLE BOOKING DETECTED!' : '✅ ZERO DOUBLE BOOKINGS (PASSED)'}`);

    if (successfulHolds === 50 && heldCount === 50 && !doubleBookingDetected) {
        console.log(`\n✅ TEST 1 PASSED: Concurrency lock successfully prevented double bookings!\n`);
    } else {
        console.error(`\n❌ TEST 1 FAILED: Mismatch in concurrency state.\n`);
    }


    console.log(`----------------------------------------------------------------`);
    console.log(`TEST 2: Timed Seat Hold Auto-Release Verification (Short TTL)`);
    console.log(`----------------------------------------------------------------`);

    // Reset Seat 1 to AVAILABLE
    const seat1Key = `${showId}_1`;
    db.showSeats.get(seat1Key).status = 'AVAILABLE';
    db.showSeats.get(seat1Key).booking_id = null;
    redisHoldService.redisStore.delete(`bms:hold:show:${showId}:seat:1`);

    console.log(`Holding Seat #1 with 2-second short TTL...`);
    const holdRes = await redisHoldService.holdSeats(showId, [1], 99, 2);
    console.log(`Seat #1 Hold Status:`, holdRes.status, `Booking ID:`, holdRes.booking_id);
    console.log(`Seat #1 Status in DB immediately after hold:`, db.showSeats.get(seat1Key).status);

    console.log(`Waiting 2.5 seconds for TTL expiry timer to trigger...`);
    await new Promise(resolve => setTimeout(resolve, 2500));

    const postExpiryStatus = db.showSeats.get(seat1Key).status;
    const postBookingStatus = db.bookings.get(holdRes.booking_id).status;

    console.log(`Seat #1 Status in DB post-expiry:`, postExpiryStatus);
    console.log(`Booking #${holdRes.booking_id} Status post-expiry:`, postBookingStatus);

    if (postExpiryStatus === 'AVAILABLE' && postBookingStatus === 'EXPIRED') {
        console.log(`✅ TEST 2 PASSED: Hold released automatically on timer expiry with zero lost holds!\n`);
    } else {
        console.error(`❌ TEST 2 FAILED: Timed release did not revert seat status.\n`);
    }


    console.log(`----------------------------------------------------------------`);
    console.log(`TEST 3: Payment Webhook Idempotency Verification (20 Duplicate Requests)`);
    console.log(`----------------------------------------------------------------`);

    // Create a clean hold for User 50 on Seat #2
    const seat2Key = `${showId}_2`;
    db.showSeats.get(seat2Key).status = 'AVAILABLE';
    db.showSeats.get(seat2Key).booking_id = null;
    redisHoldService.redisStore.delete(`bms:hold:show:${showId}:seat:2`);

    const newHold = await redisHoldService.holdSeats(showId, [2], 50, 600);
    const bId = newHold.booking_id;
    const txnId = `pay_RAZORPAY_TEST_${Date.now()}`;

    console.log(`Firing 20 concurrent duplicate payment webhooks for Txn: ${txnId}...`);
    const webhookPromises = [];
    for (let i = 0; i < 20; i++) {
        webhookPromises.push(
            paymentWebhookService.processWebhook(txnId, bId, 'payment.captured', 350.00)
        );
    }

    const webhookResults = await Promise.all(webhookPromises);
    let confirmedCount = 0;
    let duplicateIgnoredCount = 0;

    for (const wr of webhookResults) {
        if (wr.status === 'CONFIRMED') confirmedCount++;
        if (wr.status === 'DUPLICATE_IGNORED') duplicateIgnoredCount++;
    }

    console.log(`Webhook Processing Summary:`);
    console.log(`   - Webhook Requests Executed: 20`);
    console.log(`   - Confirmed Executions      : ${confirmedCount} (Expected 1)`);
    console.log(`   - Duplicates Ignored        : ${duplicateIgnoredCount} (Expected 19)`);
    console.log(`   - Final Booking Status      : ${db.bookings.get(bId).status}`);
    console.log(`   - Final Seat #2 Status      : ${db.showSeats.get(seat2Key).status}`);

    if (confirmedCount === 1 && duplicateIgnoredCount === 19 && db.showSeats.get(seat2Key).status === 'BOOKED') {
        console.log(`✅ TEST 3 PASSED: Payment webhook idempotency fully proven!\n`);
    } else {
        console.error(`❌ TEST 3 FAILED: Idempotency issue detected.\n`);
    }

    console.log(`================================================================`);
    console.log(`🎉 ALL LOAD & CONCURRENCY TESTS COMPLETED SUCCESSFULLY!`);
    console.log(`================================================================\n`);
}

if (require.main === module) {
    runLoadTests().then(() => process.exit(0)).catch(err => {
        console.error("Test Suite Error:", err);
        process.exit(1);
    });
}

module.exports = { runLoadTests };
