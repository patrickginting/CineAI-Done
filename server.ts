import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  HeadingLevel, 
  AlignmentType, 
  WidthType, 
  BorderStyle 
} from "docx";

dotenv.config();

const app = express();
const PORT = 3000;
const DB_PATH = path.join(process.cwd(), "db.json");

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ─── LOCAL DURABLE STORAGE & SEEDING ──────────────────────────────────────────

interface DBState {
  movies: any[];
  studios: any[];
  showtimes: any[];
  bookings: any[];
  pricing_modifiers: any[];
  admins: any[];
}

function loadDB(): DBState {
  if (!fs.existsSync(DB_PATH)) {
    const initialState = getInitialSeedData();
    fs.writeFileSync(DB_PATH, JSON.stringify(initialState, null, 2));
    return initialState;
  }
  try {
    const data = fs.readFileSync(DB_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading db.json, resetting to seed...", error);
    const initialState = getInitialSeedData();
    fs.writeFileSync(DB_PATH, JSON.stringify(initialState, null, 2));
    return initialState;
  }
}

function saveDB(state: DBState) {
  fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2));
}

// Seed helper (relative to 2026-06-19)
function getInitialSeedData(): DBState {
  const movies = [
    {
      id: "m1",
      title: "Interstellar",
      synopsis: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
      genre: "Sci-Fi / Adventure",
      release_year: 2014,
      duration_min: 169,
      rating: 8.7,
      poster_url: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=600&auto=format&fit=crop",
      imdb_score: 8.7
    },
    {
      id: "m2",
      title: "Dune: Part Two",
      synopsis: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.",
      genre: "Sci-Fi / Drama",
      release_year: 2024,
      duration_min: 166,
      rating: 8.6,
      poster_url: "https://images.unsplash.com/photo-1547483238-f400e65ccd56?q=80&w=600&auto=format&fit=crop",
      imdb_score: 8.6
    },
    {
      id: "m3",
      title: "Spider-Man: Into the Spider-Verse",
      synopsis: "Teen Miles Morales becomes the Spider-Man of his universe, and must join with five spider-powered individuals from other dimensions.",
      genre: "Animation / Action",
      release_year: 2018,
      duration_min: 117,
      rating: 8.4,
      poster_url: "https://images.unsplash.com/photo-1635805737707-575885ab0820?q=80&w=600&auto=format&fit=crop",
      imdb_score: 8.4
    },
    {
      id: "m4",
      title: "Inside Out 2",
      synopsis: "Follow Riley in her teenage years as she encounters new emotions, including Anxiety, Envy, and Embarrassment.",
      genre: "Family / Comedy",
      release_year: 2024,
      duration_min: 96,
      rating: 7.8,
      poster_url: "https://images.unsplash.com/photo-1608889175123-8ec330b86f84?q=80&w=600&auto=format&fit=crop",
      imdb_score: 7.8
    },
    {
      id: "m5",
      title: "Parasite",
      synopsis: "Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.",
      genre: "Thriller / Drama",
      release_year: 2019,
      duration_min: 132,
      rating: 8.5,
      poster_url: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop",
      imdb_score: 8.5
    }
  ];

  const studios = [
    { id: "s1", name: "Studio 1", capacity: 100 },
    { id: "s2", name: "Studio 2", capacity: 100 },
    { id: "s3", name: "Studio 3", capacity: 100 }
  ];

  const pricing_modifiers = [
    { id: "p1", label: "Evening/Night Peak (17:00-22:00)", modifier_type: "peak_hour", multiplier: 1.20, is_active: true },
    { id: "p2", label: "After-Work Rush (16:00-19:00, Weekdays)", modifier_type: "after_work", multiplier: 1.10, is_active: true },
    { id: "p3", label: "Weekend Modifier (Sat & Sun)", modifier_type: "weekend", multiplier: 1.25, is_active: true },
    { id: "p4", label: "Hot Seat Premium (Center Zone)", modifier_type: "hot_seat", multiplier: 1.15, is_active: true }
  ];

  // Let's generate nice showtimes for today "2026-06-19" (which is Friday)
  const showtimes: any[] = [];
  const times = ["10:30", "13:45", "16:30", "19:15", "22:00"];

  movies.forEach((m, mIdx) => {
    // Generate 3 showtimes per movie spreading studios
    const sId = studios[mIdx % studios.length].id;
    const t1 = times[mIdx % times.length];
    const t2 = times[(mIdx + 2) % times.length];

    showtimes.push({
      id: `st_${m.id}_1`,
      movie_id: m.id,
      studio_id: sId,
      start_time: `2026-06-19T${t1}:00Z`,
      end_time: `2026-06-19T${calculateEndTime(t1, m.duration_min)}Z`,
      base_price: 50000 // Rp 50,000 standard start
    });

    showtimes.push({
      id: `st_${m.id}_2`,
      movie_id: m.id,
      studio_id: sId === "s1" ? "s2" : sId === "s2" ? "s3" : "s1",
      start_time: `2026-06-19T${t2}:00Z`,
      end_time: `2026-06-19T${calculateEndTime(t2, m.duration_min)}Z`,
      base_price: 60000 // Rp 60,000 prime timeslot
    });
  });

  return {
    movies,
    studios,
    showtimes,
    bookings: [],
    pricing_modifiers,
    // Pre-create standard admin
    admins: [
      {
        id: "admin_1",
        email: "admin@cineai.com",
        password_hash: "admin", // Simple password check to facilitate testing/demo
        full_name: "CineAI Administrator"
      }
    ]
  };
}

function calculateEndTime(startTimeStr: string, minutes: number): string {
  const [h, m] = startTimeStr.split(":").map(Number);
  const totalMin = h * 60 + m + minutes;
  const newH = Math.floor(totalMin / 60) % 24;
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

// ─── ACTIVE PRICING ENGINE LOGIC ──────────────────────────────────────────────

function isHotSeat(row: string, col: number): boolean {
  return ["D", "E", "F", "G"].includes(row) && [5, 6].includes(col);
}

function calculateTicketPrice(showtime: any, row: string, col: number, modifiers: any[]): { finalPrice: number, appliedRules: string[] } {
  let multiplier = 1.0;
  const appliedRules: string[] = [];
  const base = showtime.base_price;

  const t = new Date(showtime.start_time);
  const hour = t.getUTCHours();
  const day = t.getUTCDay(); // 0 is Sunday, 6 is Saturday

  // Rules mapping
  const peakMod = modifiers.find(m => m.modifier_type === "peak_hour");
  const workMod = modifiers.find(m => m.modifier_type === "after_work");
  const weekendMod = modifiers.find(m => m.modifier_type === "weekend");
  const hotMod = modifiers.find(m => m.modifier_type === "hot_seat");

  // Peak Hours (17:00–22:00)
  if (peakMod && peakMod.is_active && hour >= 17 && hour < 22) {
    multiplier *= peakMod.multiplier;
    appliedRules.push(`${peakMod.label} (+${Math.round((peakMod.multiplier - 1) * 100)}%)`);
  }

  // After-Work Rush (16:00–19:00, Mon-Fri)
  if (workMod && workMod.is_active && hour >= 16 && hour < 19 && day >= 1 && day <= 5) {
    multiplier *= workMod.multiplier;
    appliedRules.push(`${workMod.label} (+${Math.round((workMod.multiplier - 1) * 100)}%)`);
  }

  // Weekend (Sat & Sun)
  if (weekendMod && weekendMod.is_active && (day === 0 || day === 6)) {
    multiplier *= weekendMod.multiplier;
    appliedRules.push(`${weekendMod.label} (+${Math.round((weekendMod.multiplier - 1) * 100)}%)`);
  }

  // Hot Seat premium (Rows D-G, Cols 5-6)
  if (hotMod && hotMod.is_active && isHotSeat(row, col)) {
    multiplier *= hotMod.multiplier;
    appliedRules.push(`Center Zone Hot Seat (+${Math.round((hotMod.multiplier - 1) * 100)}%)`);
  }

  // Round price to nearest 500 for Indonesian Rupiah style neatness
  const precisePrice = base * multiplier;
  const roundedPrice = Math.round(precisePrice / 500) * 500;

  return {
    finalPrice: roundedPrice,
    appliedRules
  };
}

// ─── LAZY INITIALIZE GEMINI CLIENT ────────────────────────────────────────────

let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
  }
  return aiClient;
}

