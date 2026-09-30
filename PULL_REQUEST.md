# Pull Request: BookMyShow-Scale High Concurrency Ticketing Backend

## 📌 Feature Overview
This Pull Request implements a complete **BookMyShow-scale ticketing backend system design, database schema, concurrency locking architecture, executable SQL queries, and load testing harness**.

It satisfies all requirements for **Task P1** (Entity modeling, 1NF to BCNF normalization proofs, schema creation DDL, sample seed DML, pessimistic/optimistic/Redis locking analysis, payment idempotency) and **Task P2** (Per-theatre per-date showtimes listing with JSON aggregated output & EXPLAIN index optimization).

---

## 🛠 Deliverables Included
1. **PDF System Design Document**: `docs/BookMyShow_Backend_System_Design.pdf`
2. **Markdown System Design Document**: `docs/BookMyShow_Backend_System_Design.md`
3. **Task P1 & P2 Executable MySQL SQL Scripts**:
   - `sql/01_schema.sql` — MySQL 8.0 DDL (10 normalized tables, foreign keys, unique locks, composite indexes)
   - `sql/02_sample_data.sql` — MySQL 8.0 DML seed script (Cities, Theatres, Screens, Seats, Movies, 7-Day Shows, Users, ShowSeats)
   - `sql/03_queries.sql` — Task P1 summaries & Task P2 per-theatre per-date showtimes query with EXPLAIN plan
4. **Runnable Backend API Application**:
   - `src/index.js` — Express API Server
   - `src/redis_hold_service.js` — Redis 2-Phase Timed Seat Hold Service with TTL expiry worker
   - `src/payment_webhook_service.js` — Idempotent Payment Webhook Service (`UNIQUE(transaction_id, event_type)`)
   - `src/show_service.js` — Task P2 showtimes query & seat layout service
5. **High Concurrency Load Test Suite**:
   - `test/load_test.js` — Simulates 1,000 concurrent requests competing for 50 seats in a flash-sale scenario.

---

## 🧪 Verification & Load Test Results

Running `npm test` yields the following verified output:

```
================================================================
🚀 STARTING BOOKMYSHOW END-TO-END HTTP CONCURRENCY TEST SUITE
================================================================

📡 HTTP Server active on dynamic port 55182
----------------------------------------------------------------
TEST 1: High Concurrency Flash-Sale (1,000 Users over HTTP API)
----------------------------------------------------------------
📊 PERFORMANCE & LATENCY RESULTS (Per-Request HTTP Metrics):
   - Total HTTP Requests      : 1,000
   - Execution Time           : 0.839 seconds
   - Throughput (RPS)         : 1,191.90 req/sec
   - Latency (p50 / p95 / p99): 28 ms / 152 ms / 396 ms
   - Demand Hotspots (Top 5)  : Seat #8: 82 reqs, Seat #9: 81 reqs, Seat #6: 79 reqs...

🔒 CONCURRENCY & DATA INTEGRITY VERIFICATION:
   - HTTP 201 Created (Holds) : 50 (Expected 50)
   - HTTP 409 Conflict (Rej)  : 950 (Expected 950)
   - Unexpected Errors        : 0
   - Unique Seats Reserved    : 50
   - Seats HELD in API Layout : 50
   - DOUBLE BOOKINGS DETECTED : ✅ ZERO DOUBLE BOOKINGS (PASSED)
   - DEEP INVARIANTS VALID    : ✅ PASSED

TEST 2: Timed Seat Hold Auto-Release Verification (Short TTL)
   - Reverted seat state back to AVAILABLE on timer expiry cleanly via HTTP layout.
   - ✅ TEST 2 PASSED: Hold released automatically on TTL expiry with zero lost holds!

TEST 3: Payment Webhook Idempotency Verification (20 Concurrent HTTP Retries)
   - HTTP Webhooks Executed   : 20
   - Confirmed Executions     : 1 (Expected 1)
   - Duplicates Ignored       : 19 (Expected 19)
   - Persistent Audit Entries  : 1 (Expected 1)
   - ✅ TEST 3 PASSED: Payment webhook idempotency fully proven over persistent HTTP boundary!
```

---

## 🚀 How to Run Locally

### 1. Execute Load & Concurrency Tests
```bash
npm install
npm test
```

### 2. Run API Server
```bash
npm start
```
- P2 Showtimes API: `http://localhost:3000/api/theatres/1/shows`
- Seat Layout API: `http://localhost:3000/api/shows/1/seats`

---
