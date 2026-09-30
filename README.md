# BookMyShow High-Concurrency Ticketing Backend System

A BookMyShow-scale ticketing backend system design and implementation built to handle thousands of users competing simultaneously for movie seat inventory. Features seat-level locking to prevent double-booking, automatic timed seat holds with Redis TTL expiration, idempotent payment webhook handling, and comprehensive database normalization (1NF to BCNF).

---

## 📁 Repository Directory Structure

```
BookMyShow/
├── README.md                          # Main project overview & documentation
├── PULL_REQUEST.md                    # Detailed GitHub Pull Request description
├── docs/
│   ├── BookMyShow_Backend_System_Design.md   # System Design Markdown Doc (P1, P2, Normalization, Load Test)
│   └── BookMyShow_Backend_System_Design.pdf  # Publication-grade PDF Report Deliverable
├── sql/
│   ├── 01_schema.sql                  # MySQL 8.0 DDL (10 normalized tables, FKs, unique locks, indexes)
│   ├── 02_sample_data.sql             # MySQL 8.0 DML seed script (7-day showtimes schedule)
│   └── 03_queries.sql                 # Tasks P1 & P2 MySQL solutions + EXPLAIN query plan
├── src/
│   ├── index.js                       # Express HTTP API Gateway Server
│   ├── db.js                          # Database Engine & Seed Data Provider
│   ├── redis_hold_service.js          # Redis 2-Phase Timed Seat Hold & Atomic Locking Service
│   ├── payment_webhook_service.js     # Idempotent Payment Webhook Processor
│   └── show_service.js                # Task P2 Query Engine & Showtimes Aggregator
├── test/
│   └── load_test.js                   # High-concurrency simulation suite (1,000 requests for 50 seats)
└── package.json                       # Node.js project manifest & dependencies
```

---

## 🎯 Key Task Solutions

### Task P1: Entities, Table Schema & Concurrency Locks
- **10 Normalized Relational Tables**: `cities`, `theatres`, `screens`, `seats`, `movies`, `shows`, `users`, `bookings`, `show_seats`, `payment_webhooks`.
- **Normalization Verification**: Rigorous mathematical proof confirming compliance with 1NF, 2NF, 3NF, and BCNF standards.
- **Concurrency Architecture**:
  - **Pessimistic vs Optimistic Locking**: Comparative trade-off analysis matrix.
  - **Redis 2-Phase Timed Seat Hold Protocol**: In-memory atomic SETNX lock + 600s TTL expiry worker.
  - **Hard Database Safety**: `UNIQUE KEY (show_id, seat_id)` physically prevents double-booking even if application cache fails.
  - **Idempotent Webhooks**: Unique constraint `UNIQUE (transaction_id, event_type)` ensures network retries cause zero duplicate updates.
  - **End-to-End HTTP Load & Concurrency Harness**: Dynamic HTTP server load runner with realistic skewed seat choices (hotspot contention), per-request latencies, setup/teardown state isolation, and machine-verifiable exit codes.

### Task P2: Per-Theatre Per-Date Showtimes Query
- Executable MySQL query retrieving all scheduled shows for a target theatre on a specific date (e.g. today or next 7 days).
- Uses SARGable range scan on `start_time` leveraging composite B-Tree index `(screen_id, start_time)`.
- Aggregates showtimes into JSON arrays matching the official BookMyShow date-picker UI layout.

---

## ⚡ Quick Start & Verification

### 1. Run Load & Concurrency Tests
```bash
npm install
npm test
```

### 2. Launch Express Backend Server
```bash
npm start
```

### 3. API Endpoints
- **Task P2 Showtimes**: `GET http://localhost:3000/api/theatres/1/shows?date=2026-09-30`
- **Seat Map Layout**: `GET http://localhost:3000/api/shows/1/seats`
- **Reserve Timed Hold**: `POST http://localhost:3000/api/shows/1/hold`
- **Idempotent Payment Webhook**: `POST http://localhost:3000/api/webhooks/payment`

---

## 📄 PDF Deliverable
The primary deliverable `docs/BookMyShow_Backend_System_Design.pdf` is located in the `docs/` folder.