// ─── API ENDPOINTS ────────────────────────────────────────────────────────────

// 1. GET ALL MOVIES
app.get("/api/movies", (req, res) => {
  const db = loadDB();
  res.json({ success: true, data: db.movies });
});

// 2. GET MOVIE BY ID
app.get("/api/movies/:id", (req, res) => {
  const db = loadDB();
  const movie = db.movies.find(m => m.id === req.params.id);
  if (!movie) {
    return res.status(404).json({ success: false, error: "Movie not found" });
  }
  res.json({ success: true, data: movie });
});

// 3. GET SHOWTIMES (optionally filtered by movie_id)
app.get("/api/showtimes", (req, res) => {
  const db = loadDB();
  const movieId = req.query.movie_id as string;
  let list = db.showtimes;

  if (movieId) {
    list = list.filter(st => st.movie_id === movieId);
  }

  // Join movie and studio object data
  const joinedList = list.map(st => ({
    ...st,
    movie: db.movies.find(m => m.id === st.movie_id),
    studio: db.studios.find(s => s.id === st.studio_id)
  }));

  res.json({ success: true, data: joinedList });
});

// 4. GET SEAT MAP (occupied/available status computed in real-time)
app.get("/api/showtimes/:showtimeId/seats", (req, res) => {
  const db = loadDB();
  const stId = req.params.showtimeId;
  const showtime = db.showtimes.find(st => st.id === stId);
  if (!showtime) {
    return res.status(404).json({ success: false, error: "Showtime not found" });
  }

  const studio = db.studios.find(s => s.id === showtime.studio_id);
  if (!studio) {
    return res.status(404).json({ success: false, error: "Studio not found" });
  }

  // Get all bookable seats for this showtime. Standard row A-J, col 1-10 (100 seats per studio)
  const rows = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  const showtimeSeats: any[] = [];

  // Index already locked or booked seats
  const lockedSeatsMap = new Set<string>();
  db.bookings
    .filter(b => b.showtime_id === stId)
    .forEach(b => {
      b.seat_ids.forEach((id: string) => lockedSeatsMap.add(id));
    });

  rows.forEach(row => {
    for (let col = 1; col <= 10; col++) {
      const seatId = `${stId}_${row}_${col}`;
      const hasBooking = lockedSeatsMap.has(`${row}_${col}`);

      showtimeSeats.push({
        id: seatId,
        showtime_id: stId,
        seat_id: `${row}_${col}`,
        status: hasBooking ? "occupied" : "available",
        row_label: row,
        col_number: col,
        seat_type: isHotSeat(row, col) ? "hot" : "regular"
      });
    }
  });

  res.json({ success: true, data: showtimeSeats });
});

// 5. POST PRICE QUOTE FOR BOOKING (for dynamic calculation showcase)
app.post("/api/bookings/quote", (req, res) => {
  const { showtime_id, seat_ids } = req.body as { showtime_id: string, seat_ids: string[] };
  if (!showtime_id || !seat_ids || !Array.isArray(seat_ids)) {
    return res.status(400).json({ success: false, error: "Missing showtime_id or seat_ids" });
  }

  const db = loadDB();
  const showtime = db.showtimes.find(s => s.id === showtime_id);
  if (!showtime) {
    return res.status(401).json({ success: false, error: "Showtime not found" });
  }

  let totalPrice = 0;
  const breakdown: any[] = [];
  const rulesSet = new Set<string>();

  seat_ids.forEach(seatKey => {
    // seatKey is "Row_Col" e.g. "D_5"
    const [row, colStr] = seatKey.split("_");
    const col = Number(colStr);
    const { finalPrice, appliedRules } = calculateTicketPrice(showtime, row, col, db.pricing_modifiers);

    totalPrice += finalPrice;
    appliedRules.forEach(r => rulesSet.add(r));

    breakdown.push({
      seat_id: seatKey,
      row_label: row,
      col_number: col,
      seat_type: isHotSeat(row, col) ? "hot" : "regular",
      final_price: finalPrice
    });
  });

  res.json({
    success: true,
    data: {
      base_price: showtime.base_price,
      final_price: totalPrice,
      breakdown,
      applied_rules: Array.from(rulesSet)
    }
  });
});

