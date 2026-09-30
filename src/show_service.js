/**
 * Show Service (Task P2 Implementation)
 * Description: High-performance retrieval of shows for a given theatre and date.
 */

const { db } = require('./db');

class ShowService {
    /**
     * Get all shows running at a specific theatre on a given date. (Task P2 Query)
     * @param {number} theatreId 
     * @param {string} dateStr Format: YYYY-MM-DD
     */
    getShowsByTheatreAndDate(theatreId, dateStr) {
        theatreId = Number(theatreId);
        if (!dateStr) {
            dateStr = new Date().toISOString().split('T')[0];
        }

        const showsList = db.getShowsByTheatreAndDate(theatreId, dateStr);

        // Group by movie (Matching BookMyShow UI layout)
        const movieMap = new Map();
        for (const show of showsList) {
            if (!movieMap.has(show.movie_id)) {
                movieMap.set(show.movie_id, {
                    movie_id: show.movie_id,
                    title: show.movie_title,
                    language: show.language,
                    genre: show.genre,
                    rating: show.rating,
                    duration_minutes: show.duration_minutes,
                    shows: []
                });
            }

            const startTimeObj = new Date(show.start_time);
            const formattedStartTime = startTimeObj.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });

            movieMap.get(show.movie_id).shows.push({
                show_id: show.show_id,
                screen_name: show.screen_name,
                start_time: show.start_time,
                start_time_formatted: formattedStartTime,
                base_price: show.base_price,
                total_capacity: show.total_capacity,
                available_seats: show.available_seats,
                held_seats: show.held_seats,
                booked_seats: show.booked_seats,
                status: show.status
            });
        }

        const theatre = db.theatres.get(theatreId);

        return {
            theatre_id: theatreId,
            theatre_name: theatre ? theatre.name : 'Unknown Theatre',
            theatre_address: theatre ? theatre.address : '',
            query_date: dateStr,
            movies: Array.from(movieMap.values())
        };
    }

    /**
     * Get real-time seat availability matrix for a show
     */
    getShowSeatLayout(showId) {
        showId = Number(showId);
        const show = db.shows.get(showId);
        if (!show) return null;

        const screen = db.screens.get(show.screen_id);
        const seats = [];

        for (const ss of db.showSeats.values()) {
            if (ss.show_id === showId) {
                const physicalSeat = db.seats.get(ss.seat_id);
                seats.push({
                    show_seat_id: ss.show_seat_id,
                    seat_id: ss.seat_id,
                    row: physicalSeat ? physicalSeat.row_identifier : '',
                    seat_number: physicalSeat ? physicalSeat.seat_number : 0,
                    type: physicalSeat ? physicalSeat.seat_type : 'REGULAR',
                    price: ss.price,
                    status: ss.status
                });
            }
        }

        return {
            show_id: showId,
            screen_name: screen ? screen.name : '',
            start_time: show.start_time,
            base_price: show.base_price,
            seats: seats.sort((a, b) => a.row.localeCompare(b.row) || a.seat_number - b.seat_number)
        };
    }
}

const showService = new ShowService();

module.exports = {
    showService
};
