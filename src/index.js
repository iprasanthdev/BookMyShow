/**
 * BookMyShow High-Concurrency Ticketing Backend API
 */

const express = require('express');
const { showService } = require('./show_service');
const { redisHoldService } = require('./redis_hold_service');
const { paymentWebhookService } = require('./payment_webhook_service');

const app = express();
app.use(express.json());

// ----------------------------------------------------------------------------
// Task P2 API: List all shows on a given date at a given theatre
// GET /api/theatres/:theatreId/shows?date=YYYY-MM-DD
// ----------------------------------------------------------------------------
app.get('/api/theatres/:theatreId/shows', (req, res) => {
    try {
        const { theatreId } = req.params;
        const { date } = req.query;

        const data = showService.getShowsByTheatreAndDate(theatreId, date);
        return res.status(200).json({
            success: true,
            data: data
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/shows/:showId/seats - Get seat map layout
app.get('/api/shows/:showId/seats', (req, res) => {
    try {
        const { showId } = req.params;
        const layout = showService.getShowSeatLayout(showId);
        if (!layout) {
            return res.status(404).json({ success: false, error: 'Show not found' });
        }
        return res.status(200).json({ success: true, data: layout });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ----------------------------------------------------------------------------
// Timed Seat Hold API (Redis Atomic Lock)
// POST /api/shows/:showId/hold
// Body: { userId: 1, seatIds: [1, 2], ttlSeconds: 600 }
// ----------------------------------------------------------------------------
app.post('/api/shows/:showId/hold', async (req, res) => {
    try {
        const { showId } = req.params;
        const { userId, seatIds, ttlSeconds } = req.body;

        if (!userId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid parameters. Require userId and seatIds array.'
            });
        }

        const result = await redisHoldService.holdSeats(showId, seatIds, userId, ttlSeconds || 600);

        if (!result.success) {
            return res.status(409).json(result); // 409 Conflict: Double-booking / Hold rejection
        }

        return res.status(201).json(result);
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ----------------------------------------------------------------------------
// Idempotent Payment Webhook API
// POST /api/webhooks/payment
// Body: { transactionId: "pay_123", bookingId: 1, eventType: "payment.captured", amount: 1050 }
// ----------------------------------------------------------------------------
app.post('/api/webhooks/payment', async (req, res) => {
    try {
        const { transactionId, bookingId, eventType, amount } = req.body;

        if (!transactionId || !bookingId || !eventType) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: transactionId, bookingId, eventType.'
            });
        }

        const result = await paymentWebhookService.processWebhook(
            transactionId, bookingId, eventType, amount || 0
        );

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`BookMyShow Concurrency Backend Running on port ${PORT}`);
        console.log(`P2 API: http://localhost:${PORT}/api/theatres/1/shows`);
        console.log(`=======================================================`);
    });
}

module.exports = app;