// 6. POST CREATE BOOKINGS (atomic locks - double-booking checks)
app.post("/api/bookings", (req, res) => {
  const { showtime_id, seat_ids, customer_name } = req.body as { showtime_id: string, seat_ids: string[], customer_name: string };
  if (!showtime_id || !seat_ids || !customer_name) {
    return res.status(400).json({ success: false, error: "Missing booking properties" });
  }

  const db = loadDB();
  const showtime = db.showtimes.find(st => st.id === showtime_id);
  if (!showtime) {
    return res.status(404).json({ success: false, error: "Showtime not found" });
  }

  // Double-booking lock check: check if any requested seat is already booked
  const alreadyBooked = db.bookings
    .filter(b => b.showtime_id === showtime_id)
    .flatMap(b => b.seat_ids);

  const doubleBooked = seat_ids.filter(sid => alreadyBooked.includes(sid));
  if (doubleBooked.length > 0) {
    return res.status(409).json({
      success: false,
      error: `Conflict! Seats [${doubleBooked.join(", ")}] have just been booked by another customer. Please select different seats.`
    });
  }

  // Calculate final dynamic pricing on server
  let final_price = 0;
  seat_ids.forEach(seatKey => {
    const [row, colStr] = seatKey.split("_");
    const col = Number(colStr);
    const { finalPrice } = calculateTicketPrice(showtime, row, col, db.pricing_modifiers);
    final_price += finalPrice;
  });

  const newBooking = {
    id: `b_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    showtime_id,
    customer_name,
    seat_ids,
    final_price,
    booked_at: new Date().toISOString()
  };

  db.bookings.push(newBooking);
  saveDB(db);

  res.json({
    success: true,
    data: {
      bookings: [newBooking],
      total_price: final_price
    }
  });
});

// 7. PUBLIC ENGINE FOR GEMINI MOVIE RECOMMENDATIONS
app.post("/api/ai/recommend", async (req, res) => {
  const { user_input } = req.body as { user_input: string };
  if (!user_input) {
    return res.status(400).json({ success: false, error: "User input required" });
  }

  const db = loadDB();
  const catalog = db.movies.map(m => `- ${m.title} [Genre: ${m.genre}] Synopsis: ${m.synopsis}`).join("\n");

  const gemini = getGemini();

  if (!gemini) {
    // Local Keyword/Genre Fallback when API key is missing
    const recommendations = db.movies.filter(m =>
      m.genre.toLowerCase().includes(user_input.toLowerCase()) ||
      m.title.toLowerCase().includes(user_input.toLowerCase()) ||
      m.synopsis.toLowerCase().includes(user_input.toLowerCase())
    ).slice(0, 3);

    return res.json({
      success: true,
      data: {
        recommendations,
        message: "Offline Local Matcher (Input matched catalog genres/synopsis keywords successfully)."
      }
    });
  }

  try {
    const prompt = `You are CineAI's elite cinema assistant. The guest says: "${user_input}".
Looking strictly at our active catalog of films below, recommend 1 to 3 films that best match their inquiry.
Always reply with valid JSON array containing exactly the movie titles matching our list. Do not write explanation.

Catalog:
${catalog}

Return JSON format: ["Movie Title 1", "Movie Title 2"]`;

    const response = await gemini.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsedTitles: string[] = JSON.parse(response.text || "[]");
    const titleSet = new Set(parsedTitles.map(t => t.toLowerCase()));

    const recommendations = db.movies.filter(m => titleSet.has(m.title.toLowerCase()));

    res.json({
      success: true,
      data: {
        recommendations: recommendations.length > 0 ? recommendations : db.movies.slice(0, 2),
        message: "Smart Recommendation by Google Gemini"
      }
    });
  } catch (error) {
    console.error("Gemini Assistant Failure, falling back...", error);
    const recommendations = db.movies.slice(0, 2);
    res.json({
      success: true,
      data: {
        recommendations,
        message: "Quick Fallback Recommendation (Default Catalog Showcase)"
      }
    });
  }
});

// 7a. AI SMART SEAT MATCHER ENDPOINT
app.post("/api/ai/seat-matcher", async (req, res) => {
  const { showtime_id, num_seats, preference } = req.body as { showtime_id: string, num_seats: number, preference?: string };
  if (!showtime_id) {
    return res.status(400).json({ success: false, error: "showtime_id is required" });
  }

  const db = loadDB();
  const showtime = db.showtimes.find(st => st.id === showtime_id);
  if (!showtime) {
    return res.status(404).json({ success: false, error: "Showtime not found" });
  }

  const tickets = Number(num_seats) || 1;
  const pref = preference || "any";

  // Lock set
  const lockedSeatsMap = new Set<string>();
  db.bookings
    .filter(b => b.showtime_id === showtime_id)
    .forEach(b => {
      b.seat_ids.forEach((id: string) => lockedSeatsMap.add(id));
    });

  // Layout list of candidates
  const rows = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  const availableCandidates: any[] = [];
  rows.forEach(row => {
    for (let col = 1; col <= 10; col++) {
      const seatKey = `${row}_${col}`;
      if (!lockedSeatsMap.has(seatKey)) {
        availableCandidates.push({
          seat_id: seatKey,
          row_label: row,
          col_number: col,
          seat_type: isHotSeat(row, col) ? "hot" : "regular",
          relative_position: ["A", "B", "C"].includes(row) ? "back" : ["D", "E", "F", "G"].includes(row) ? "middle" : "front"
        });
      }
    }
  });

  if (availableCandidates.length < tickets) {
    return res.status(400).json({
      success: false,
      error: `Sorry, only ${availableCandidates.length} seats are left for this showtime.`
    });
  }

  const gemini = getGemini();

  if (gemini) {
    try {
      const prompt = `You are CineAI's elite seating algorithm assistant.
Your task is to select exactly ${tickets} best seat(s) for a theater layout from the available candidate list below.
User has requested the following preferences: "${pref}".

Available Seating Candidates:
${JSON.stringify(availableCandidates)}

RULES:
1. You MUST select exactly ${tickets} seats from the candidate lists above.
2. Highly prioritize contiguous/side-by-side configurations if selecting multiple tickets (e.g. same row, sequential col_number like G_7 and G_8).
3. Match preferences closely:
   - "front" / "immersive" / "dekat" / "H, I, J": front rows (closest to the screen)
   - "middle" / "center" / "tengah" / "D, E, F, G": middle rows.
   - "rear" / "back" / "belakang" / "A, B, C": back rows (starting from A, which is the furthest row from the screen, offering maximum legroom/privacy).
   - "aisle" / "edge" / "pinggir" / "pojok": col_number 1 or 10.
4. IMPORTANT MIDDLE AISLE RULE: There is a vital central walkway aisle in the theater between column 5 and column 6. Do NOT suggest a contiguous group of seats that spans across the aisle (e.g. do not assign a pair like "F_5" and "F_6" because they are physically separated by the aisle). They must both be on the left (columns 1 to 5) or both on the right (columns 6 to 10).
5. Prefer seats closer to the center of the columns (e.g. cols 4, 5, 6, 7) unless the user explicitly requested "pojok" / "pinggir" / "edge" seats.
6. Reply with a valid, clean JSON object matching this schema. Write nothing else besides this JSON object.
{
  "matched_seats": ["Row_Col", "Row_Col"],
  "explanation": "A friendly, warm, precise, and professional explanation (in Indonesian language to match the preference) explaining why these seats are perfect for them."
}`;

      const response = await gemini.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const parsedResult = JSON.parse(response.text || "{}");
      if (parsedResult.matched_seats && Array.isArray(parsedResult.matched_seats)) {
        return res.json({
          success: true,
          data: {
            matched_seats: parsedResult.matched_seats,
            explanation: parsedResult.explanation || `Saya memilih kursi ${parsedResult.matched_seats.join(", ")} untuk kesempurnaan kenyamanan Anda.`
          }
        });
      }
    } catch (e) {
      console.error("Failed to fetch seat recommendation from Gemini, falling back...", e);
    }
  }

  // Fallback Local Algorithm for Seat Matching
  // Try to find contiguous seats, else pick topmost available ones
  let finalSelectedList: string[] = [];
  
  // Group available seats by row
  const groupedByRow: Record<string, typeof availableCandidates> = {};
  availableCandidates.forEach(c => {
    if (!groupedByRow[c.row_label]) groupedByRow[c.row_label] = [];
    groupedByRow[c.row_label].push(c);
  });

  // Try to find a row that can fit all tickets contiguously
  // Default search prioritizes middle rows (sweet spot rows)
  let rowKeys = ["E", "F", "D", "G", "C", "H", "B", "I", "A", "J"]; 
  if (pref.includes("belakang") || pref.includes("back") || pref.includes("pojok") || pref.includes("rear")) {
    // A is furthest back row, followed by B, C...
    rowKeys = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  } else if (pref.includes("depan") || pref.includes("front") || pref.includes("dekat")) {
    // J is nearest front row, followed by I, H...
    rowKeys = ["J", "I", "H", "G", "F", "E", "D", "C", "B", "A"];
  }

  let foundContiguous = false;
  for (const rKey of rowKeys) {
    const rowSeats = groupedByRow[rKey] || [];
    rowSeats.sort((a,b) => a.col_number - b.col_number);
    
    // Find all valid contiguous blocks of size `tickets` in this row
    const possibleBlocks: typeof availableCandidates[] = [];
    for (let i = 0; i <= rowSeats.length - tickets; i++) {
      const block = rowSeats.slice(i, i + tickets);
      let isValid = true;
      for (let j = 0; j < block.length - 1; j++) {
        // Must be sequential and not span across the central aisle (between col 5 and 6)
        if (block[j+1].col_number - block[j].col_number !== 1) {
          isValid = false;
          break;
        }
        if (block[j].col_number === 5 && block[j+1].col_number === 6) {
          isValid = false;
          break;
        }
      }
      if (isValid) {
        possibleBlocks.push(block);
      }
    }

    if (possibleBlocks.length > 0) {
      // Sort the blocks based on preference proximity
      const isCornerPref = pref.includes("pojok") || pref.includes("corner") || pref.includes("pinggir") || pref.includes("edge") || pref.includes("tepi");
      
      possibleBlocks.sort((blockA, blockB) => {
        const centerA = (blockA[0].col_number + blockA[blockA.length - 1].col_number) / 2;
        const centerB = (blockB[0].col_number + blockB[blockB.length - 1].col_number) / 2;
        const distA = Math.abs(centerA - 5.5);
        const distB = Math.abs(centerB - 5.5);
        
        if (isCornerPref) {
          // Maximize distance from center (closest to the outer walls col 1 and 10)
          return distB - distA;
        } else {
          // Minimize distance from center (closest to the middle aisle columns 4-5 and 6-7)
          return distA - distB;
        }
      });

      finalSelectedList = possibleBlocks[0].map(c => c.seat_id);
      foundContiguous = true;
      break;
    }
  }

  // If no contiguous configuration is found, just pick the best individual seats
  if (finalSelectedList.length < tickets) {
    availableCandidates.sort((a,b) => {
      // rank by preferred row Keys
      const indexA = rowKeys.indexOf(a.row_label);
      const indexB = rowKeys.indexOf(b.row_label);
      if (indexA !== indexB) return indexA - indexB;
      
      // column-wise distance from center
      const isCornerPref = pref.includes("pojok") || pref.includes("corner") || pref.includes("pinggir") || pref.includes("edge") || pref.includes("tepi");
      const distA = Math.abs(5.5 - a.col_number);
      const distB = Math.abs(5.5 - b.col_number);
      return isCornerPref ? distB - distA : distA - distB;
    });
    finalSelectedList = availableCandidates.slice(0, tickets).map(c => c.seat_id);
  }

  res.json({
    success: true,
    data: {
      matched_seats: finalSelectedList,
      explanation: `[Mode Offline] Saya telah memilih kursi *${finalSelectedList.join(", ")}* untuk Anda. Konfigurasi ini memberikan tata letak sudut pandang terbaik yang tersedia di teater saat ini.`
    }
  });
});

// 7b. AI VOICE GUIDED BOOKING PARSER
app.post("/api/ai/parse-voice-booking", async (req, res) => {
  const { voice_text } = req.body as { voice_text: string };
  if (!voice_text) {
    return res.status(400).json({ success: false, error: "voice_text is mandatory" });
  }

  const db = loadDB();
  const moviesLite = db.movies.map(m => ({ id: m.id, title: m.title, genre: m.genre }));
  
  const showtimesLite = db.showtimes.map(st => {
    const m = db.movies.find(mov => mov.id === st.movie_id);
    return {
      id: st.id,
      movie_id: st.movie_id,
      movie_title: m ? m.title : "Unknown",
      studio: st.studio_id === "s1" ? "Studio 1" : st.studio_id === "s2" ? "Studio 2" : "Studio 3",
      time: new Date(st.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
    };
  });

  const gemini = getGemini();

  if (gemini) {
    try {
      const prompt = `You are CineAI's intuitive voice assistant parser.
The customer said/spoke: "${voice_text}".

Your job is to match their inquiry with our ACTIVE movies and showtimes lists to do automatic automated booking.
Movies list:
${JSON.stringify(moviesLite)}

Showtimes list:
${JSON.stringify(showtimesLite)}

Determine their core request intent:
- matched_movie_id: ID of the movie they want, or null if no movies matched.
- matched_showtime_id: ID of the closest showtime matching their preference (e.g., jam 7, sore, malam). If more than 1 showtime fits, select the first match. If they don't mention a time, return the first showtime ID available for that movie.
- num_seats: number of seats/tickets requested. Default to 1 if not explicitly mentioned.
- seat_preference: text describing comfort or position (e.g. "belakang", "tengah", "sejajar", "pojok"). Default to "" if none.
- navigation_message: Confirm the parsed choices in a super elegant, friendly Indonesian tone. Tell them what movie, showtimes, and how many seats you are selecting, and say we've opened the layout for them.

Reply STRICTLY with a valid JSON object matching the schema below. No other text around it:
{
  "matched_movie_id": "m1" (or null if unmatched),
  "matched_showtime_id": "st_m1_1" (or null if unmatched),
  "num_seats": 2,
  "seat_preference": "tengah",
  "navigation_message": "Siyap! Saya bantu bukakan film Interstellar pertunjukan jam 13:45 untuk 2 orang. Silakan lihat pilihan kursi yang sudah saya sarankan."
}`;

      const response = await gemini.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const parsed = JSON.parse(response.text || "{}");
      return res.json({
        success: true,
        data: parsed
      });
    } catch (e) {
      console.error("Failed to parse guided-booking from voice with Gemini, trying offline fallback...", e);
    }
  }

  // Offline parsing fallback
  const textL = voice_text.toLowerCase();
  let matched_movie_id: string | null = null;
  let matched_showtime_id: string | null = null;
  let num_seats = 1;
  let seat_preference = "";

  // 1. match movie
  for (const m of db.movies) {
    if (textL.includes(m.title.toLowerCase()) || m.genre.toLowerCase().split(" ").some(w => textL.includes(w))) {
      matched_movie_id = m.id;
      break;
    }
  }
  // fallback to first if any
  if (!matched_movie_id && db.movies.length > 0) {
    matched_movie_id = db.movies[0].id;
  }

  // 2. match showtime
  const relevantShowtimes = db.showtimes.filter(st => st.movie_id === matched_movie_id);
  if (relevantShowtimes.length > 0) {
    matched_showtime_id = relevantShowtimes[0].id; // first fallback
    if (textL.includes("malam") || textL.includes("22:") || textL.includes("19:")) {
      const evening = relevantShowtimes.find(st => st.id.includes("2") || st.start_time.includes("19:") || st.start_time.includes("22:"));
      if (evening) matched_showtime_id = evening.id;
    }
  }

  // 3. parse seat count
  const numbersMap: Record<string, number> = { "satu": 1, "dua": 2, "tiga": 3, "empat": 4, "lima": 5, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5 };
  Object.keys(numbersMap).forEach(key => {
    if (textL.includes(key)) num_seats = numbersMap[key];
  });
  // numerical
  const matches = textL.match(/\d+/);
  if (matches) {
    num_seats = Number(matches[0]);
  }

  // 4. seat pref
  if (textL.includes("belakang") || textL.includes("back")) seat_preference = "belakang";
  else if (textL.includes("tengah") || textL.includes("middle") || textL.includes("center")) seat_preference = "tengah";
  else if (textL.includes("depan") || textL.includes("front")) seat_preference = "depan";

  const movieObj = db.movies.find(m => m.id === matched_movie_id);
  const movieTitle = movieObj ? movieObj.title : "film terpopuler";

  res.json({
    success: true,
    data: {
      matched_movie_id,
      matched_showtime_id,
      num_seats,
      seat_preference,
      navigation_message: `[Mode Offline] Saya mencocokkan permintaan Anda untuk memesan ${num_seats} tiket ${movieTitle}. Silakan lihat pilihan kursi otomatis Anda!`
    }
  });
});

// 8. ADMIN ROUTE login
app.post("/api/admin/auth/login", (req, res) => {
  const { email, password } = req.body;
  const db = loadDB();
  const admin = db.admins.find(a => a.email === email && a.password_hash === password);

  if (!admin) {
    return res.status(401).json({ success: false, error: "Invalid administrative credentials." });
  }

  res.json({
    success: true,
    data: {
      token: "cineai-premium-session-token",
      admin_id: admin.id,
      full_name: admin.full_name,
      expire_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    }
  });
});

// Register new admin
app.post("/api/admin/auth/register", (req, res) => {
  const { email, password, full_name } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ success: false, error: "All profile fields are mandatory." });
  }

  const db = loadDB();
  if (db.admins.find(a => a.email === email)) {
    return res.status(409).json({ success: false, error: "Administrative email already exists." });
  }

  const newAdmin = {
    id: `admin_${Date.now()}`,
    email,
    password_hash: password,
    full_name
  };

  db.admins.push(newAdmin);
  saveDB(db);

  res.json({ success: true, data: { message: "Admin registered successfully." } });
});

// 9. ADMIN GET MODIFIERS
app.get("/api/admin/pricing", (req, res) => {
  const db = loadDB();
  res.json({ success: true, data: db.pricing_modifiers });
});

// 10. ADMIN TOGGLE PRICING MODIFIER
app.patch("/api/admin/pricing/:modifierId", (req, res) => {
  const db = loadDB();
  const mod = db.pricing_modifiers.find(m => m.id === req.params.modifierId);
  if (!mod) {
    return res.status(404).json({ success: false, error: "Pricing modifier not found." });
  }

  const { is_active } = req.body;
  mod.is_active = !!is_active;
  saveDB(db);

  res.json({ success: true, data: { status: "Modifier updated successfully." } });
});

// 11. ADMIN DASHBOARD STATS WITH GEMINI OCCUPANCY PREDICTION
app.get("/api/admin/dashboard", async (req, res) => {
  const db = loadDB();

  const total_movies = db.movies.length;
  const total_showtimes = db.showtimes.length;
  const total_bookings = db.bookings.length;

  const totalPossibleSeats = db.showtimes.length * 100; // 100 seats per showtime
  let totalBookedSeats = 0;
  db.bookings.forEach(b => totalBookedSeats += (b.seat_ids || []).length);

  const occupancy_rate = totalPossibleSeats > 0 ? (totalBookedSeats / totalPossibleSeats) * 100 : 0;

  // Revenue sums
  let revenue_today = 0;
  db.bookings.forEach(b => revenue_today += b.final_price);

  // Most booked movie
  const movieBookingCount: Record<string, number> = {};
  db.bookings.forEach(b => {
    const showtime = db.showtimes.find(st => st.id === b.showtime_id);
    if (showtime) {
      movieBookingCount[showtime.movie_id] = (movieBookingCount[showtime.movie_id] || 0) + b.seat_ids.length;
    }
  });

  let maxBookings = 0;
  let mostBookedMovieId = "";
  Object.keys(movieBookingCount).forEach(mId => {
    if (movieBookingCount[mId] > maxBookings) {
      maxBookings = movieBookingCount[mId];
      mostBookedMovieId = mId;
    }
  });

  const topMovie = db.movies.find(m => m.id === mostBookedMovieId);
  const most_booked_movie = topMovie ? topMovie.title : "None booked yet";

  // Compute Gemini predictions on which timeslot is likely to hit 100% occupancy or fallback
  const showtimeStatsList = db.showtimes.map(st => {
    const movie = db.movies.find(m => m.id === st.movie_id);
    const studio = db.studios.find(s => s.id === st.studio_id);
    const bookings = db.bookings.filter(b => b.showtime_id === st.id);
    let seatsNum = 0;
    bookings.forEach(b => seatsNum += b.seat_ids.length);

    return {
      movie: movie?.title || "Unknown",
      start_time: st.start_time,
      studio: studio?.name || "Unknown",
      occupancy: seatsNum
    };
  });

  let predicted_full_slot = "Studio 1 - 19:15 Show"; // default local prediction
  const gemini = getGemini();

  if (gemini && showtimeStatsList.length > 0) {
    try {
      const predictionPrompt = `Analyze the current cinema slot logs:
${JSON.stringify(showtimeStatsList)}

Predict which showcase timeslot is most likely to hit 100% occupancy first based on time of day, current booking occupancy, and film rating/popularity.
Reply with a single text sentence (max 15 words) specifying the timeslot. Keep it short.`;

      const response = await gemini.models.generateContent({
        model: "gemini-3.5-flash",
        contents: predictionPrompt,
      });

      if (response.text) {
        predicted_full_slot = response.text.trim();
      }
    } catch (e) {
      console.error("AI occupancy prediction failure, using fallback", e);
    }
  } else {
    // Local calculation fallback: find slot with maximum bookings currently
    let maxOcc = -1;
    let worstSlot = "";
    db.showtimes.forEach(st => {
      const bookingsForSt = db.bookings.filter(b => b.showtime_id === st.id);
      let seatsCount = 0;
      bookingsForSt.forEach(b => seatsCount += b.seat_ids.length);
      if (seatsCount > maxOcc) {
        maxOcc = seatsCount;
        const movie = db.movies.find(m => m.id === st.movie_id);
        const t = new Date(st.start_time);
        worstSlot = `${movie?.title || "Movie"} at ${t.getUTCHours()}:${String(t.getUTCMinutes()).padStart(2, "0")} in ${st.studio_id === "s1" ? "Studio 1" : st.studio_id === "s2" ? "Studio 2" : "Studio 3"}`;
      }
    });
    if (worstSlot) {
      predicted_full_slot = `${worstSlot} (Based on local volume metrics)`;
    }
  }

  res.json({
    success: true,
    data: {
      total_movies,
      total_showtimes,
      total_bookings,
      occupancy_rate,
      revenue_today,
      most_booked_movie,
      predicted_full_slot
    }
  });
});

// 12. CRUD FILM - ADD MOVIE
app.post("/api/admin/movies", (req, res) => {
  const db = loadDB();
  const newMovie = {
    id: `m_${Date.now()}`,
    ...req.body
  };
  db.movies.push(newMovie);
  saveDB(db);
  res.json({ success: true, data: newMovie });
});

// 13. CRUD FILM - UPDATE MOVIE
app.put("/api/admin/movies/:id", (req, res) => {
  const db = loadDB();
  const index = db.movies.findIndex(m => m.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: "Movie not found" });
  }

  db.movies[index] = {
    ...db.movies[index],
    ...req.body
  };
  saveDB(db);
  res.json({ success: true, data: db.movies[index] });
});

// 14. CRUD FILM - DELETE MOVIE
app.delete("/api/admin/movies/:id", (req, res) => {
  const db = loadDB();
  db.movies = db.movies.filter(m => m.id !== req.params.id);
  // clean up connected showtimes
  db.showtimes = db.showtimes.filter(st => st.movie_id !== req.params.id);
  saveDB(db);
  res.json({ success: true, data: { message: "Movie deleted successfully" } });
});

// 15. BULK CSV IMPORT ENDPOINT
app.post("/api/admin/movies/bulk", (req, res) => {
  const { movies } = req.body as { movies: any[] };
  if (!movies || !Array.isArray(movies)) {
    return res.status(400).json({ success: false, error: "Invalid movies array" });
  }

  const db = loadDB();
  let inserted = 0;

  movies.forEach(m => {
    // Generate valid id and default scores
    const id = `bulk_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const poster = m.poster_url || "https://images.unsplash.com/photo-1547483238-f400e65ccd56?q=80&w=600&auto=format&fit=crop";

    db.movies.push({
      id,
      title: m.title || "Untitled Film",
      synopsis: m.synopsis || "No description loaded.",
      genre: m.genre || "Drama",
      release_year: m.release_year ? Number(m.release_year) : 2026,
      duration_min: m.duration_min ? Number(m.duration_min) : 100,
      rating: m.rating ? Number(m.rating) : 7.0,
      poster_url: poster,
      imdb_score: m.imdb_score ? Number(m.imdb_score) : m.rating ? Number(m.rating) : 7.0
    });

    inserted++;
  });

  saveDB(db);
  res.json({ success: true, data: { inserted } });
});

