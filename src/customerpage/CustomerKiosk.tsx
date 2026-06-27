import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, ArrowLeft, PlayCircle, Sparkles, Mic, ArrowRight } from "lucide-react";
import { Movie, Showtime, ShowtimeSeat } from "../types";
import { fetchMovies, fetchShowtimes, fetchSeatMap, fetchSmartSeatMatches } from "../api";
import AIAssistant from "../components/AIAssistant";
import SeatMap from "../components/SeatMap";
import CheckoutPopup from "../components/CheckoutPopup";

export default function CustomerKiosk() {
  const [moviesList, setMoviesList] = useState<Movie[]>([]);
  const [moviesLoading, setMoviesLoading] = useState(false);
  const [activeCarouselIdx, setActiveCarouselIdx] = useState(0);

  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);
  const [showtimesLoading, setShowtimesLoading] = useState(false);
  const [selectedShowtime, setSelectedShowtime] = useState<Showtime | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  
  const [seatsList, setSeatsList] = useState<ShowtimeSeat[]>([]);
  const [seatsLoading, setSeatsLoading] = useState(false);
  const [selectedSeatKeys, setSelectedSeatKeys] = useState<string[]>([]); // ["D_5", "E_6"]
  
  const [displayCheckout, setDisplayCheckout] = useState(false);

  // AI Smart Seating & Booking States
  const [seatMatcherLoading, setSeatMatcherLoading] = useState(false);
  const [aiMatcherExplanation, setAiMatcherExplanation] = useState("");
  const [matcherPreferenceText, setMatcherPreferenceText] = useState("");
  const [matcherSeatsCount, setMatcherSeatsCount] = useState(2);
  const [isListeningMatcher, setIsListeningMatcher] = useState(false);
  const [isVoiceGuidedRunning, setIsVoiceGuidedRunning] = useState(false);

  // Trigger Seat Matcher API and auto-select in UI
  const handleTriggerSeatMatcher = async (seatsNum: number, preferenceStr: string) => {
    if (!selectedShowtime) return;
    setSeatMatcherLoading(true);
    setAiMatcherExplanation("");
    try {
      const matchResult = await fetchSmartSeatMatches(selectedShowtime.id, seatsNum, preferenceStr);
      setSelectedSeatKeys(matchResult.matched_seats || []);
      setAiMatcherExplanation(matchResult.explanation);
    } catch (err: any) {
      console.error(err);
      setAiMatcherExplanation("Gagal memanggil asisten pemilihan kursi. Silakan pilih secara manual.");
    } finally {
      setSeatMatcherLoading(false);
    }
  };

  const startSpeechRecognitionForMatcher = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser Anda tidak mendukung Speech Recognition atau diblokir izinnya. Silakan ketik kriteria kursi!");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListeningMatcher(true);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Recognition Matcher Error", event);
      setIsListeningMatcher(false);
    };

    recognition.onend = () => {
      setIsListeningMatcher(false);
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setMatcherPreferenceText(transcript);
      handleTriggerSeatMatcher(matcherSeatsCount, transcript);
    };

    recognition.start();
  };

  // Handle automated voice guided booking navigations
  const handleVoiceBookingAction = async (parsedData: {
    matched_movie_id: string | null;
    matched_showtime_id: string | null;
    num_seats: number;
    seat_preference: string;
    navigation_message: string;
  }) => {
    if (!parsedData.matched_movie_id) return;
    setIsVoiceGuidedRunning(true);

    const targetMovie = moviesList.find(m => m.id === parsedData.matched_movie_id);
    if (targetMovie) {
      setSelectedMovie(targetMovie);
      setSelectedShowtime(null);
      setSeatsList([]);
      setSelectedSeatKeys([]);
      
      setShowtimesLoading(true);
      try {
        const list = await fetchShowtimes(targetMovie.id);
        setShowtimes(list);

        let activeSt = list[0];
        if (parsedData.matched_showtime_id) {
          const match = list.find(s => s.id === parsedData.matched_showtime_id);
          if (match) activeSt = match;
        }

        if (activeSt) {
          setSelectedShowtime(activeSt);
          setSeatsLoading(true);
          const seatLayout = await fetchSeatMap(activeSt.id);
          setSeatsList(seatLayout);

          // Auto trigger seat matcher
          const tickets = parsedData.num_seats || 1;
          const pref = parsedData.seat_preference || "any";
          setMatcherSeatsCount(tickets);
          setMatcherPreferenceText(pref);
          
          setSeatMatcherLoading(true);
          setAiMatcherExplanation("");
          try {
            const matchResult = await fetchSmartSeatMatches(activeSt.id, tickets, pref);
            setSelectedSeatKeys(matchResult.matched_seats || []);
            setAiMatcherExplanation(matchResult.explanation);
          } catch (smErr) {
            console.error(smErr);
          } finally {
            setSeatMatcherLoading(false);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setShowtimesLoading(false);
        setSeatsLoading(false);
        setIsVoiceGuidedRunning(false);
      }
    }
  };

  const loadInitialMovies = useCallback(async () => {
    setMoviesLoading(true);
    try {
      const data = await fetchMovies();
      setMoviesList(data);
    } catch (e) {
      console.error(e);
    } finally {
      setMoviesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialMovies();
  }, [loadInitialMovies]);

  // Handle active film selection -> trigger showtime loading
  const handleSelectMovie = async (m: Movie) => {
    setSelectedMovie(m);
    setSelectedShowtime(null);
    setSelectedDate("");
    setSeatsList([]);
    setSelectedSeatKeys([]);
    setShowtimesLoading(true);
    try {
      const list = await fetchShowtimes(m.id);
      setShowtimes(list);

      // Extract unique dates of showtimes
      const dates = list.map(st => new Date(st.start_time).toDateString());
      const uniqueDates = Array.from(new Set(dates));
      if (uniqueDates.length > 0) {
        const firstDate = uniqueDates[0];
        setSelectedDate(firstDate);
        
        // Auto-select the first timeslot belonging specifically to this first date
        const firstMatchingSt = list.find(st => new Date(st.start_time).toDateString() === firstDate);
        if (firstMatchingSt) {
          handleSelectShowtime(firstMatchingSt);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setShowtimesLoading(false);
    }
  };

  // Handle active timeslot selection -> trigger seat layout loading
  const handleSelectShowtime = async (st: Showtime) => {
    setSelectedShowtime(st);
    setSelectedSeatKeys([]);
    setSeatsLoading(true);
    try {
      const seatLayout = await fetchSeatMap(st.id);
      setSeatsList(seatLayout);
    } catch (e) {
      console.error(e);
    } finally {
      setSeatsLoading(false);
    }
  };

  // Switch selected date and auto-select first showtime of that date
  const handleDateChange = (dateStr: string) => {
    setSelectedDate(dateStr);
    const firstMatchingSt = showtimes.find(st => new Date(st.start_time).toDateString() === dateStr);
    if (firstMatchingSt) {
      handleSelectShowtime(firstMatchingSt);
    } else {
      setSelectedShowtime(null);
      setSelectedSeatKeys([]);
    }
  };

  const uniqueShowtimeDates = useMemo(() => {
    const dates = showtimes.map(st => new Date(st.start_time).toDateString());
    return Array.from(new Set(dates));
  }, [showtimes]);

  const filteredShowtimesByDate = useMemo(() => {
    if (!selectedDate) return showtimes;
    return showtimes.filter(st => new Date(st.start_time).toDateString() === selectedDate);
  }, [showtimes, selectedDate]);

  // Toggle seat choice
  const handleToggleSeat = useCallback((seatCode: string) => {
    setSelectedSeatKeys((prev) => {
      const exists = prev.includes(seatCode);
      if (exists) {
        return prev.filter(k => k !== seatCode);
      } else {
        return [...prev, seatCode];
      }
    });
  }, []);

  // Back to carousel
  const handleResetBookingMode = () => {
    setSelectedMovie(null);
    setSelectedShowtime(null);
    setSelectedDate("");
    setSeatsList([]);
    setSelectedSeatKeys([]);
    loadInitialMovies();
  };

  // Pricing based on rows
  const estimatedTicketCost = useMemo(() => {
    return selectedSeatKeys.reduce((acc, key) => {
      const isPremium = key.startsWith("A") || key.startsWith("B") || key.startsWith("C");
      const price = isPremium ? 75000 : 50000;
      return acc + price;
    }, 0);
  }, [selectedSeatKeys]);

  const currentCarouselMovie = moviesList[activeCarouselIdx];

  return (
    <div className="flex-1 flex flex-col justify-between overflow-y-auto relative bg-white text-zinc-950">
      
      {!selectedMovie ? (
        /* Movie Showcase Carousel List */
        <div className="relative z-10 p-6 sm:p-10 lg:p-14 max-w-7xl mx-auto w-full space-y-12 print:hidden">
          
          {moviesLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-400 text-xs gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-900" />
              <span>Membaca katalog bioskop modern...</span>
            </div>
          ) : moviesList.length > 0 ? (
            <>
              {/* Minimalist Hero Layout */}
              {currentCarouselMovie && (
                <div className="flex flex-col lg:flex-row items-stretch gap-10 lg:gap-16 min-h-[460px]">
                  
                  {/* Film Details */}
                  <div className="flex-1 flex flex-col justify-center space-y-6 text-left">
                    <div className="inline-flex w-fit items-center gap-1.5 px-3 py-1 bg-zinc-100 border border-zinc-200 text-zinc-900 rounded text-[9px] font-mono uppercase tracking-widest font-bold">
                      🎬 SEDANG TAYANG
                    </div>

                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-black text-black tracking-tight leading-none">
                      {currentCarouselMovie.title}
                    </h1>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-zinc-500">
                      <span className="text-zinc-900 bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded">
                        ★ {currentCarouselMovie.imdb_score} IMDb
                      </span>
                      <span className="border border-zinc-200 px-2.5 py-1 rounded">
                        {currentCarouselMovie.genre}
                      </span>
                      <span>{currentCarouselMovie.release_year}</span>
                      <span>{currentCarouselMovie.duration_min} Menit</span>
                    </div>

                    <p className="text-sm text-zinc-600 leading-relaxed max-w-xl font-normal">
                      {currentCarouselMovie.synopsis}
                    </p>

                    <div className="pt-2">
                      <button
                        onClick={() => handleSelectMovie(currentCarouselMovie)}
                        id="hero-book-btn"
                        className="px-8 py-3.5 text-xs font-extrabold text-white bg-black hover:bg-zinc-800 rounded transition-all cursor-pointer uppercase tracking-widest"
                      >
                        Pesan Tiket Sekarang
                      </button>
                    </div>
                  </div>

                  {/* Poster Graphics */}
                  <div className="w-[300px] aspect-[2/3] relative rounded overflow-hidden border border-zinc-200 shadow-sm shrink-0 mx-auto lg:mx-0">
                    <img
                      src={currentCarouselMovie.poster_url}
                      alt={currentCarouselMovie.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Minimalist AI Search Helper */}
              <div className="border-t border-zinc-100 pt-10">
                <AIAssistant onSelectMovie={handleSelectMovie} onVoiceBooking={handleVoiceBookingAction} />
              </div>

              {/* Grid movie selector thumbnail shelf */}
              <div className="space-y-4 pt-4">
                <h3 className="font-display font-bold text-[10px] text-zinc-400 uppercase tracking-widest">Katalog Film Tersedia</h3>
                
                <div className="flex gap-4 overflow-x-auto pb-4 cursor-pointer">
                  {moviesList.map((m, idx) => (
                    <div
                      key={m.id}
                      onClick={() => {
                        setActiveCarouselIdx(idx);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className={`
                        flex-shrink-0 w-36 rounded overflow-hidden border transition-all duration-200
                        ${idx === activeCarouselIdx 
                          ? "border-black scale-102 bg-zinc-50" 
                          : "border-zinc-100 opacity-50 hover:opacity-100"
                        }
                      `}
                    >
                      <img src={m.poster_url} alt={m.title} className="w-full h-48 object-cover" />
                      <div className="p-3 bg-white border-t border-zinc-100">
                        <h4 className="text-[11px] font-bold text-zinc-900 truncate">{m.title}</h4>
                        <p className="text-[9px] text-zinc-400 truncate mt-0.5">{m.genre}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-24 text-zinc-400 text-xs">Belum ada data film terdaftar di sistem.</div>
          )}
        </div>
      ) : (
        /* Selected Movie Seating Screen view */
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative print:hidden">
          
          {/* Back Exit Button */}
          <button
            onClick={handleResetBookingMode}
            className="absolute top-4 left-4 z-40 bg-white hover:bg-zinc-100 border border-zinc-200 px-4 py-2 rounded text-xs text-zinc-700 font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4 text-black" /> Kembali
          </button>

          {/* Left Panel: Movie Selection Details & Modifiers */}
          <div className="w-full lg:w-[420px] bg-zinc-50 border-r border-zinc-200 overflow-y-auto p-6 lg:p-8 pt-20 space-y-6 flex-shrink-0 text-left">
            
            {/* Minimal image layout */}
            <div className="relative rounded overflow-hidden aspect-[2/1] border border-zinc-200 shadow-sm">
              <img
                src={selectedMovie.poster_url}
                alt={selectedMovie.title}
                className="w-full h-full object-cover object-top"
              />
            </div>

            {/* Title details */}
            <div className="space-y-1">
              <h2 className="text-xl font-display font-black text-black leading-tight">{selectedMovie.title}</h2>
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider font-semibold">{selectedMovie.genre} · {selectedMovie.duration_min} Menit</p>
            </div>

            {/* Showtimes selectors */}
            <div className="space-y-5 border-t border-zinc-200 pt-5">
              <div>
                <h3 className="text-[9px] uppercase tracking-wider text-zinc-400 font-mono font-bold">1. Pilih Tanggal Tayang</h3>
                
                {showtimesLoading ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
                  </div>
                ) : uniqueShowtimeDates.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-2 mt-2">
                    {uniqueShowtimeDates.map((dateStr) => {
                      const isActive = selectedDate === dateStr;
                      const parsed = new Date(dateStr);
                      const dayName = parsed.toLocaleDateString("id-ID", { weekday: "short" });
                      const dayNum = parsed.toLocaleDateString("id-ID", { day: "numeric" });
                      const monthName = parsed.toLocaleDateString("id-ID", { month: "short" });

                      return (
                        <button
                          key={dateStr}
                          onClick={() => handleDateChange(dateStr)}
                          className={`
                            px-3.5 py-2 rounded flex flex-col items-center min-w-[72px] transition-all cursor-pointer select-none shrink-0 border
                            ${isActive 
                              ? "bg-black border-black text-white" 
                              : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:text-black"
                            }
                          `}
                        >
                          <span className={`text-[8px] uppercase tracking-wider font-mono font-bold ${isActive ? "text-zinc-300" : "text-zinc-400"}`}>{dayName}</span>
                          <span className="text-sm font-black mt-0.5">{dayNum}</span>
                          <span className={`text-[8px] mt-0.5 font-bold ${isActive ? "text-zinc-200" : "text-zinc-500"}`}>{monthName}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-500 font-mono mt-1">Belum tersedia jadwal penayangan.</p>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-[9px] uppercase tracking-wider text-zinc-400 font-mono font-bold">2. Pilih Jam Mulai & Studio</h3>
                
                {showtimesLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
                  </div>
                ) : filteredShowtimesByDate.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {filteredShowtimesByDate.map((st) => {
                      const isSelected = selectedShowtime?.id === st.id;
                      const tString = new Date(st.start_time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      });

                      return (
                        <button
                          key={st.id}
                          onClick={() => handleSelectShowtime(st)}
                          className={`
                            p-3 rounded border text-left transition-all cursor-pointer flex flex-col justify-between h-[74px]
                            ${isSelected 
                              ? "bg-black border-black text-white" 
                              : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:text-black"
                            }
                          `}
                        >
                          <div>
                            <div className="font-extrabold text-xs">{tString} WIB</div>
                            <div className={`text-[9px] font-bold mt-0.5 ${isSelected ? "text-zinc-300" : "text-zinc-400"}`}>{st.studio?.name || "Studio"}</div>
                          </div>
                          
                          <div className={`text-[10px] font-bold font-mono mt-1 text-right w-full ${isSelected ? "text-white" : "text-zinc-800"}`}>
                            Rp {st.base_price.toLocaleString()}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 font-mono">Tidak ada jadwal tayang aktif di tanggal terpilih.</p>
                )}
              </div>
            </div>

            {/* AI Smart Seat Matcher Controls */}
            {selectedShowtime && (
              <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-4 text-left">
                <div className="flex items-center gap-1.5 text-zinc-900 font-bold text-[10px] uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-black" />
                  <span>AI Rekomendasi Kursi</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] text-zinc-400 block font-bold uppercase tracking-wider">Jumlah Tiket</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setMatcherSeatsCount(n)}
                        className={`flex-1 py-1 px-2 rounded border text-center text-xs font-bold transition-all cursor-pointer ${
                          matcherSeatsCount === n 
                            ? "bg-black border-black text-white" 
                            : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Filter Presets */}
                <div className="space-y-1.5">
                  <label className="text-[9px] text-zinc-400 block font-bold uppercase tracking-wider">Kriteria Cepat</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: "🍿 Pojokan / Couple", val: "row belakang pojok untuk sepasang kekasih" },
                      { label: "✨ Pandangan Terbaik", val: "baris tengah untuk visual & akustik bioskop terbaik" },
                      { label: "🎭 Paling Dekat Layar", val: "baris depan yang super imersif dekat layar" },
                      { label: "🚪 Dekat Pintu Keluar", val: "sebelah gang jalan keluar atau sisi tepi" }
                    ].map(item => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          setMatcherPreferenceText(item.val);
                          handleTriggerSeatMatcher(matcherSeatsCount, item.val);
                        }}
                        className="text-[10px] bg-white border border-zinc-200 hover:border-zinc-400 px-2.5 py-1.5 rounded text-zinc-700 transition-all text-left truncate cursor-pointer font-medium"
                        title={item.val}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text input with Mic option */}
                <div className="relative flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded p-1 text-left">
                  <button
                    type="button"
                    onClick={startSpeechRecognitionForMatcher}
                    className={`flex-shrink-0 p-1.5 rounded transition-all cursor-pointer ${
                      isListeningMatcher 
                        ? "bg-red-500 text-white animate-pulse" 
                        : "text-zinc-500 hover:text-black hover:bg-zinc-100"
                    }`}
                    title="Bicara untuk set preferensi kursi"
                  >
                    <Mic className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="text"
                    placeholder={isListeningMatcher ? "Mendengarkan..." : "Atau ketik kriteria sendiri..."}
                    value={matcherPreferenceText}
                    onChange={(e) => setMatcherPreferenceText(e.target.value)}
                    className="flex-1 bg-transparent text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none px-1"
                    onKeyDown={(e) => e.key === "Enter" && handleTriggerSeatMatcher(matcherSeatsCount, matcherPreferenceText)}
                  />
                  <button
                    type="button"
                    disabled={seatMatcherLoading}
                    onClick={() => handleTriggerSeatMatcher(matcherSeatsCount, matcherPreferenceText)}
                    className="bg-black hover:bg-zinc-800 text-white rounded p-1.5 flex items-center justify-center disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    {seatMatcherLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Matches Explanation */}
                {aiMatcherExplanation && (
                  <div className="bg-zinc-50 border border-zinc-200 rounded p-3 space-y-1 text-left font-sans">
                    <span className="text-[9px] uppercase font-bold text-black tracking-wider block">Analisis CineAI:</span>
                    <p className="text-[11px] text-zinc-600 leading-relaxed mt-0.5">
                      {aiMatcherExplanation}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Live Pricing feedback summary */}
            {selectedShowtime && selectedSeatKeys.length > 0 && (
              <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3 shadow-sm">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500">Jumlah Kursi Terpilih</span>
                  <span className="font-bold text-zinc-900">{selectedSeatKeys.length} Tiket</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500">Nomor Kursi</span>
                  <span className="font-mono font-bold text-zinc-900">{selectedSeatKeys.map(s => s.replace("_", "")).join(", ")}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-zinc-100 pt-2.5">
                  <span className="text-zinc-500 font-bold">Total Harga</span>
                  <span className="font-bold font-mono text-zinc-900 text-sm">Rp {estimatedTicketCost.toLocaleString()}</span>
                </div>

                <button
                  onClick={() => setDisplayCheckout(true)}
                  id="checkout-trigger-btn"
                  className="w-full bg-black hover:bg-zinc-800 text-white text-xs font-black py-3.5 rounded transition-all cursor-pointer uppercase tracking-widest"
                >
                  Lanjut Ke Pembayaran
                </button>
              </div>
            )}
          </div>

          {/* Right Panel: Interactive Seat Map Grid */}
          <div className="flex-1 bg-white flex items-center justify-center p-6 lg:p-10 pt-20 overflow-y-auto">
            {selectedShowtime ? (
              <div className="w-full max-w-xl bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm relative">
                {(seatsLoading || seatMatcherLoading) ? (
                  <div className="flex flex-col items-center justify-center py-24 text-zinc-500 text-xs gap-2 absolute inset-0 bg-white/80 rounded-2xl z-10">
                    <Loader2 className="w-6 h-6 animate-spin text-zinc-900" />
                    <span>{seatMatcherLoading ? "Asisten AI sedang menyusun kursi terbaik..." : "Mengunduh status kursi..."}</span>
                  </div>
                ) : null}

                <SeatMap
                  showtimeSeats={seatsList}
                  selectedSeatIds={selectedSeatKeys}
                  onToggleSeat={handleToggleSeat}
                />
              </div>
            ) : (
              <div className="text-center py-24 text-zinc-400 space-y-3">
                <div className="w-12 h-12 bg-zinc-50 border border-zinc-200 rounded-full flex items-center justify-center mx-auto">
                  <PlayCircle className="w-5 h-5 text-zinc-400" />
                </div>
                <p className="text-xs font-medium">Silakan pilih tanggal & jam tayang film di panel kiri terlebih dahulu.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Popup Layer */}
      {displayCheckout && selectedMovie && selectedShowtime && (
        <CheckoutPopup
          showtimeId={selectedShowtime.id}
          movieTitle={selectedMovie.title}
          studioName={selectedShowtime.studio?.name || "Studio"}
          startTime={selectedShowtime.start_time}
          selectedSeatIds={selectedSeatKeys}
          onClose={() => setDisplayCheckout(false)}
          onSuccess={() => {
            handleSelectShowtime(selectedShowtime);
          }}
        />
      )}
    </div>
  );
}
