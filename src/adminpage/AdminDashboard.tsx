import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Building, Film, DollarSign, Percent, Plus, Trash2, Edit2, Play, 
  RefreshCw, Sliders, Upload, ToggleLeft, ToggleRight, Sparkles, Calendar, Clock 
} from "lucide-react";
import Papa from "papaparse";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Movie, Studio, Showtime, PricingModifier, DashboardStats } from "../types";
import { 
  fetchMovies, adminAddMovie, adminUpdateMovie, adminDeleteMovie, 
  adminBulkAddMovies, fetchAdminDashboard, fetchAdminModifiers, toggleAdminModifier,
  fetchStudios, adminAddShowtime, adminDeleteShowtime, adminResetShowtimeSeats, fetchShowtimes
} from "../api";

const EMPTY_MOVIE_FORM = {
  title: "",
  synopsis: "",
  genre: "Sci-Fi",
  release_year: 2026,
  duration_min: 120,
  rating: 8.0,
  poster_url: "",
  imdb_score: 8.0
};

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"stats" | "movies" | "pricing" | "bulk" | "schedules">("stats");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [modifiers, setModifiers] = useState<PricingModifier[]>([]);
  
  // New States for Schedules & Showtimes
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [showtimesLoading, setShowtimesLoading] = useState(false);
  const [submittingShowtime, setSubmittingShowtime] = useState(false);
  const [showtimeForm, setShowtimeForm] = useState({
    movie_id: "",
    studio_id: "",
    date: "2026-06-23",
    time: "19:00",
    base_price: 50000
  });

  const [movieForm, setMovieForm] = useState(EMPTY_MOVIE_FORM);
  const [editingMovieId, setEditingMovieId] = useState<string | null>(null);
  
  const [bulkMovies, setBulkMovies] = useState<any[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  // Load All data with useCallback
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await fetchAdminDashboard();
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadMoviesList = useCallback(async () => {
    try {
      const data = await fetchMovies();
      setMovies(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadModifiers = useCallback(async () => {
    try {
      const data = await fetchAdminModifiers();
      setModifiers(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadShowtimesAndStudios = useCallback(async () => {
    setShowtimesLoading(true);
    try {
      const allShowtimes = await fetchShowtimes();
      setShowtimes(allShowtimes);
      const allStudios = await fetchStudios();
      setStudios(allStudios);
      
      // Auto pre-populate form selections if empty
      const firstMovieId = movies[0]?.id || "";
      const firstStudioId = allStudios[0]?.id || "";
      setShowtimeForm(prev => ({
        ...prev,
        movie_id: prev.movie_id || firstMovieId,
        studio_id: prev.studio_id || firstStudioId
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setShowtimesLoading(false);
    }
  }, [movies]);

  useEffect(() => {
    loadStats();
    loadMoviesList();
    loadModifiers();
  }, [loadStats, loadMoviesList, loadModifiers]);

  useEffect(() => {
    if (activeTab === "schedules" || movies.length > 0) {
      loadShowtimesAndStudios();
    }
  }, [activeTab, movies, loadShowtimesAndStudios]);

  const handleCreateShowtime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showtimeForm.movie_id || !showtimeForm.studio_id || !showtimeForm.date || !showtimeForm.time) {
      alert("Mohon isi semua bidang jadwal!");
      return;
    }
    setSubmittingShowtime(true);
    try {
      const isoDateTimeStr = `${showtimeForm.date}T${showtimeForm.time}:00`;
      await adminAddShowtime({
        movie_id: showtimeForm.movie_id,
        studio_id: showtimeForm.studio_id,
        start_time: isoDateTimeStr,
        base_price: Number(showtimeForm.base_price)
      });
      alert("Jadwal tayang berhasil ditambahkan!");
      loadShowtimesAndStudios();
      loadStats();
    } catch (err: any) {
      alert(err.message || "Gagal membuat jadwal tayang");
    } finally {
      setSubmittingShowtime(false);
    }
  };

  const handleDeleteShowtime = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus jadwal tayang ini? Semua pesanan/booking aktif untuk jam ini akan terhapus secara permanen.")) return;
    try {
      await adminDeleteShowtime(id);
      alert("Jadwal tayang berhasil dihapus!");
      loadShowtimesAndStudios();
      loadStats();
    } catch (err: any) {
      alert(err.message || "Gagal menghapus jadwal");
    }
  };

  const handleResetSeats = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin me-reset kursi untuk jadwal tayang ini? Seluruh pemesanan (booking) di jam ini akan dihapus sehingga seluruh kursi kembali kosong (available).")) return;
    try {
      await adminResetShowtimeSeats(id);
      alert("Seluruh kursi berhasil di-reset menjadi kosong!");
      loadShowtimesAndStudios();
      loadStats();
    } catch (err: any) {
      alert(err.message || "Gagal me-reset kursi");
    }
  };

  // Recharts Chart Dataset Memoization using useMemo
  const chartData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Active Movies", count: stats.total_movies, fill: "#8b5cf6" },
      { name: "Showtimes", count: stats.total_showtimes, fill: "#ec4899" },
      { name: "Total Bookings", count: stats.total_bookings, fill: "#06b6d4" }
    ];
  }, [stats]);

  // Movie CRUD Form Submission Handler
  const handleSaveMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMovieId) {
        await adminUpdateMovie(editingMovieId, movieForm);
      } else {
        await adminAddMovie(movieForm);
      }
      setMovieForm(EMPTY_MOVIE_FORM);
      setEditingMovieId(null);
      loadMoviesList();
      loadStats();
    } catch (err: any) {
      alert(err.message || "Failed to save movie");
    }
  };

  const handleEditMovie = (m: Movie) => {
    setEditingMovieId(m.id);
    setMovieForm({
      title: m.title,
      synopsis: m.synopsis,
      genre: m.genre,
      release_year: m.release_year,
      duration_min: m.duration_min,
      rating: m.rating,
      poster_url: m.poster_url,
      imdb_score: m.imdb_score
    });
  };

  const handleDeleteMovie = async (id: string) => {
    if (!window.confirm("Warning: Deleting this movie will cancel and cascade delete all its connected showtimes! Proceed?")) return;
    try {
      await adminDeleteMovie(id);
      loadMoviesList();
      loadStats();
    } catch (err: any) {
      alert(err.message || "Failed to delete movie");
    }
  };

  // Toggle dynamic multiplier modifier status
  const handleToggleModifier = async (mod: PricingModifier) => {
    try {
      const nextStatus = !mod.is_active;
      await toggleAdminModifier(mod.id, nextStatus);
      setModifiers(prev => prev.map(m => m.id === mod.id ? { ...m, is_active: nextStatus } : m));
    } catch (e) {
      alert("Failed to update pricing modifier status.");
    }
  };

  // Papaparse CSV Loader Logic mapping IMDb/Kaggle columns intelligently
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkStatus("");
    setBulkError("");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (result) => {
        try {
          const parsedRows = result.data.map((row: any) => {
            // Intelligent column header matching
            const title = String(row.title || row.Series_Title || row.Title || "Untitled Movie");
            const synopsis = String(row.synopsis || row.Overview || row.synopsis_text || "No description loaded.");
            const genre = String(row.genre || row.Genre || "Drama");
            const release_year = Number(row.release_year || row.Released_Year || row.Year || 2026);
            const duration_min = Number(row.duration_min || row.Runtime || row.Duration || 120);
            const rating = Number(row.rating || row.IMDB_Rating || row.imdb_score || 8.0);
            const poster_url = String(row.poster_url || row.Poster_Link || row.poster || "https://images.unsplash.com/photo-1547483238-f400e65ccd56?q=80&w=600&auto=format&fit=crop");
            const imdb_score = Number(row.imdb_score || row.IMDB_Rating || rating || 8.0);

            return { title, synopsis, genre, release_year, duration_min, rating, poster_url, imdb_score };
          });

          setBulkMovies(parsedRows);
          setBulkStatus(`Loaded ${parsedRows.length} potential movie listings from CSV. Review the preview list below and import.`);
        } catch (error) {
          setBulkError("Structured parse error. Check CSV column mappings.");
        }
      },
      error: () => {
        setBulkError("PapaParse failure reading file format.");
      }
    });
  };

  const handleBulkSubmit = async () => {
    if (bulkMovies.length === 0) return;
    setBulkLoading(true);
    setBulkStatus("");
    try {
      const insertedCount = await adminBulkAddMovies(bulkMovies);
      setBulkStatus(`Successfully imported ${insertedCount} films into CineAI theater records active list!`);
      setBulkMovies([]);
      loadMoviesList();
      loadStats();
    } catch (e: any) {
      setBulkError(e.message || "Import failure");
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="bg-zinc-50 text-zinc-900 min-h-screen border-t border-zinc-200 p-4 sm:p-6 lg:p-8">
      
      {/* Header section admin */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-zinc-200 mb-8 gap-4">
        <div>
          <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest font-bold flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5" /> MODUL ADMINISTRATOR
          </span>
          <h1 className="text-3xl font-display font-black text-black tracking-tight mt-1 flex items-center gap-2">
            CineAI Dashboard Operator
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Sistem kontrol basis data, pengelolaan film, jadwal tayang, dan tarif harga dinamis</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href="/api/download-report"
            download="Laporan_PKM-KC_CineAI.docx"
            className="flex items-center gap-2 bg-black hover:bg-zinc-800 text-xs px-4 py-2.5 rounded text-white font-bold tracking-wide transition shadow-sm cursor-pointer border border-zinc-900 uppercase"
          >
            <Sparkles className="w-3.5 h-3.5 text-zinc-200" /> Unduh Laporan (.docx)
          </a>
          <button
            onClick={() => { loadStats(); loadMoviesList(); loadModifiers(); }}
            className="flex items-center gap-2 bg-white border border-zinc-200 hover:border-zinc-400 text-xs px-3.5 py-2 rounded text-zinc-700 hover:text-black transition cursor-pointer font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${statsLoading ? "animate-spin" : ""}`} /> Muat Ulang Logs
          </button>
        </div>
      </div>

      {/* Tabs list container */}
      <div className="flex border-b border-zinc-200 mb-6 gap-1 overflow-x-auto pb-1.5">
        {[
          { key: "stats", label: "Analitik & Ringkasan", icon: Building },
          { key: "movies", label: "Kelola Film (CRUD)", icon: Film },
          { key: "schedules", label: "Jadwal & Studio", icon: Calendar },
          { key: "pricing", label: "Pricing Multiplier", icon: Sliders },
          { key: "bulk", label: "Pengunggah CSV Massal", icon: Upload }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded text-xs font-bold whitespace-nowrap transition cursor-pointer border
              ${activeTab === tab.key 
                ? "bg-black border-black text-white" 
                : "border-zinc-200 bg-white text-zinc-500 hover:text-black hover:border-zinc-400"
              }
            `}
          >
            <tab.icon className="w-3.5 h-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT ANALYTICS */}
      {activeTab === "stats" && (
        <div className="space-y-6 animate-fade-in">
          
          {/* PKM-KC 2026 Template Report Announcement Banner */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            
            <div className="space-y-1 relative z-10">
              <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-[0.2em] font-bold">
                BERKAS DRAF PROPOSAL PKM-KC 2026 SIAP DIUNDUH
              </span>
              <h3 className="text-base font-extrabold text-zinc-900 tracking-tight">
                CeneAI Laporan Karsa Cipta (Format MS Word)
              </h3>
              <p className="text-xs text-zinc-600 max-w-xl leading-relaxed">
                Struktur laporan akademik lengkap telah dirancang secara presisi menggunakan template usulan PKM-KC 2026. Mencakup pemodelan <strong className="text-zinc-950 font-bold">Use Case Diagram</strong>, skema keterhubungan <strong className="text-zinc-950 font-bold">ERD (Skema Relasi)</strong>, serta analisis <strong className="text-zinc-950 font-bold">White Box Testing (Uji Aliran Control Flow Graph, Kompleksitas Siklomatis McCabe, & Basis Paths)</strong> pada algoritma penanganan gang lorong (Aisle Barrier).
              </p>
            </div>
            
            <div className="relative z-10 shrink-0">
              <a
                href="/api/download-report"
                download="Laporan_PKM-KC_CineAI.docx"
                className="inline-flex items-center gap-2 bg-black hover:bg-zinc-800 text-xs font-bold text-white px-5 py-3 rounded transition cursor-pointer border border-black uppercase tracking-wider"
              >
                <Sparkles className="w-4 h-4 text-zinc-200" /> Unduh Dokumen (.docx)
              </a>
            </div>
          </div>

          {/* AI Predictor alerts drawer using server Gemini predictions */}
          {stats?.predicted_full_slot && (
            <div className="bg-white border border-zinc-200 rounded-xl p-4.5 flex gap-3.5 items-center relative overflow-hidden shadow-sm">
              <div className="w-9 h-9 rounded bg-black flex items-center justify-center text-white shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <span className="text-[9px] text-zinc-400 font-mono uppercase tracking-widest font-bold block">
                  Gemini Predictive Load Intelligence
                </span>
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-1">Prediksi Tingkat Kepadatan Jam Tayang Peak</h4>
                <p className="text-sm font-bold text-zinc-900 mt-1 select-all">{stats.predicted_full_slot}</p>
                <p className="text-[10px] text-zinc-400 mt-1">Faktor prediksi dihitung berdasarkan bobot historis transaksi, popularitas film, dan preferensi bangku.</p>
              </div>
            </div>
          )}

          {/* Metric Bento-Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-start text-zinc-400 mb-3 font-bold">
                <span className="text-[9px] uppercase font-mono tracking-wider">Total Judul Film</span>
                <Film className="w-4 h-4 text-zinc-900" />
              </div>
              <div className="text-3xl font-display font-black text-zinc-900">{stats?.total_movies || 0}</div>
              <p className="text-[10px] text-zinc-400 mt-1 font-mono">Entri basis data aktif</p>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-start text-zinc-400 mb-3 font-bold">
                <span className="text-[9px] uppercase font-mono tracking-wider">Total Jadwal Tayang</span>
                <Play className="w-4 h-4 text-zinc-900" />
              </div>
              <div className="text-3xl font-display font-black text-zinc-900">{stats?.total_showtimes || 0}</div>
              <p className="text-[10px] text-zinc-400 mt-1 font-mono">Slot tayang yang terpasang</p>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-start text-zinc-400 mb-3 font-bold">
                <span className="text-[9px] uppercase font-mono tracking-wider">Tingkat Okupansi</span>
                <Percent className="w-4 h-4 text-zinc-900" />
              </div>
              <div className="text-3xl font-display font-black text-zinc-900">
                {stats?.occupancy_rate ? `${stats.occupancy_rate.toFixed(1)}%` : "0%"}
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 font-mono">Rasio kursi dipesan vs kapasitas</p>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-start text-zinc-400 mb-3 font-bold">
                <span className="text-[9px] uppercase font-mono tracking-wider">Total Pendapatan (IDR)</span>
                <DollarSign className="w-4 h-4 text-zinc-950" />
              </div>
              <div className="text-2xl font-display font-black text-zinc-900 mt-1">
                Rp {stats?.revenue_today ? stats.revenue_today.toLocaleString("id-ID") : "0"}
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 font-mono">Akumulasi penerimaan tiket</p>
            </div>
          </div>

          {/* Graphical Analytics Chart */}
          <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-[10px] uppercase font-mono font-bold text-zinc-400 mb-4 tracking-wider">Perbandingan Metrik Utama</h3>
            <div className="h-64 mt-4 w-full">
              {stats ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
                    <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ background: "#ffffff", border: "1px solid #e4e4e7", borderRadius: "8px", color: "#09090b", fontSize: "12px" }}
                      cursor={{ fill: "rgba(0,0,0,0.02)" }}
                    />
                    <Bar dataKey="count" fill="#000000" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-zinc-400">Belum ada data grafik terkumpul.</div>
              )}
            </div>
            <div className="text-xs text-zinc-600 mt-4 bg-zinc-50 border border-zinc-200 rounded p-3">
              <span>Film paling populer saat ini: </span>
              <strong className="text-zinc-950 ml-1 font-bold">{stats?.most_booked_movie || "N/A"}</strong>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT FILM CRUD */}
      {activeTab === "movies" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          {/* CRUD Form Column */}
          <div className="lg:col-span-1 bg-white border border-zinc-200 rounded-xl p-5 h-fit shadow-sm">
            <h3 className="font-display font-black text-sm text-zinc-900 mb-4 uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4 text-black" /> {editingMovieId ? "Ubah Data Film" : "Tambah Data Film Baru"}
            </h3>

            <form onSubmit={handleSaveMovie} className="space-y-4 text-left">
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono tracking-wider mb-1 font-bold">Judul Film</label>
                <input
                  type="text" required
                  placeholder="Contoh: Interstellar"
                  value={movieForm.title}
                  onChange={(e) => setMovieForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full bg-white border border-zinc-200 rounded px-3.5 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-black font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono tracking-wider mb-1 font-bold">Kategori / Genre</label>
                <input
                  type="text" required
                  placeholder="Contoh: Sci-Fi / Drama"
                  value={movieForm.genre}
                  onChange={(e) => setMovieForm(p => ({ ...p, genre: e.target.value }))}
                  className="w-full bg-white border border-zinc-200 rounded px-3.5 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-black font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                 <div>
                  <label className="block text-[10px] text-zinc-500 uppercase font-mono tracking-wider mb-1 font-bold">Tahun Rilis</label>
                  <input
                    type="number" required
                    value={movieForm.release_year}
                    onChange={(e) => setMovieForm(p => ({ ...p, release_year: Number(e.target.value) }))}
                    className="w-full bg-white border border-zinc-200 rounded px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-black font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase font-mono tracking-wider mb-1 font-bold">Durasi (Menit)</label>
                  <input
                    type="number" required
                    value={movieForm.duration_min}
                    onChange={(e) => setMovieForm(p => ({ ...p, duration_min: Number(e.target.value) }))}
                    className="w-full bg-white border border-zinc-200 rounded px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-black font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono tracking-wider mb-1 font-bold">Skor IMDb</label>
                <input
                  type="number" required step="0.1" max="10"
                  value={movieForm.imdb_score}
                  onChange={(e) => setMovieForm(p => ({ ...p, imdb_score: Number(e.target.value), rating: Number(e.target.value) }))}
                  className="w-full bg-white border border-zinc-200 rounded px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-black font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono tracking-wider mb-1 font-bold">URL Poster Film</label>
                <input
                  type="text" required
                  placeholder="Tempel URL poster..."
                  value={movieForm.poster_url}
                  onChange={(e) => setMovieForm(p => ({ ...p, poster_url: e.target.value }))}
                  className="w-full bg-white border border-zinc-200 rounded px-3.5 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-black font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono tracking-wider mb-1 font-bold">Sinopsis / Alur Cerita</label>
                <textarea
                  required rows={3}
                  value={movieForm.synopsis}
                  onChange={(e) => setMovieForm(p => ({ ...p, synopsis: e.target.value }))}
                  placeholder="Ringkasan cerita film..."
                  className="w-full bg-white border border-zinc-200 rounded px-3.5 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-black font-medium resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  id="save-movie-btn"
                  className="flex-1 bg-black hover:bg-zinc-800 text-white font-bold text-xs py-3 rounded cursor-pointer uppercase tracking-wider transition-all"
                >
                  {editingMovieId ? "Simpan Perubahan" : "Daftarkan Film Baru"}
                </button>
                {editingMovieId && (
                  <button
                    type="button"
                    onClick={() => { setEditingMovieId(null); setMovieForm(EMPTY_MOVIE_FORM); }}
                    className="border border-zinc-200 text-zinc-600 px-4 py-3 rounded text-xs hover:text-black font-bold uppercase transition"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Film Rows Listing Column */}
          <div className="lg:col-span-2 space-y-3.5 max-h-[580px] overflow-y-auto pr-1">
            <h3 className="font-display font-black text-xs text-zinc-400 mb-2 uppercase tracking-wider text-left">Daftar Katalog Bioskop</h3>
            {movies.map((m) => (
              <div
                key={m.id}
                className="flex gap-4 p-4 bg-white border border-zinc-200 rounded-xl hover:border-black transition shadow-sm text-left"
              >
                <img
                  src={m.poster_url}
                  alt={m.title}
                  className="w-14 h-20 object-cover rounded flex-shrink-0"
                />
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <h4 className="font-display font-bold text-sm text-zinc-950 truncate">{m.title}</h4>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5">{m.genre} · {m.release_year} · {m.duration_min} Menit</p>
                    <p className="text-[10px] text-zinc-600 line-clamp-2 mt-1 leading-relaxed">{m.synopsis}</p>
                  </div>

                  <div className="flex items-center justify-between text-xs mt-2 pt-1 border-t border-zinc-100">
                    <span className="text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded font-bold text-[10px]">★ {m.imdb_score} IMDb</span>
                    <div className="flex gap-3 font-bold uppercase tracking-wider text-[10px]">
                      <button
                        onClick={() => handleEditMovie(m)}
                        className="text-zinc-500 hover:text-black flex items-center gap-1 cursor-pointer"
                        title="Edit Film Card info"
                      >
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteMovie(m.id)}
                        className="text-red-500 hover:text-red-700 flex items-center gap-1 cursor-pointer"
                        title="Hapus film & jadwal terkait"
                      >
                        <Trash2 className="w-3 h-3" /> Hapus
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT MULTIPLIERS */}
      {activeTab === "pricing" && (
        <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-6 animate-fade-in shadow-sm">
          <div className="text-left">
            <h3 className="font-display font-black text-zinc-950 mb-1 uppercase tracking-wider">Aturan Kelipatan Harga Dinamis (Pricing Multipliers)</h3>
            <p className="text-xs text-zinc-500">Penyesuaian tarif tiket bioskop diaplikasikan secara berurutan saat pemesanan. Aktifkan/nonaktifkan pemicu secara langsung.</p>
          </div>

          <div className="grid gap-4">
            {modifiers.map((mod) => (
              <div
                key={mod.id}
                className="flex items-center justify-between p-4 bg-white border border-zinc-200 hover:border-black rounded-xl transition shadow-sm text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-100 border border-zinc-200 rounded flex items-center justify-center text-zinc-900">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-950">{mod.label}</h4>
                    <span className="text-[10px] text-zinc-500 font-mono mt-0.5 inline-block font-bold">KATEGORI: {mod.modifier_type.toUpperCase()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Multiplier tag */}
                  <span className="text-xs font-mono font-black text-zinc-900 bg-zinc-100 px-3 py-1 rounded border border-zinc-200">
                    {mod.multiplier === 1.15 ? "Premium Seat" : ""} ×{mod.multiplier.toFixed(2)}
                  </span>

                  {/* Toggle */}
                  <button
                    onClick={() => handleToggleModifier(mod)}
                    className="hover:scale-105 transition-transform cursor-pointer"
                    id={`toggle-${mod.id}`}
                    title={`Toggle ${mod.label}`}
                  >
                    {mod.is_active ? (
                      <ToggleRight className="w-10 h-10 text-black" />
                    ) : (
                      <ToggleLeft className="w-10 h-10 text-zinc-400" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT BULK IMPORTER */}
      {activeTab === "bulk" && (
        <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-6 animate-fade-in shadow-sm">
          <div className="text-left">
            <h3 className="font-display font-black text-zinc-950 mb-1 uppercase tracking-wider">Pengunggah CSV Massal Katalog Film</h3>
            <p className="text-xs text-zinc-500">Mendukung unggah instan via tarik-dan-taruh (drag and drop) berkas CSV data film massal dengan format terstruktur otomatis.</p>
          </div>

          <div className="bg-zinc-50 border-2 border-dashed border-zinc-300 rounded-xl p-8 hover:border-black transition text-center relative">
            <input
              type="file" required accept=".csv"
              onChange={handleCSVUpload}
              id="csv-file-picker"
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            
            <Upload className="w-10 h-10 mx-auto text-zinc-400 mb-3" />
            <h4 className="text-sm font-bold text-zinc-800">Pilih Dokumen spreadsheet (.csv)</h4>
            <p className="text-xs text-zinc-500 mt-1">Sistem mendukung unggah massal hingga batas 5.000 judul catalog sekaligus.</p>
          </div>

          {bulkStatus && (
            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded text-zinc-800 text-xs font-bold text-left">
              {bulkStatus}
            </div>
          )}

          {bulkError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded text-red-600 text-xs font-bold text-left">
              {bulkError}
            </div>
          )}

          {bulkMovies.length > 0 && (
            <div className="space-y-4">
              <h5 className="text-xs font-display font-black uppercase text-zinc-400 text-left">Pratinjau Data Unggahan (Menampilkan 5 Baris Teratas)</h5>
              <div className="overflow-x-auto border border-zinc-200 rounded-lg shadow-sm">
                <table className="w-full text-xs text-zinc-700 text-left bg-white">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-mono font-bold">
                      <th className="p-3">Judul Film</th>
                      <th className="p-3">Genre</th>
                      <th className="p-3">Tahun</th>
                      <th className="p-3">Durasi</th>
                      <th className="p-3">IMDb Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkMovies.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-zinc-100">
                        <td className="p-3 font-bold text-zinc-900">{row.title}</td>
                        <td className="p-3">{row.genre}</td>
                        <td className="p-3">{row.release_year}</td>
                        <td className="p-3">{row.duration_min} min</td>
                        <td className="p-3 text-zinc-900 font-bold">★ {row.imdb_score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={handleBulkSubmit}
                disabled={bulkLoading}
                className="w-full bg-black hover:bg-zinc-800 text-white font-bold text-xs py-3 rounded hover:opacity-90 transition flex items-center justify-center gap-1 cursor-pointer uppercase tracking-wider"
              >
                {bulkLoading ? "Memproses Batch Upload..." : `Setujui & Unggah Masal ${bulkMovies.length} Film Ke Server`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT SCHEDULES & SHOWTIMES (Atur Jadwal & Studio + Reset Kursi) */}
      {activeTab === "schedules" && (
        <div className="space-y-6 animate-fade-in text-left">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Col: Add Showtime Form */}
            <div className="bg-white border border-zinc-200 p-6 rounded-xl h-fit space-y-4 shadow-sm text-left">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-zinc-100 text-zinc-900 rounded">
                  <Calendar className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-zinc-950 uppercase tracking-tight">Atur Jam Tayang</h3>
                  <p className="text-[10px] text-zinc-500 font-bold">Buat atau tentukan jam tayang film</p>
                </div>
              </div>

              <form onSubmit={handleCreateShowtime} className="space-y-4">
                {/* Select Movie */}
                <div className="space-y-1">
                  <label className="text-xs text-zinc-500 font-bold">Pilih Film</label>
                  <select
                    value={showtimeForm.movie_id}
                    onChange={(e) => setShowtimeForm({ ...showtimeForm, movie_id: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded p-2.5 text-xs text-zinc-900 focus:border-black focus:outline-none font-medium"
                    required
                  >
                    <option value="">-- Pilih Film --</option>
                    {movies.map(m => (
                      <option key={m.id} value={m.id}>{m.title} ({m.duration_min} min)</option>
                    ))}
                  </select>
                </div>

                {/* Select Studio */}
                <div className="space-y-1">
                  <label className="text-xs text-zinc-500 font-bold">Pilih Studio</label>
                  <select
                    value={showtimeForm.studio_id}
                    onChange={(e) => setShowtimeForm({ ...showtimeForm, studio_id: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded p-2.5 text-xs text-zinc-900 focus:border-black focus:outline-none font-medium"
                    required
                  >
                    <option value="">-- Pilih Studio --</option>
                    {studios.map(s => (
                      <option key={s.id} value={s.id}>{s.name} (Kapasitas: {s.capacity} Kursi)</option>
                    ))}
                  </select>
                </div>

                {/* Date & Time Input */}
                <div className="grid grid-cols-2 gap-3 text-left">
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-500 font-bold">Tanggal Tayang</label>
                    <input
                      type="date"
                      value={showtimeForm.date}
                      onChange={(e) => setShowtimeForm({ ...showtimeForm, date: e.target.value })}
                      className="w-full bg-white border border-zinc-200 rounded p-2.5 text-xs text-zinc-900 focus:border-black focus:outline-none font-medium"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-500 font-bold">Jam Mulai</label>
                    <input
                      type="time"
                      value={showtimeForm.time}
                      onChange={(e) => setShowtimeForm({ ...showtimeForm, time: e.target.value })}
                      className="w-full bg-white border border-zinc-200 rounded p-2.5 text-xs text-zinc-900 focus:border-black focus:outline-none font-medium"
                      required
                    />
                  </div>
                </div>

                {/* Base Price Input */}
                <div className="space-y-1 text-left">
                  <label className="text-xs text-zinc-500 font-bold">Harga Dasar Tiket (IDR)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-zinc-400 font-bold font-mono">Rp</span>
                    <input
                      type="number"
                      value={showtimeForm.base_price}
                      onChange={(e) => setShowtimeForm({ ...showtimeForm, base_price: Number(e.target.value) })}
                      className="w-full bg-white border border-zinc-200 rounded py-2.5 pl-8 pr-3 text-xs text-zinc-900 focus:border-black focus:outline-none font-mono font-medium"
                      min="1000"
                      step="5000"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submittingShowtime}
                  className="w-full py-3 bg-black hover:bg-zinc-800 transition text-xs font-bold text-white rounded cursor-pointer disabled:opacity-45 uppercase tracking-wider"
                >
                  {submittingShowtime ? "Sedang Menyimpan..." : "Rilis Jadwal Tayang"}
                </button>
              </form>
            </div>

            {/* Right Cols: Showtime Logs & Seat Resets */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center pr-1 text-left">
                <div>
                  <h3 className="text-sm font-black text-zinc-950 uppercase tracking-tight">Log & Kontrol Jadwal Tayang</h3>
                  <p className="text-[10px] text-zinc-500 font-bold">Reset kursi terisi, dan pantau status keterisian studio</p>
                </div>
                <button
                  onClick={loadShowtimesAndStudios}
                  className="px-3.5 py-2 border border-zinc-200 hover:border-zinc-400 bg-white rounded text-xs text-zinc-700 hover:text-black transition flex items-center gap-1 cursor-pointer font-semibold"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${showtimesLoading ? "animate-spin" : ""}`} /> Segarkan
                </button>
              </div>

              {showtimesLoading ? (
                <div className="flex flex-col items-center justify-center p-20 gap-2 border border-zinc-200 bg-white rounded-xl shadow-sm">
                  <RefreshCw className="w-8 h-8 animate-spin text-zinc-900" />
                  <span className="text-xs text-zinc-500">Membaca jadwal & studio...</span>
                </div>
              ) : showtimes.length === 0 ? (
                <div className="text-center p-16 border border-zinc-200 bg-white rounded-xl text-zinc-500 text-xs shadow-sm">
                  Belum ada jadwal tayang aktif yang terpasang di bioskop. Gunakan formulir di samping untuk merilis jadwal baru!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {showtimes.map((st) => {
                    const tDate = new Date(st.start_time);
                    const formattedDate = tDate.toLocaleDateString("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    });
                    const formattedTime = tDate.toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit"
                    });

                    return (
                      <div
                        key={st.id}
                        className="bg-white border border-zinc-200 hover:border-black p-5 rounded-xl flex flex-col justify-between gap-4 transition-all shadow-sm text-left"
                      >
                        <div className="space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <h4 className="font-bold text-sm text-zinc-950 line-clamp-1">{st.movie?.title || "Unknown Movie"}</h4>
                              <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{st.movie?.genre}</p>
                            </div>
                            <span className="bg-zinc-100 text-zinc-900 font-bold font-mono text-[9px] px-2 py-1 rounded border border-zinc-200 uppercase shrink-0">
                              {st.studio?.name || "Studio"}
                            </span>
                          </div>

                          <div className="bg-zinc-50 rounded p-3 border border-zinc-100 space-y-1.5 text-[11px]">
                            <div className="flex items-center gap-1.5 text-zinc-700">
                              <Calendar className="w-3.5 h-3.5 text-zinc-900" />
                              <span className="font-medium">{formattedDate}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-zinc-700">
                              <Clock className="w-3.5 h-3.5 text-zinc-900" />
                              <span className="font-bold font-mono">{formattedTime} WIB</span>
                            </div>
                            <div className="flex justify-between items-center pt-1 border-t border-zinc-200 mt-1 text-[10px]">
                              <span className="text-zinc-500 font-bold">Harga Tiket Dasar:</span>
                              <span className="text-zinc-900 font-bold font-mono">Rp {st.base_price.toLocaleString("id-ID")}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-2 font-bold uppercase tracking-wider text-[9px]">
                          <button
                            type="button"
                            onClick={() => handleResetSeats(st.id)}
                            className="bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 hover:border-zinc-400 text-zinc-800 py-2 rounded transition cursor-pointer flex items-center justify-center gap-1 font-bold"
                            title="Reset seluruh pesanan kursi untuk jam tayang ini"
                          >
                            <RefreshCw className="w-3 h-3" /> Reset Kursi
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteShowtime(st.id)}
                            className="bg-white hover:bg-red-50 border border-zinc-200 hover:border-red-300 text-zinc-600 hover:text-red-600 py-2 rounded transition cursor-pointer flex items-center justify-center gap-1 font-bold"
                            title="Hapus jadwal tayang & seluruh pesanan di jam ini"
                          >
                            <Trash2 className="w-3 h-3" /> Hapus Jadwal
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