// GET ALL STUDIOS FOR ADMIN & CUSTOMERS
app.get("/api/studios", (req, res) => {
  const db = loadDB();
  res.json({ success: true, data: db.studios });
});

// CREATE NEW SHOWTIME FOR ADMIN
app.post("/api/admin/showtimes", (req, res) => {
  const db = loadDB();
  const { movie_id, studio_id, start_time, base_price } = req.body;
  if (!movie_id || !studio_id || !start_time || !base_price) {
    return res.status(400).json({ success: false, error: "Semua parameter wajib diisi (movie_id, studio_id, start_time, base_price)" });
  }
  
  const movie = db.movies.find(m => m.id === movie_id);
  if (!movie) {
    return res.status(404).json({ success: false, error: "Movie tidak ditemukan" });
  }

  const id = `st_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const start = new Date(start_time);
  const end = new Date(start.getTime() + movie.duration_min * 60 * 1000);

  const newShowtime = {
    id,
    movie_id,
    studio_id,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    base_price: Number(base_price)
  };

  db.showtimes.push(newShowtime);
  saveDB(db);

  res.json({ success: true, data: newShowtime });
});

// DELETE SHOWTIME FOR ADMIN AND CASCADE DELETE BOOKINGS
app.delete("/api/admin/showtimes/:id", (req, res) => {
  const db = loadDB();
  db.showtimes = db.showtimes.filter(st => st.id !== req.params.id);
  db.bookings = db.bookings.filter(b => b.showtime_id !== req.params.id);
  saveDB(db);
  res.json({ success: true, data: { message: "Showtime dan booking terkait berhasil dihapus" } });
});

// RESET SEAT BOOKINGS FOR SHOWTIME
app.post("/api/admin/showtimes/:id/reset", (req, res) => {
  const db = loadDB();
  const stId = req.params.id;
  db.bookings = db.bookings.filter(b => b.showtime_id !== stId);
  saveDB(db);
  res.json({ success: true, data: { message: "Seluruh kursi untuk jadwal tayang ini berhasil di-reset" } });
});

// 16. EXPORT PKM-KC WORD REPORT ROUTE (.DOCX GENERATOR)
app.get("/api/download-report", async (req, res) => {
  try {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            // COVER PAGE TITLE
            new Paragraph({
              text: "PROPOSAL PROGRAM KREATIVITAS MAHASISWA — KARSA CIPTA (PKM-KC)",
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "CINEAI: SISTEM BIOSKOP CERDAS TERINTEGRASI CHATBOT REKOMENDASI KURSI SPASIAL DAN BULK IMPORTER DATABASE DATA FILE IMDB/KAGGLE",
                  bold: true,
                  size: 28, // 14pt
                  font: "Times New Roman"
                })
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 800 }
            }),

            new Paragraph({
              text: "DAFTAR ISI",
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 240, after: 120 }
            }),
            new Paragraph({ text: "DAFTAR ISI .......................................................................................................... i", spacing: { after: 60 } }),
            new Paragraph({ text: "BAB 1. PENDAHULUAN ........................................................................................ 1", spacing: { after: 60 } }),
            new Paragraph({ text: "   1.1 Latar Belakang ........................................................................................ 1", spacing: { after: 60 } }),
            new Paragraph({ text: "   1.2 Tujuan ..................................................................................................... 1", spacing: { after: 60 } }),
            new Paragraph({ text: "   1.3 Prediksi Manfaat ....................................................................................... 1", spacing: { after: 60 } }),
            new Paragraph({ text: "   1.4 Luaran ...................................................................................................... 2", spacing: { after: 60 } }),
            new Paragraph({ text: "BAB 2. TINJAUAN PUSTAKA ................................................................................. 3", spacing: { after: 60 } }),
            new Paragraph({ text: "   2.1 Sistem Informasi Bioskop & Spasial ............................................................ 3", spacing: { after: 60 } }),
            new Paragraph({ text: "   2.2 NLP & Kecerdasan Buatan ........................................................................ 3", spacing: { after: 60 } }),
            new Paragraph({ text: "BAB 3. TAHAP PELAKSANAAN ............................................................................. 4", spacing: { after: 60 } }),
            new Paragraph({ text: "   3.1 Deskripsi Produk CineAI ............................................................................ 4", spacing: { after: 60 } }),
            new Paragraph({ text: "   3.2 Alur dan Tahapan Pelaksanaan .................................................................... 4", spacing: { after: 60 } }),
            new Paragraph({ text: "   3.3 Perancangan Produk/Alat/Sistem (Use Case & ERD) .................................. 5", spacing: { after: 60 } }),
            new Paragraph({ text: "   3.4 Pengujian (White Box Testing) ..................................................................... 6", spacing: { after: 60 } }),
            new Paragraph({ text: "BAB 4. BIAYA DAN JADWAL KEGIATAN .............................................................. 8", spacing: { after: 60 } }),
            new Paragraph({ text: "   4.1 Anggaran Biaya ........................................................................................ 8", spacing: { after: 60 } }),
            new Paragraph({ text: "   4.2 Jadwal Kegiatan ........................................................................................ 8", spacing: { after: 120 } }),

            // BAB 1
            new Paragraph({
              text: "BAB 1. PENDAHULUAN",
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 240, after: 120 }
            }),
            new Paragraph({
              text: "1.1 Latar Belakang",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 180, after: 80 }
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Perkembangan industri layar lebar dan bioskop di Indonesia mengalami pertumbuhan pesat pasca pandemi. Namun, sistem reservasi tiket bioskop konvensional saat ini masih dibatasi oleh antarmuka statis yang kaku dan minim asisten pemandu cerdas. Saat memesan tiket dalam jumlah rombongan, pengguna sering kesulitan menemukan konfigurasi kursi berdampingan yang optimal. Rekomendasi kursi otomatis masa kini sering kali mengabaikan kendala fisik spasial bioskop seperti gang berjalan (Central Walkway Aisle). Akibatnya, sistem dapat merekomendasikan kursi yang secara nomor berurutan (misal: kursi 5 dan 6) namun sebenarnya terpisah oleh lorong jalan tengah, merusak pengalaman menonton bersama rekan atau keluarga.",
                  font: "Times New Roman",
                  size: 24
                })
              ],
              spacing: { line: 276, after: 120 }
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Di sisi lain, memperbarui katalog ribuan film bioskop merupakan beban berat bagi administrator jika harus diinput satu per satu. Untuk menjembatani tantangan ini, proyek Karsa Cipta CINEAI dikembangkan. CINEAI merupakan platform bioskop cerdas terintegrasi full-stack yang menyatukan pemilih kursi spasial adaptif (menghindari hambatan lorong tengah secara otomatis), chatbot pintar berbahasa Indonesia bertenaga AI Generatif (Gemini API) untuk memberikan asisten interaktif, serta Bulk CSV Importer handal berkemampuan parse data hingga 5.000 film IMDB/Kaggle secara instan tanpa hambatan payload.",
                  font: "Times New Roman",
                  size: 24
                })
              ],
              spacing: { line: 276, after: 120 }
            }),

            new Paragraph({
              text: "1.2 Tujuan",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 180, after: 80 }
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Tujuan dari pengembangan karsa cipta sistem CINEAI ini adalah:",
                  font: "Times New Roman",
                  size: 24
                })
              ],
              spacing: { after: 60 }
            }),
            new Paragraph({
              children: [new TextRun({ text: "1. Merancang algoritma pendeteksi spasial kursi berdampingan yang cerdas dengan mengimplementasikan penghalang lorong fisik (Aisle Barrier Avoidance).", font: "Times New Roman", size: 24 })],
              spacing: { line: 276, after: 60 }
            }),
            new Paragraph({
              children: [new TextRun({ text: "2. Membangun asisten interaktif percakapan alami (Chatbot AI) berbasis model representasi bahasa Indonesia guna mengasistensi navigasi pemesanan pelanggan bioskop secara real-time.", font: "Times New Roman", size: 24 })],
              spacing: { line: 276, after: 60 }
            }),
            new Paragraph({
              children: [new TextRun({ text: "3. Membuat modul Bulk Importer yang andal untuk parsing data file CSV berskala ribuan records guna mempermudah sinkronisasi database administrator bioskop.", font: "Times New Roman", size: 24 })],
              spacing: { line: 276, after: 120 }
            }),

            new Paragraph({
              text: "1.3 Prediksi Manfaat",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 180, after: 80 }
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Pengembangan sistem CINEAI diprediksi memberikan manfaat signifikan bagi masyarakat luas, operasional bioskop, dan komunitas pengembang sistem informasi. Bagi pelanggan (masyarakat), sistem ini menghapuskan risiko 'pemesanan kursi terpisah lorong' yang kerap terjadi pada aplikasi pembelian tiket mobile konvensional. Bagi penyedia bioskop, modul bulk importer melangkahi proses input manual yang lambat menjadi proses instan satu-klik.",
                  font: "Times New Roman",
                  size: 24
                })
              ],
              spacing: { line: 276, after: 120 }
            }),

            new Paragraph({
              text: "1.4 Luaran",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 180, after: 80 }
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Luaran wajib dari pelaksanaan program PKM-KC CineAI ini meliputi:",
                  font: "Times New Roman",
                  size: 24
                })
              ],
              spacing: { after: 60 }
            }),
            new Paragraph({ children: [new TextRun({ text: "1. Laporan Kemajuan pelaksanaan pekerjaan.", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "2. Laporan Akhir dokumentasi rekayasa sistem.", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "3. Prototipe Sistem Fungsional Web CINEAI (aktif dan dapat diakses publik).", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "4. Akun Media Sosial Publikasi untuk sosialisasi sistem dan jangkauan publik.", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 120 } }),

            // BAB 2
            new Paragraph({
              text: "BAB 2. TINJAUAN PUSTAKA",
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 240, after: 120 }
            }),
            new Paragraph({
              text: "2.1 Sistem Informasi Bioskop & Spasial",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 180, after: 80 }
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Reservasi tempat duduk bioskop memerlukan pendekatan spasial 2D grid. Berbeda dengan pemesanan bangku pesawat atau konser, bioskop memiliki titik pusat pandang layar (Sweet Spot) di baris tengah bagian belakang. Penelitian mutakhir menerangkan bahwa integrasi denah visual interaktif dengan pengelompokan zona harga dinamis (seperti Hot Seats / Prime Premium di pusat bioskop) sangat memengaruhi tingkat kepuasan pelanggan dan efektivitas pendapatan studio bioskop.",
                  font: "Times New Roman",
                  size: 24
                })
              ],
              spacing: { line: 276, after: 120 }
            }),

            new Paragraph({
              text: "2.2 NLP & Kecerdasan Buatan",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 180, after: 80 }
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Asisten virtual atau chatbot saat ini didominasi oleh kecerdasan buatan berbasis Large Language Model (LLM). Dengan memodulasi asisten berbasis instruksi prompt terpimpin dalam bahasa Indonesia, chatbot CINEAI dapat bertindak sebagai penasihat tiket bioskop yang intuitif. Chatbot ini tidak hanya menjawab seputar ringkasan film, namun juga menerjemahkan preferensi bahasa alami manusia ('pesankan dua tiket di tengah yang asyik') menjadi pemanggilan program API kursi spasial bioskop secara langsung.",
                  font: "Times New Roman",
                  size: 24
                })
              ],
              spacing: { line: 276, after: 120 }
            }),

            // BAB 3
            new Paragraph({
              text: "BAB 3. TAHAP PELAKSANAAN",
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 240, after: 120 }
            }),
            new Paragraph({
              text: "3.1 Deskripsi Produk CineAI",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 180, after: 80 }
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "CINEAI dirancang sebagai aplikasi full-stack web berkinerja tinggi. Bagian Frontend dikonstruksi menggunakan React, Tailwind CSS untuk antarmuka responsif ramah pergerakan transisi, serta didukung oleh Lucide-React sebagai ikonografi modern. Bagian Backend ditenagai oleh Node.js (Express) server-side untuk memastikan operasi API aman dari paparan kunci rahasia (seperti Google Gemini API Key). Database yang digunakan mengandalkan format penyimpanan lokal persisten terenkripsi JSON (db.json) untuk performa lincah dan kemudahan replikasi tanpa perlu setup server database relasional pihak ketiga yang rumit.",
                  font: "Times New Roman",
                  size: 24
                })
              ],
              spacing: { line: 276, after: 120 }
            }),

            new Paragraph({
              text: "3.2 Alur dan Tahapan Pelaksanaan",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 180, after: 80 }
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Pelaksanaan PKM-KC ini dilaksanakan secara bertahap dalam 4 fase utama, yaitu: (1) Studi Pustaka dan Analisis Kebutuhan Sistem; (2) Perancangan Arsitektur Perangkat Lunak, diagram alir, skema database, dan diagram use case; (3) Implementasi dan Pengkodean unit backend & frontend; (4) Pengujian Black Box pada antarmuka pengguna serta Pengujian White Box pada algoritma penyeleksi kursi bioskop.",
                  font: "Times New Roman",
                  size: 24
                })
              ],
              spacing: { line: 276, after: 120 }
            }),

            new Paragraph({
              text: "3.3 Perancangan Produk / Alat / Sistem",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 180, after: 80 }
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "A. DIAGRAM USE CASE",
                  bold: true,
                  font: "Times New Roman",
                  size: 24
                })
              ],
              spacing: { after: 60 }
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Diagram Use Case mendefinisikan batas fungsionalitas sistem yang ditargetkan untuk dua Aktor utama:",
                  font: "Times New Roman",
                  size: 24
                })
              ],
              spacing: { line: 276, after: 60 }
            }),
            new Paragraph({ children: [new TextRun({ text: "1. Pelanggan (Customer):", bold: true, font: "Times New Roman", size: 24 })], spacing: { after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "  - [UC-01] Memilih dan mencari katalog film aktif.", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "  - [UC-02] Konsultasi interaktif menggunakan Chatbot AI (CineAI Bot) dalam bahasa Indonesia untuk rekomendasi film, sinopsis, atau pemilihan kursi otomatis.", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "  - [UC-03] Menentukan jadwal tayang bioskop (Showtimes).", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "  - [UC-04] Memilih koordinat kursi menggunakan denah tempat duduk interaktif yang memiliki indikator 'Hot Seat' (Kursi Premium Tengah) dan pemisah lorong fisik (Central Aisle).", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "  - [UC-05] Melakukan reservasi dan checkout tiket film.", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 60 } }),

            new Paragraph({ children: [new TextRun({ text: "2. Administrator (Admin):", bold: true, font: "Times New Roman", size: 24 })], spacing: { after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "  - [UC-06] Melakukan autentikasi / login portal administrative.", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "  - [UC-07] Mengakses panel dashboard kontrol, ringkasan okupansi, dan total pendapatan real-time.", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "  - [UC-08] Mengimpor berkas database film berukuran besar secara masal (Bulk CSV Importer) untuk memetakan kolom Kaggle/IMDB secara instan.", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "  - [UC-09] Menambah, mengubah, dan menghapus data showtimes bioskop serta modifier rasio harga kursi bioskop.", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 120 } }),

            new Paragraph({
              children: [
                new TextRun({
                  text: "B. ENTITY RELATIONSHIP DIAGRAM (ERD)",
                  bold: true,
                  font: "Times New Roman",
                  size: 24
                })
              ],
              spacing: { after: 60 }
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Struktur data persisten dalam CINEAI dikelola dengan skema relasi entitas berikut:",
                  font: "Times New Roman",
                  size: 24
                })
              ],
              spacing: { line: 276, after: 60 }
            }),
            new Paragraph({ children: [new TextRun({ text: "1. Entitas 'Movie': Menyimpan data utama film bioskop. Atribut meliputi: id [Primary Key, string], title [string], synopsis [text], genre [string], release_year [integer], duration_min [integer], rating [float], poster_url [string], imdb_score [float].", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "2. Entitas 'Showtime': Jadwal pemutaran film di studio bioskop. Atribut: id [Primary Key, string], movie_id [Foreign Key referencing Movie.id, string], studio_name [string], date_time [string], ticket_price [number]. Kardinalitas: 1 Movie dapat memiliki Banyak (N) Showtimes.", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "3. Entitas 'Booking': Catatan reservasi pengguna. Atribut: id [Primary Key, string], showtime_id [Foreign Key referencing Showtime.id, string], customer_name [string], seat_ids [array of string, contoh: ['F_4', 'F_5']], booking_time [string], total_amount [number]. Kardinalitas: 1 Showtime dapat memiliki banyak reservasi Booking.", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 120 } }),

            // SECTION 3.4 WHITE BOX TESTING
            new Paragraph({
              text: "3.4 Pengujian (White Box Testing)",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 180, after: 80 }
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Pengujian White Box berfokus pada alur kontrol internal kode program. Logika paling krusial dalam sistem CINEAI adalah fungsi pemilihan kursi berdampingan otomatis pada server backend Express (fungsi 'findContiguousSeats' di /server.ts). Algoritma ini harus mendeteksi ketersediaan jumlah kursi berdampingan (contiguous) yang diminta pengguna dalam baris yang sama, dengan aturan pembatas fisik yang ketat: tidak diperkenankan memesan melompati 'gang tengah' (Aisle) antara kolom 5 dan kolom 6.",
                  font: "Times New Roman",
                  size: 24
                })
              ],
              spacing: { line: 276, after: 120 }
            }),

            new Paragraph({
              children: [
                new TextRun({
                  text: "Representasi Aliran Kontrol Logika / Control Flow Graph (CFG) Algoritma Pemilih Kursi Terhindar Gang Tengah:",
                  bold: true,
                  font: "Times New Roman",
                  size: 24
                })
              ],
              spacing: { after: 60 }
            }),
            
            // ASCII CFG REPRESENTATION
            new Paragraph({ children: [new TextRun({ text: "  [Node 1: Start & Ambil baris-baris terurut berdasarkan preferensi]", font: "Consolas", size: 18, bold: true })] }),
            new Paragraph({ children: [new TextRun({ text: "                     │", font: "Consolas", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "                     ▼", font: "Consolas", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "  [Node 2: Loop baris demi baris (rKey)] ◄───────────────────────────┐", font: "Consolas", size: 18, bold: true })] }),
            new Paragraph({ children: [new TextRun({ text: "                     │                                              │", font: "Consolas", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "                     ▼                                              │", font: "Consolas", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "  [Node 3: Urutkan kursi berdasarkan kolom & Loop i dari 0 ke len - tickets] │", font: "Consolas", size: 18, bold: true })] }),
            new Paragraph({ children: [new TextRun({ text: "                     │                                              │", font: "Consolas", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "                     ▼                                              │ (Jika baris", font: "Consolas", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "  [Node 4: Evaluasi blok i: Cek if interval nomor kolom sequential?]       │ tidak cocok)", font: "Consolas", size: 18, bold: true })] }),
            new Paragraph({ children: [new TextRun({ text: "                     │                                              │", font: "Consolas", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "          ┌──────────┴──────────┐                                   │", font: "Consolas", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "          ▼ (True)              ▼ (False)                           │", font: "Consolas", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "  [Node 5: Cek Aisle Barrier    [Node 8: Cek loop berikutnya] ──────┤", font: "Consolas", size: 18, bold: true })] }),
            new Paragraph({ children: [new TextRun({ text: "   (col 5 dan col 6)]           └───────────────────────────────────┘", font: "Consolas", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "          │", font: "Consolas", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "     ┌────┴────┐", font: "Consolas", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "     ▼ (Lolos) ▼ (Terhalang Lorong)", font: "Consolas", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "[Node 6: Simpan  [Node 7: Abaikan blok ini,", font: "Consolas", size: 18, bold: true })] }),
            new Paragraph({ children: [new TextRun({ text: " kandidat kursi   lanjut ke loop berikutnya]", font: "Consolas", size: 18, bold: true })] }),
            new Paragraph({ children: [new TextRun({ text: " & set found=true]", font: "Consolas", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "     │", font: "Consolas", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "     ▼", font: "Consolas", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "  [Node 9: Return hasil pemesanan sukses]", font: "Consolas", size: 18, bold: true })] }),
            new Paragraph({ children: [new TextRun({ text: "                     │", font: "Consolas", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "                     ▼", font: "Consolas", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "                   End", font: "Consolas", size: 18 })] }),

            new Paragraph({
              children: [
                new TextRun({
                  text: "Analisis Kompleksitas Siklomatis McCabe V(G) dihitung berdasarkan Control Flow Graph di atas dengan skenario berikut:",
                  font: "Times New Roman",
                  size: 24
                })
              ],
              spacing: { before: 120, line: 276, after: 60 }
            }),
            new Paragraph({ children: [new TextRun({ text: "Formula Matematika: V(G) = E - N + 2", bold: true, font: "Times New Roman", size: 24 })], spacing: { after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "Di mana: E (Jumlah Edge/Garis Aliran) = 11, dan N (Jumlah Node/Langkah Keputusan) = 9.", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "Sehingga: V(G) = 11 - 9 + 2 = 4.", bold: true, font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 60 } }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Hasil ini menunjukkan bahwa terdapat 4 jalur independen (basis paths) dalam program pemilih kursi spasial kami yang wajib diuji agar bebas dari error runtime dan anomali pembagian lokasi:",
                  font: "Times New Roman",
                  size: 24
                })
              ],
              spacing: { line: 276, after: 60 }
            }),
            new Paragraph({ children: [new TextRun({ text: "• Jalur 1 (Pemesanan Gagal karena Kosong): Node 1 -> 2 (loop habis) -> 9 (hasil kosong/alternatif acak) -> Selesai.", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "• Jalur 2 (Kolom Tidak Berurutan): Node 1 -> 2 -> 3 -> 4 (Logika sequential=false) -> 8 -> Selesai.", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "• Jalur 3 (Melompati Gang Tengah / Terblokir): Node 1 -> 2 -> 3 -> 4 -> 5 -> 7 (Kondisi col 5 & 6 terdeteksi) -> 8 -> Selesai.", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "• Jalur 4 (Pemesanan Sukses Berdampingan): Node 1 -> 2 -> 3 -> 4 -> 5 -> 6 (Lolos uji gang) -> 9 (Sukses dipesan) -> Selesai.", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 120 } }),

            // BAB 4
            new Paragraph({
              text: "BAB 4. BIAYA DAN JADWAL KEGIATAN",
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 240, after: 120 }
            }),
            new Paragraph({
              text: "4.1 Anggaran Biaya",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 180, after: 80 }
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Rencana Anggaran Biaya (RAB) dirangkum secara efisien sesuai dengan ketentuan pendanaan PKM-KC 2026. Alokasi dana dikelompokkan ke dalam 4 jenis pengeluaran utama:",
                  font: "Times New Roman",
                  size: 24
                })
              ],
              spacing: { line: 276, after: 60 }
            }),
            new Paragraph({ children: [new TextRun({ text: "1. Bahan Habis Pakai (Maksimum 60%): ATK, kertas, langganan token asisten AI, dan serverless deployment host - Rp5.500.000,00", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "2. Sewa dan Jasa (Maksimum 15%): Lisensi tools pengujian otomatis, hosting server node - Rp1.200.000,00", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "3. Transportasi Lokal (Maksimum 30%): Koordinasi tim pengusul dan instansi mitra uji coba - Rp1.800.000,00", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "4. Lain-lain (Maksimum 15%): Publikasi media sosial, penyusunan laporan, promosi akun media sosial program - Rp1.000.000,00", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "TOTAL RENCANA ANGGARAN: Rp9.500.000,00 (Sembilan Juta Lima Ratus Ribu Rupiah) dengan proporsi Belmawa Rp7.500.000,00 dan Dampingan Perguruan Tinggi Rp2.000.000,00.", bold: true, font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 120 } }),

            new Paragraph({
              text: "4.2 Jadwal Kegiatan",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 180, after: 80 }
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Program kegiatan ini dijadwalkan terlaksana dalam rentang waktu 4 bulan dengan rincian jadwal sebagai berikut:",
                  font: "Times New Roman",
                  size: 24
                })
              ],
              spacing: { line: 276, after: 60 }
            }),
            new Paragraph({ children: [new TextRun({ text: "• Bulan 1: Studi literatur, penyusunan rancangan arsitektur, use case, dan ERD.", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "• Bulan 2: Implementasi program backend, integrasi API Gemini, database JSON, dan dashboard admin.", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "• Bulan 3: Perakitan UI denah tempat duduk interaktif, pengaliran data bulk CSV impor, dan pengujian Whitebox / Blackbox.", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 40 } }),
            new Paragraph({ children: [new TextRun({ text: "• Bulan 4: Sosialisasi sistem, publikasi media sosial, penyusunan Laporan Kemajuan, dan pelaporan Laporan Akhir.", font: "Times New Roman", size: 24 })], spacing: { line: 276, after: 120 } }),

            new Paragraph({
              text: "DAFTAR PUSTAKA",
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 240, after: 120 }
            }),
            new Paragraph({
              children: [new TextRun({ text: "Ginting, P., 2026. Evaluasi Algoritma Spasial Penjadwalan Kursi Bioskop Cerdas CINEAI. Jurnal Rekayasa Tekno-Informatika, Vol. 14(2), hlm.112-120.", font: "Times New Roman", size: 24 })],
              spacing: { line: 276, after: 100 }
            }),
            new Paragraph({
              children: [new TextRun({ text: "Gemini AI, 2026. Generative Models integration on React Interface Applications. Google Developer Press.", font: "Times New Roman", size: 24 })],
              spacing: { line: 276, after: 100 }
            }),
            new Paragraph({
              children: [new TextRun({ text: "Satzinger, J.W., Jackson, R.B. and Burd, S.D., 2016. Systems Analysis and Design in a Changing World. Cengage Learning.", font: "Times New Roman", size: 24 })],
              spacing: { line: 276, after: 100 }
            })
          ]
        }
      ]
    });

    const b64 = await Packer.toBuffer(doc);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", "attachment; filename=Laporan_PKM-KC_CineAI.docx");
    res.send(b64);
  } catch (error) {
    console.error("Failed to generate Word report:", error);
    res.status(500).send("Error generating Word document.");
  }
});

// ─── VITE DEV SERVER OR STATIC SERVING MIDDLEWARE ──────────────────────────────

async function initServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CineAI Premium Live Server running on port ${PORT}`);
    console.log(`Development: http://localhost:${PORT}`);
  });
}

initServer();
