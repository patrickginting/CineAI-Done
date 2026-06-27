import React, { useState, useCallback } from "react";
import { Sparkles, ArrowRight, Loader2, Mic } from "lucide-react";
import { Movie } from "../types";
import { fetchAIRecommendations, parseVoiceBookingRequest } from "../api";

interface AIAssistantProps {
  onSelectMovie: (movie: Movie) => void;
  onVoiceBooking?: (parsedData: {
    matched_movie_id: string | null;
    matched_showtime_id: string | null;
    num_seats: number;
    seat_preference: string;
    navigation_message: string;
  }) => void;
}

const SUGGESTIONS = [
  "Pesan tiket Dune 2 orang baris belakang jam 19:15",
  "Pesan film Inside Out sepasang tiket di baris tengah",
  "Rekomendasi film petualangan sci-fi luar angkasa",
  "Film keluarga yang lucu dan hangat"
];

export default function AIAssistant({ onSelectMovie, onVoiceBooking }: AIAssistantProps) {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [infoMsg, setInfoMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition / mikrofon tidak didukung di browser ini, atau diblokir izinnya. Silakan ketik perintah suara Anda di kolom pencarian!");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setInfoMsg("Mendengarkan suara Anda...");
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error", event);
      setIsListening(false);
      setInfoMsg("Gagal mengakses mikrofon.");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      handleSearch(transcript);
    };

    recognition.start();
  };

  const handleSearch = useCallback(async (queryText: string) => {
    if (!queryText.trim()) return;
    setLoading(true);
    setSearched(true);
    setInfoMsg("");
    setResults([]);

    const qLower = queryText.toLowerCase();
    const isBookingIntent = ["pesan", "booking", "beli", "tiket", "kursi", "orang", "seat", "book", "reserve", "tonton", "showtime", "tayang", "studio", "nonton"].some(kw => qLower.includes(kw));

    if (isBookingIntent && onVoiceBooking) {
      try {
        setInfoMsg("Asisten AI Gemini menganalisis perintah booking suara...");
        const responseData = await parseVoiceBookingRequest(queryText);
        setInfoMsg(responseData.navigation_message);
        
        setTimeout(() => {
          onVoiceBooking(responseData);
        }, 300);
      } catch (e: any) {
        console.error(e);
        setInfoMsg("Gagal memproses rincian booking suara. Mencari kecocokan umum...");
        
        try {
          const data = await fetchAIRecommendations(queryText);
          setResults(data.recommendations || []);
          setInfoMsg(data.message || "");
        } catch (err) {
          setInfoMsg("Terjadi kendala pada server asisten AI.");
        }
      } finally {
        setLoading(false);
      }
    } else {
      // Reguler Movie Matcher Search
      try {
        const data = await fetchAIRecommendations(queryText);
        setResults(data.recommendations || []);
        setInfoMsg(data.message || "");
      } catch (e: any) {
        console.error(e);
        setInfoMsg("Menghubungkan asisten AI offline...");
      } finally {
        setLoading(false);
      }
    }
  }, [onVoiceBooking]);

  return (
    <div className="max-w-4xl mx-auto bg-white border border-zinc-200 rounded-xl p-5 shadow-sm relative overflow-hidden text-left">
      
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded bg-black flex items-center justify-center text-white">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <h4 className="font-display font-bold text-sm text-zinc-900 tracking-tight">CineAI Asisten Pintar</h4>
          <p className="text-[11px] text-zinc-500">Pencarian film adaptif & navigasi booking langsung didukung oleh Gemini AI</p>
        </div>
      </div>

      {/* Input query field representing the Search bar */}
      <div className="relative flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-lg p-2">
        <button
          onClick={startListening}
          className={`p-1.5 rounded transition-all cursor-pointer ${
            isListening 
              ? "bg-red-500 text-white animate-pulse" 
              : "text-zinc-400 hover:text-black hover:bg-zinc-100"
          }`}
          title="Voice Guided Booking (Bicara dalam bahasa Indonesia)"
        >
          <Mic className="w-4 h-4" />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch(input)}
          placeholder={isListening ? "Mendengarkan... Silakan bicara!" : "Coba katikan: 'Pesan film Dune 2 tiket baris belakang'..."}
          className="flex-1 bg-transparent text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none px-1"
        />
        <button
          onClick={() => handleSearch(input)}
          disabled={loading || !input.trim()}
          className="flex items-center gap-1 bg-black hover:bg-zinc-800 text-white text-[11px] font-bold px-4 py-2 rounded disabled:opacity-40 transition-all cursor-pointer uppercase tracking-wider"
        >
          {loading ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" /> Membaca...
            </>
          ) : (
            <>
              Tanya AI <Sparkles className="w-3 h-3" />
            </>
          )}
        </button>
      </div>

      {/* Suggestion Chips */}
      <div className="flex flex-wrap gap-1.5 mt-2.5 cursor-pointer">
        {SUGGESTIONS.map((text, i) => (
          <button
            key={i}
            onClick={() => {
              setInput(text);
              handleSearch(text);
            }}
            className="text-[10px] text-zinc-500 hover:text-black hover:border-zinc-400 bg-white border border-zinc-200 px-3 py-1 rounded transition-all"
          >
            {text}
          </button>
        ))}
      </div>

      {/* Dynamic Recommendation Shelf Output */}
      {searched && (
        <div className="mt-5 border-t border-zinc-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs">
            <span className="text-zinc-400 font-bold uppercase tracking-wider text-[9px]">Hasil Pencarian AI:</span>
            {infoMsg && <span className="text-zinc-800 font-mono text-[10px] bg-zinc-100 px-2.5 py-0.5 rounded border border-zinc-200">{infoMsg}</span>}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-zinc-400 text-xs gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-900" />
              <span>Memproses filter bioskop...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {results.map((m) => (
                <div
                  key={m.id}
                  onClick={() => onSelectMovie(m)}
                  className="group flex gap-3 bg-white border border-zinc-200 hover:border-black rounded p-3 cursor-pointer transition-all hover:bg-zinc-50"
                >
                  <img
                    src={m.poster_url}
                    alt={m.title}
                    className="w-12 h-16 object-cover rounded flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-between text-left">
                    <div>
                      <h5 className="text-xs font-bold text-zinc-900 truncate">
                        {m.title}
                      </h5>
                      <p className="text-[10px] text-zinc-400 mt-0.5 truncate">{m.genre}</p>
                    </div>
                    <div className="flex items-center justify-between text-[10px] mt-1 font-bold">
                      <span className="text-zinc-900 bg-zinc-100 px-1.5 py-0.5 rounded">★ {m.imdb_score}</span>
                      <span className="text-black group-hover:translate-x-1 transition-transform flex items-center gap-0.5 font-bold uppercase tracking-wider text-[9px]">
                        Pesan <ArrowRight className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-5 text-xs text-zinc-400">
              Tidak ada film yang cocok. Coba kata kunci genre lain seperti "sci-fi", "family", "comedy", atau "thriller".
            </div>
          )}
        </div>
      )}
    </div>
  );
}
