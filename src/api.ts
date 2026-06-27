import { Movie, Studio, Showtime, ShowtimeSeat, PriceQuoteResponse, BookingResponse, DashboardStats, PricingModifier } from "./types";

const BASE_URL = ""; // Relative to host (since full-stack Express matches Vite dev)

export async function fetchMovies(): Promise<Movie[]> {
  const res = await fetch(`${BASE_URL}/api/movies`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to load movies");
  return json.data;
}

export async function fetchMovieById(id: string): Promise<Movie> {
  const res = await fetch(`${BASE_URL}/api/movies/${id}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Movie not found");
  return json.data;
}

export async function fetchShowtimes(movieId?: string): Promise<Showtime[]> {
  const url = movieId ? `${BASE_URL}/api/showtimes?movie_id=${movieId}` : `${BASE_URL}/api/showtimes`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to load showtimes");
  return json.data;
}

export async function fetchSeatMap(showtimeId: string): Promise<ShowtimeSeat[]> {
  const res = await fetch(`${BASE_URL}/api/showtimes/${showtimeId}/seats`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to load seat layout");
  return json.data;
}

export async function fetchPriceQuote(showtimeId: string, seatIds: string[]): Promise<PriceQuoteResponse> {
  const res = await fetch(`${BASE_URL}/api/bookings/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ showtime_id: showtimeId, seat_ids: seatIds })
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to calculate dynamic pricing quote");
  return json.data;
}

export async function createBooking(showtimeId: string, seatIds: string[], customerName: string): Promise<BookingResponse> {
  const res = await fetch(`${BASE_URL}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ showtime_id: showtimeId, seat_ids: seatIds, customer_name: customerName })
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Reservation failed");
  return json.data;
}

export async function fetchAIRecommendations(userInput: string): Promise<{ recommendations: Movie[], message: string }> {
  const res = await fetch(`${BASE_URL}/api/ai/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_input: userInput })
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "AI assistant encountered an error");
  return json.data;
}

export async function fetchSmartSeatMatches(showtimeId: string, numSeats: number, preference?: string): Promise<{ matched_seats: string[], explanation: string }> {
  const res = await fetch(`${BASE_URL}/api/ai/seat-matcher`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ showtime_id: showtimeId, num_seats: numSeats, preference })
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Seat Matcher failed");
  return json.data;
}

export async function parseVoiceBookingRequest(voiceText: string): Promise<{
  matched_movie_id: string | null;
  matched_showtime_id: string | null;
  num_seats: number;
  seat_preference: string;
  navigation_message: string;
}> {
  const res = await fetch(`${BASE_URL}/api/ai/parse-voice-booking`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voice_text: voiceText })
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Voice guided booking model failed");
  return json.data;
}

// Admin APIs
export async function adminLogin(email: string, password: string): Promise<{ token: string, admin_id: string, full_name: string }> {
  const res = await fetch(`${BASE_URL}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Authentication failed");
  return json.data;
}

export async function adminRegister(email: string, password: string, fullName: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/admin/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, full_name: fullName })
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Registration failed");
}

export async function fetchAdminDashboard(): Promise<DashboardStats> {
  const res = await fetch(`${BASE_URL}/api/admin/dashboard`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to load dashboard statistics");
  return json.data;
}

export async function fetchAdminModifiers(): Promise<PricingModifier[]> {
  const res = await fetch(`${BASE_URL}/api/admin/pricing`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to fetch pricing modifiers");
  return json.data;
}

export async function toggleAdminModifier(modifierId: string, isActive: boolean): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/admin/pricing/${modifierId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active: isActive })
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to update pricing modifier");
}

export async function adminAddMovie(movieData: Omit<Movie, "id">): Promise<Movie> {
  const res = await fetch(`${BASE_URL}/api/admin/movies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(movieData)
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to create movie");
  return json.data;
}

export async function adminUpdateMovie(id: string, movieData: Partial<Movie>): Promise<Movie> {
  const res = await fetch(`${BASE_URL}/api/admin/movies/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(movieData)
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to edit movie");
  return json.data;
}

export async function adminDeleteMovie(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/admin/movies/${id}`, {
    method: "DELETE"
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to delete movie");
}

export async function adminBulkAddMovies(movies: Omit<Movie, "id">[]): Promise<number> {
  const res = await fetch(`${BASE_URL}/api/admin/movies/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ movies })
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to bulk import movies");
  return json.data.inserted;
}

export async function fetchStudios(): Promise<Studio[]> {
  const res = await fetch(`${BASE_URL}/api/studios`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to load studios");
  return json.data;
}

export async function adminAddShowtime(showtimeData: {
  movie_id: string;
  studio_id: string;
  start_time: string;
  base_price: number;
}): Promise<Showtime> {
  const res = await fetch(`${BASE_URL}/api/admin/showtimes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(showtimeData)
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to add showtime");
  return json.data;
}

export async function adminDeleteShowtime(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/admin/showtimes/${id}`, {
    method: "DELETE"
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to delete showtime");
}

export async function adminResetShowtimeSeats(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/admin/showtimes/${id}/reset`, {
    method: "POST"
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to reset showtime seats");
}

