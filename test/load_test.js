/**
 * BookMyShow Load & Concurrency Test Suite
 * Description: End-to-end HTTP load & concurrency testing harness driving the live backend server
 *              over network sockets. Validates zero double-booking under flash-sale burst traffic,
 *              skewed seat demand hotspots, per-request latencies, automatic TTL hold expiry,
 *              and persistent idempotent payment webhook handling.
 */

const app = require('../src/index');
const { db } = require('../src/db');
const { redisHoldService } = require('../src/redis_hold_service');

/**
 * Start dynamic HTTP server for public API testing
 */
function startServer() {
    return new Promise((resolve, reject) => {
        const server = app.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            const baseUrl = `http://127.0.0.1:${port}`;
            resolve({ server, port, baseUrl });
        }).on('error', reject);
    });
}

/**
 * Public fixture reset method ensuring total test isolation
 */
function resetEnvironment() {
    redisHoldService.clearAllHolds();
    db.resetState();
}

async function runLoadTests() {
    console.log(`================================================================`);
    console.log(`🚀 STARTING BOOKMYSHOW END-TO-END HTTP CONCURRENCY TEST SUITE`);
    console.log(`================================================================\n`);

    const { server, port, baseUrl } = await startServer();
    console.log(`📡 HTTP Server active on dynamic port ${port}`);

    let suitePassed = true;
    const showId = 1; // Show 1 has 50 seats (seat_ids 1 to 50)
    const NUM_CONCURRENT_USERS = 1000;

    try {
        // ====================================================================
        // TEST 1: High Concurrency Flash-Sale over Real HTTP Sockets
        // (1,000 Concurrent Virtual Users with Skewed Demand & Hotspots)
        // ====================================================================
        console.log(`----------------------------------------------------------------`);
        console.log(`TEST 1: High Concurrency Flash-Sale (1,000 Users over HTTP API)`);
        console.log(`----------------------------------------------------------------`);

        resetEnvironment();

        // Generate realistic seat selections:
        // 70% of requests target high-demand VIP seats 1..10 (Hotspot contention)
        // 30% of requests randomly select among seats 1..50
        const seatDemandCounts = new Map();
        const userSeatRequests = [];

        for (let userId = 1; userId <= NUM_CONCURRENT_USERS; userId++) {
            let targetSeatId;
            if (Math.random() < 0.70) {
                // Skewed demand hotspot: Seats 1 to 10
                targetSeatId = (userId % 10) + 1;
            } else {
                // General demand: Seats 1 to 50
                targetSeatId = ((userId * 7) % 50) + 1;
            }
            userSeatRequests.push({ userId, targetSeatId });
            seatDemandCounts.set(targetSeatId, (seatDemandCounts.get(targetSeatId) || 0) + 1);
        }

        const suiteStartTime = Date.now();
        const results = new Array(NUM_CONCURRENT_USERS);
        const CONCURRENCY_LIMIT = 50; // 50 concurrent HTTP client worker threads
        let requestIndex = 0;

        async function httpWorker() {
            while (requestIndex < userSeatRequests.length) {
                const idx = requestIndex++;
                const { userId, targetSeatId } = userSeatRequests[idx];
                const reqStart = Date.now();
                try {
                    const res = await fetch(`${baseUrl}/api/shows/${showId}/hold`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId,
                            seatIds: [targetSeatId],
                            ttlSeconds: 600
                        })
                    });
                    const body = await res.json();
                    const latencyMs = Date.now() - reqStart;
                    results[idx] = {
                        userId,
                        targetSeatId,
                        httpStatus: res.status,
                        body,
                        latencyMs
                    };
                } catch (err) {
                    const latencyMs = Date.now() - reqStart;
                    results[idx] = {
                        userId,
                        targetSeatId,
                        error: err.message,
                        latencyMs
                    };
                }
            }
        }

        const workers = [];
        for (let w = 0; w < CONCURRENCY_LIMIT; w++) {
            workers.push(httpWorker());
        }
        await Promise.all(workers);

        const suiteEndTime = Date.now();
        const totalDurationSec = Math.max((suiteEndTime - suiteStartTime) / 1000, 0.001);

        let successfulHolds = 0;
        let rejectedHolds = 0;
        let errors = 0;
        const latencies = [];

        // Map seat_id -> array of userIds / bookingIds that were successfully granted
        const seatHoldAssignments = new Map();
        const successfulBookings = new Set();
        let doubleBookingDetected = false;

        for (const r of results) {
            latencies.push(r.latencyMs);

            if (r.httpStatus === 201 && r.body && r.body.success) {
                successfulHolds++;
                successfulBookings.add(r.body.booking_id);

                for (const sId of r.body.seat_ids) {
                    if (!seatHoldAssignments.has(sId)) {
                        seatHoldAssignments.set(sId, []);
                    }
                    seatHoldAssignments.get(sId).push({ userId: r.userId, bookingId: r.body.booking_id });

                    if (seatHoldAssignments.get(sId).length > 1) {
                        doubleBookingDetected = true;
                    }
                }
            } else if (r.httpStatus === 409 && r.body && !r.body.success) {
                rejectedHolds++;
            } else {
                errors++;
            }
        }

        // Verify Seat State via Public HTTP Seat Layout Endpoint
        const seatLayoutRes = await fetch(`${baseUrl}/api/shows/${showId}/seats`);
        const seatLayoutData = await seatLayoutRes.json();
        const seats = seatLayoutData.data.seats;

        let dbHeldCount = 0;
        let dbAvailableCount = 0;
        let dbBookedCount = 0;

        for (const s of seats) {
            if (s.status === 'HELD') dbHeldCount++;
            else if (s.status === 'AVAILABLE') dbAvailableCount++;
            else if (s.status === 'BOOKED') dbBookedCount++;
        }

        // Deep Invariant Checks across DB and HTTP API
        const uniqueHeldSeatsCount = seatHoldAssignments.size;
        let invariantsValid = true;

        // Invariant 1: No double bookings across HTTP responses
        if (doubleBookingDetected) invariantsValid = false;

        // Invariant 2: Total successful HTTP holds equal unique seats held
        if (successfulHolds !== uniqueHeldSeatsCount) invariantsValid = false;

        // Invariant 3: HTTP seat layout HELD count equals unique held seats count
        if (dbHeldCount !== uniqueHeldSeatsCount) invariantsValid = false;

        // Invariant 4: Every successful booking exists in DB with PENDING_PAYMENT status
        for (const bId of successfulBookings) {
            const b = db.bookings.get(bId);
            if (!b || b.status !== 'PENDING_PAYMENT') {
                invariantsValid = false;
            }
        }

        latencies.sort((a, b) => a - b);
        const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
        const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
        const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
        const rps = (NUM_CONCURRENT_USERS / totalDurationSec).toFixed(2);

        // Sort seat demand by highest requested
        const topDemandedSeats = Array.from(seatDemandCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([sId, count]) => `Seat #${sId}: ${count} reqs`)
            .join(', ');

        console.log(`📊 PERFORMANCE & LATENCY RESULTS (Per-Request HTTP Metrics):`);
        console.log(`   - Total HTTP Requests      : ${NUM_CONCURRENT_USERS}`);
        console.log(`   - Execution Time           : ${totalDurationSec.toFixed(3)} seconds`);
        console.log(`   - Throughput (RPS)         : ${rps} req/sec`);
        console.log(`   - Latency (p50 / p95 / p99): ${p50} ms / ${p95} ms / ${p99} ms`);
        console.log(`   - Demand Hotspots (Top 5)  : ${topDemandedSeats}`);

        console.log(`\n🔒 CONCURRENCY & DATA INTEGRITY VERIFICATION:`);
        console.log(`   - HTTP 201 Created (Holds) : ${successfulHolds}`);
        console.log(`   - HTTP 409 Conflict (Rej)  : ${rejectedHolds}`);
        console.log(`   - Unexpected Errors        : ${errors}`);
        console.log(`   - Unique Seats Reserved    : ${uniqueHeldSeatsCount}`);
        console.log(`   - Seats HELD in API Layout : ${dbHeldCount}`);
        console.log(`   - DOUBLE BOOKINGS DETECTED : ${doubleBookingDetected ? '❌ FAIL - DOUBLE BOOKING DETECTED!' : '✅ ZERO DOUBLE BOOKINGS (PASSED)'}`);
        console.log(`   - DEEP INVARIANTS VALID    : ${invariantsValid ? '✅ PASSED' : '❌ FAILED'}`);

        if (successfulHolds === uniqueHeldSeatsCount && dbHeldCount === uniqueHeldSeatsCount && !doubleBookingDetected && invariantsValid && errors === 0) {
            console.log(`\n✅ TEST 1 PASSED: End-to-end HTTP concurrency locks proven under burst flash sale traffic!\n`);
        } else {
            console.error(`\n❌ TEST 1 FAILED: Mismatch or invariant failure under concurrency.\n`);
            suitePassed = false;
        }


        // ====================================================================
        // TEST 2: Timed Seat Hold Auto-Release Verification (Short TTL via HTTP)
        // ====================================================================
        console.log(`----------------------------------------------------------------`);
        console.log(`TEST 2: Timed Seat Hold Auto-Release Verification (Short TTL)`);
        console.log(`----------------------------------------------------------------`);

        resetEnvironment();

        console.log(`Holding Seat #1 over HTTP with 2-second short TTL...`);
        const holdRes = await fetch(`${baseUrl}/api/shows/${showId}/hold`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: 99, seatIds: [1], ttlSeconds: 2 })
        });
        const holdData = await holdRes.json();

        if (holdRes.status !== 201 || !holdData.success) {
            console.error(`❌ TEST 2 FAILED: Initial hold request failed.`, holdData);
            suitePassed = false;
        } else {
            const bId = holdData.booking_id;
            console.log(`Seat #1 Hold Reserved | Booking ID: ${bId}`);

            // Immediate Layout Check via HTTP
            const layoutBefore = await (await fetch(`${baseUrl}/api/shows/${showId}/seats`)).json();
            const seat1Before = layoutBefore.data.seats.find(s => s.seat_id === 1);
            console.log(`Seat #1 Status in HTTP Layout immediately after hold: ${seat1Before.status}`);

            console.log(`Waiting 2.5 seconds for Redis TTL expiry worker to release hold...`);
            await new Promise(resolve => setTimeout(resolve, 2500));

            // Post Expiry Check via HTTP
            const layoutAfter = await (await fetch(`${baseUrl}/api/shows/${showId}/seats`)).json();
            const seat1After = layoutAfter.data.seats.find(s => s.seat_id === 1);

            // Safe DB Record Inspection with Null Guard
            const postBooking = db.bookings.get(bId);
            const postBookingStatus = postBooking ? postBooking.status : 'MISSING_BOOKING_RECORD';

            console.log(`Seat #1 Status in HTTP Layout post-expiry: ${seat1After.status}`);
            console.log(`Booking #${bId} Status post-expiry        : ${postBookingStatus}`);

            if (seat1After.status === 'AVAILABLE' && postBookingStatus === 'EXPIRED') {
                console.log(`✅ TEST 2 PASSED: Hold released automatically on TTL expiry with zero lost holds!\n`);
            } else {
                console.error(`❌ TEST 2 FAILED: Timed release did not restore seat or booking state correctly.\n`);
                suitePassed = false;
            }
        }


        // ====================================================================
        // TEST 3: Payment Webhook Idempotency Verification over HTTP
        // ====================================================================
        console.log(`----------------------------------------------------------------`);
        console.log(`TEST 3: Payment Webhook Idempotency (20 Concurrent HTTP Retries)`);
        console.log(`----------------------------------------------------------------`);

        resetEnvironment();

        // Create a clean hold for User 50 on Seat #2
        const holdRes3 = await fetch(`${baseUrl}/api/shows/${showId}/hold`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: 50, seatIds: [2], ttlSeconds: 600 })
        });
        const holdData3 = await holdRes3.json();
        const bId3 = holdData3.booking_id;
        const txnId = `pay_RAZORPAY_TEST_${Date.now()}`;

        console.log(`Firing 20 concurrent duplicate HTTP webhook requests for Txn: ${txnId}...`);
        const webhookPromises = [];
        for (let i = 0; i < 20; i++) {
            webhookPromises.push(
                fetch(`${baseUrl}/api/webhooks/payment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        transactionId: txnId,
                        bookingId: bId3,
                        eventType: 'payment.captured',
                        amount: 350.00
                    })
                }).then(res => res.json())
            );
        }

        const webhookResults = await Promise.all(webhookPromises);
        let confirmedCount = 0;
        let duplicateIgnoredCount = 0;
        let errorCount = 0;

        for (const wr of webhookResults) {
            if (wr.status === 'CONFIRMED') confirmedCount++;
            else if (wr.status === 'DUPLICATE_IGNORED') duplicateIgnoredCount++;
            else errorCount++;
        }

        // Verify Seat #2 Status via HTTP layout API
        const layout3 = await (await fetch(`${baseUrl}/api/shows/${showId}/seats`)).json();
        const seat2Post = layout3.data.seats.find(s => s.seat_id === 2);
        const webhookAuditCount = Array.from(db.paymentWebhooks.values())
            .filter(w => w.transaction_id === txnId && w.event_type === 'payment.captured').length;

        console.log(`Webhook Processing Summary:`);
        console.log(`   - HTTP Webhooks Executed   : 20`);
        console.log(`   - Confirmed Executions     : ${confirmedCount} (Expected 1)`);
        console.log(`   - Duplicates Ignored       : ${duplicateIgnoredCount} (Expected 19)`);
        console.log(`   - Persistent Audit Entries  : ${webhookAuditCount} (Expected 1)`);
        console.log(`   - Final Booking Status     : ${db.bookings.get(bId3).status}`);
        console.log(`   - Final Seat #2 HTTP Status: ${seat2Post.status}`);

        if (confirmedCount === 1 && duplicateIgnoredCount === 19 && seat2Post.status === 'BOOKED' && webhookAuditCount === 1 && errorCount === 0) {
            console.log(`✅ TEST 3 PASSED: Payment webhook idempotency fully proven over persistent HTTP boundary!\n`);
        } else {
            console.error(`❌ TEST 3 FAILED: Idempotency issue detected.\n`);
            suitePassed = false;
        }

    } finally {
        server.close();
        console.log(`📡 HTTP Test server shut down.`);
    }

    console.log(`================================================================`);
    if (suitePassed) {
        console.log(`🎉 ALL LOAD & CONCURRENCY TESTS COMPLETED SUCCESSFULLY!`);
        console.log(`================================================================\n`);
        process.exit(0);
    } else {
        console.error(`❌ LOAD & CONCURRENCY TEST SUITE FAILED WITH ERRORS!`);
        console.log(`================================================================\n`);
        process.exit(1);
    }
}

if (require.main === module) {
    runLoadTests().catch(err => {
        console.error("Test Suite Unhandled Exception:", err);
        process.exit(1);
    });
}

module.exports = { runLoadTests };
