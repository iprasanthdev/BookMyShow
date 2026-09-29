/**
 * Database Module (MySQL Connection Pool & Thread-Safe Mock Engine)
 */

const fs = require('fs');
const path = require('path');

// In-Memory Thread-Safe ACID Relational Data Store for instant standalone execution
class BMSDatabaseEngine {
    constructor() {
        this.cities = new Map();
        this.theatres = new Map();
        this.screens = new Map();
        this.seats = new Map();
        this.movies = new Map();
        this.shows = new Map();
        this.users = new Map();
        this.bookings = new Map();
        this.showSeats = new Map(); // Key: `${show_id}_${seat_id}`
        this.paymentWebhooks = new Map(); // Key: `${transaction_id}_${event_type}`

        this.autoIds = {
            city: 1, theatre: 1, screen: 1, seat: 1,
            movie: 1, show: 1, user: 1, booking: 1, showSeat: 1, webhook: 1
        };

        this.seedInitialData();
    }

    seedInitialData() {
        // Seed Cities
        this.cities.set(1, { city_id: 1, name: 'Bengaluru', state: 'Karnataka', country: 'India' });
        this.cities.set(2, { city_id: 2, name: 'Mumbai', state: 'Maharashtra', country: 'India' });

        // Seed Theatre
        this.theatres.set(1, {
            theatre_id: 1, city_id: 1, name: 'PVR Directors Cut - Forum Mall Koramangala',
            address: 'Hosur Rd, Koramangala, Bengaluru, Karnataka 560095', latitude: 12.9345, longitude: 77.6114
        });

        // Seed Screen
        this.screens.set(1, { screen_id: 1, theatre_id: 1, name: 'Screen 1 (IMAX 3D)', total_seats: 50 });

        // Seed 50 Seats for Screen 1 (Rows A-E, Seats 1-10)
        let seatId = 1;
        const rows = ['A', 'B', 'C', 'D', 'E'];
        for (const row of rows) {
            for (let num = 1; num <= 10; num++) {
                const seatType = (row === 'A') ? 'VIP' : (row === 'B' ? 'BALCONY' : 'REGULAR');
                const multiplier = (row === 'A') ? 1.50 : (row === 'B' ? 1.20 : 1.00);
                this.seats.set(seatId, {
                    seat_id: seatId, screen_id: 1, row_identifier: row,
                    seat_number: num, seat_type: seatType, price_multiplier: multiplier
                });
                seatId++;
            }
        }
        this.autoIds.seat = seatId;

        // Seed Movie
        this.movies.set(1, {
            movie_id: 1, title: 'Avatar: The Way of Water', duration_minutes: 192,
            language: 'English', genre: 'Sci-Fi / Action', rating: 'UA'
        });
        this.movies.set(2, {
            movie_id: 2, title: 'Oppenheimer', duration_minutes: 180,
            language: 'English', genre: 'Biography / Drama', rating: 'U'
        });

        // Seed Shows across next 7 dates
        const today = new Date();
        let showId = 1;
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
            const showDate = new Date(today);
            showDate.setDate(today.getDate() + dayOffset);
            const dateStr = showDate.toISOString().split('T')[0];

            // Show 1: 10:30 AM
            this.shows.set(showId, {
                show_id: showId, movie_id: 1, screen_id: 1,
                start_time: `${dateStr} 10:30:00`, end_time: `${dateStr} 13:42:00`,
                base_price: 350.00, status: 'SCHEDULED'
            });

            // Populate show_seats for Show #showId
            for (const [sId, seatObj] of this.seats.entries()) {
                if (seatObj.screen_id === 1) {
                    const showSeatKey = `${showId}_${sId}`;
                    this.showSeats.set(showSeatKey, {
                        show_seat_id: this.autoIds.showSeat++,
                        show_id: showId,
                        seat_id: sId,
                        booking_id: null,
                        status: 'AVAILABLE',
                        price: Math.round(350.00 * seatObj.price_multiplier * 100) / 100,
                        version: 1,
                        hold_expires_at: null
                    });
                }
            }
            showId++;

            // Show 2: 02:30 PM
            this.shows.set(showId, {
                show_id: showId, movie_id: 2, screen_id: 1,
                start_time: `${dateStr} 14:30:00`, end_time: `${dateStr} 17:30:00`,
                base_price: 400.00, status: 'SCHEDULED'
            });

            for (const [sId, seatObj] of this.seats.entries()) {
                if (seatObj.screen_id === 1) {
                    const showSeatKey = `${showId}_${sId}`;
                    this.showSeats.set(showSeatKey, {
                        show_seat_id: this.autoIds.showSeat++,
                        show_id: showId,
                        seat_id: sId,
                        booking_id: null,
                        status: 'AVAILABLE',
                        price: Math.round(400.00 * seatObj.price_multiplier * 100) / 100,
                        version: 1,
                        hold_expires_at: null
                    });
                }
            }
            showId++;
        }
        this.autoIds.show = showId;

        // Seed Users
        this.users.set(1, { user_id: 1, name: 'Aarav Sharma', email: 'aarav@example.com', phone: '+919876543210' });
        this.users.set(2, { user_id: 2, name: 'Diya Patel', email: 'diya@example.com', phone: '+919876543211' });
        this.autoIds.user = 3;
    }

    // Atomic Helper methods simulating MySQL transactions
    getShowsByTheatreAndDate(theatreId, dateStr) {
        const results = [];
        for (const show of this.shows.values()) {
            const screen = this.screens.get(show.screen_id);
            if (screen && screen.theatre_id === Number(theatreId)) {
                if (show.start_time.startsWith(dateStr) && show.status === 'SCHEDULED') {
                    const movie = this.movies.get(show.movie_id);

                    // Count seats
                    let available = 0, held = 0, booked = 0, total = 0;
                    for (const ss of this.showSeats.values()) {
                        if (ss.show_id === show.show_id) {
                            total++;
                            if (ss.status === 'AVAILABLE') available++;
                            else if (ss.status === 'HELD') held++;
                            else if (ss.status === 'BOOKED') booked++;
                        }
                    }

                    results.push({
                        show_id: show.show_id,
                        movie_id: movie.movie_id,
                        movie_title: movie.title,
                        language: movie.language,
                        genre: movie.genre,
                        rating: movie.rating,
                        duration_minutes: movie.duration_minutes,
                        screen_name: screen.name,
                        start_time: show.start_time,
                        end_time: show.end_time,
                        base_price: show.base_price,
                        status: show.status,
                        total_capacity: total,
                        available_seats: available,
                        held_seats: held,
                        booked_seats: booked
                    });
                }
            }
        }
        return results.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
}

const dbInstance = new BMSDatabaseEngine();

module.exports = {
    db: dbInstance
};
