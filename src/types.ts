export interface Movie {
  id: string;
  title: string;
  synopsis: string;
  genre: string;
  release_year: number;
  duration_min: number;
  rating: number; // general score
  poster_url: string;
  imdb_score: number;
}

export interface Studio {
  id: string;
  name: string;
  capacity: number;
}

export interface Showtime {
  id: string;
  movie_id: string;
  studio_id: string;
  start_time: string; // ISO date-time
  end_time: string; // ISO date-time
  base_price: number; // in Rp
  movie?: Movie;
  studio?: Studio;
}

export interface Seat {
  id: string; // "studioID_row_col"
  studio_id: string;
  row_label: string;
  col_number: number;
  seat_type: 'regular' | 'hot';
}

export interface ShowtimeSeat {
  id: string; // "showtimeID_seatID"
  showtime_id: string;
  seat_id: string;
  status: 'available' | 'occupied' | 'reserved';
  row_label: string;
  col_number: number;
  seat_type: 'regular' | 'hot';
}

export interface Booking {
  id: string;
  showtime_id: string;
  customer_name: string;
  seat_ids: string[];
  final_price: number;
  booked_at: string;
}

export interface PricingModifier {
  id: string;
  label: string;
  modifier_type: 'peak_hour' | 'after_work' | 'holiday' | 'hot_seat' | 'weekend';
  multiplier: number;
  is_active: boolean;
}

export interface DashboardStats {
  total_movies: number;
  total_showtimes: number;
  total_bookings: number;
  occupancy_rate: number;
  revenue_today: number;
  most_booked_movie: string;
  predicted_full_slot: string;
}

export interface PriceQuoteRequest {
  showtime_id: string;
  seat_ids: string[];
}

export interface PriceBreakdown {
  seat_id: string;
  row_label: string;
  col_number: number;
  seat_type: 'regular' | 'hot';
  final_price: number;
}

export interface PriceQuoteResponse {
  base_price: number;
  final_price: number;
  breakdown: PriceBreakdown[];
  applied_rules: string[];
}

export interface CreateBookingRequest {
  showtime_id: string;
  seat_ids: string[];
  customer_name: string;
}

export interface BookingResponse {
  bookings: Booking[];
  total_price: number;
}
