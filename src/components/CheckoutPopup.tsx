import React, { useState, useEffect } from "react";
import { Ticket, X, Calendar, MapPin, User, CheckCircle2, ChevronRight, AlertTriangle, Loader2, Printer } from "lucide-react";
import { PriceQuoteResponse } from "../types";
import { fetchPriceQuote, createBooking } from "../api";

interface CheckoutPopupProps {
  showtimeId: string;
  movieTitle: string;
  studioName: string;
  startTime: string;
  selectedSeatIds: string[]; // ["D_5", "A_1"]
  onClose: () => void;
  onSuccess: () => void;
}

export default function CheckoutPopup({
  showtimeId,
  movieTitle,
  studioName,
  startTime,
  selectedSeatIds,
  onClose,
  onSuccess
}: CheckoutPopupProps) {
  const [name, setName] = useState("");
  const [quote, setQuote] = useState<PriceQuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [successTicket, setSuccessTicket] = useState<any | null>(null);
  const [errMsg, setErrMsg] = useState("");

  const formattedTime = new Date(startTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  const formattedDate = new Date(startTime).toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  // Calculate live dynamic totals
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchPriceQuote(showtimeId, selectedSeatIds)
      .then((data) => {
        if (active) setQuote(data);
      })
      .catch((err) => {
        console.error(err);
        if (active) setErrMsg("Gagal mengambil kalkulasi harga tiket.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [showtimeId, selectedSeatIds]);

  const handlePayment = async () => {
    if (!name.trim()) {
      setErrMsg("Mohon masukkan nama lengkap pemesan.");
      return;
    }
    setPaying(true);
    setErrMsg("");
    try {
      const response = await createBooking(showtimeId, selectedSeatIds, name);
      setSuccessTicket(response.bookings[0]);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setErrMsg(err.message || "Gagal mengunci kursi. Kursi mungkin sudah dipesan oleh orang lain.");
    } finally {
      setPaying(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print:fixed print:inset-0 print:bg-white print:z-[9999] print:p-0 print:m-0 print:flex print:items-start print:justify-center">
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-6 shadow-xl relative overflow-visible text-zinc-900 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-zinc-100 relative z-10 print:hidden">
          <h3 className="font-display font-bold text-base text-zinc-900 flex items-center gap-2">
            <Ticket className="w-4 h-4 text-black" /> Checkout Tiket
          </h3>
          <button
            onClick={onClose}
            id="close-checkout"
            className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-900 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successTicket ? (
          /* Premium Monochrome Physical Thermal Ticket Card with barcode */
          <div className="text-center py-2 relative z-10">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-zinc-100 border border-zinc-200 rounded-full text-zinc-900 mb-3 animate-bounce print:hidden">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            
            <h4 className="text-lg font-display font-black text-zinc-900 print:hidden">
              Pemesanan Berhasil!
            </h4>
            <p className="text-xs text-zinc-500 mt-1 mb-5 print:hidden">Tiket fisik Anda telah diproses dan siap dicetak</p>

            {/* Thermal Ticket Design Container */}
            <div className="printable-receipt bg-zinc-50 border border-zinc-200 rounded-xl p-5 mb-5 text-left relative overflow-hidden font-mono text-zinc-900 shadow-sm print:bg-white print:border-zinc-900">
              {/* Receipt cutouts */}
              <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full border-r border-zinc-200 print:hidden" />
              <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full border-l border-zinc-200 print:hidden" />
              
              <div className="border-b border-dashed border-zinc-300 pb-3 mb-4 text-center">
                <span className="text-[12px] font-black tracking-widest block text-zinc-900 uppercase">CINEAI BIOSKOP</span>
                <span className="text-[9px] text-zinc-500 block mt-0.5">TIKET BOOKING RESMI</span>
                <span className="text-[9px] text-zinc-400 font-mono block mt-1">ID: {successTicket.id}</span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-sans font-bold block">Film</span>
                  <span className="font-bold text-sm text-zinc-900 font-sans">{movieTitle}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-sans font-bold block">Tanggal</span>
                    <span className="font-semibold text-zinc-800 text-[11px]">{formattedDate}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-sans font-bold block">Jam Tayang</span>
                    <span className="font-bold text-zinc-900 text-[11px]">{formattedTime} WIB</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-sans font-bold block">Studio</span>
                    <span className="font-semibold text-zinc-800 text-[11px]">{studioName}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-sans font-bold block">Kursi (Seats)</span>
                    <span className="font-bold text-black text-xs tracking-wider">{(successTicket.seat_ids || []).map((s: string) => s.replace("_", "")).join(", ")}</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-zinc-300 pt-3">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-sans font-bold block">Nama Pemesan</span>
                  <span className="font-medium text-zinc-800 text-[11px]">{successTicket.customer_name}</span>
                </div>
              </div>

              {/* Total Paid block */}
              <div className="border-t border-dashed border-zinc-300 mt-4 pt-3 flex justify-between items-center">
                <span className="text-[10px] text-zinc-500 uppercase font-sans font-bold">TOTAL BAYAR</span>
                <span className="font-black text-sm text-zinc-950 font-sans">
                  Rp {Number(successTicket.final_price).toLocaleString("id-ID")}
                </span>
              </div>

              {/* QR Code / Barcode Minimalist Styling Placeholder for physical touch */}
              <div className="mt-5 pt-4 border-t border-zinc-200 flex flex-col items-center justify-center gap-2">
                {/* Barcode generator in raw CSS */}
                <div className="w-full h-8 flex items-center justify-center gap-[2px] bg-white p-1 rounded border border-zinc-100 max-w-[200px]">
                  {[3,1,4,2,1,3,2,4,1,2,3,1,4,2,1,2,3,1,4,2,3,1].map((w, i) => (
                    <div 
                      key={i} 
                      className="bg-zinc-900 h-full" 
                      style={{ width: `${w}px` }} 
                    />
                  ))}
                </div>
                <span className="text-[8px] text-zinc-400 tracking-[0.2em]">{successTicket.id.substring(0, 12).toUpperCase()}</span>
              </div>
            </div>

            {/* Print & Return Control Buttons */}
            <div className="space-y-2 mt-5 print:hidden">
              <button
                onClick={handlePrint}
                className="w-full bg-black hover:bg-zinc-800 text-white font-bold text-xs py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4" /> Cetak Tiket Fisik
              </button>
              
              <button
                onClick={onClose}
                className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 font-bold text-xs py-3 rounded-xl transition cursor-pointer"
              >
                Kembali ke Jadwal Film
              </button>
            </div>
          </div>
        ) : (
          /* Normal Checkout Flow */
          <div className="relative z-10 space-y-4">
            
            {/* Short Showtime Specs */}
            <div className="flex gap-3 bg-zinc-50 border border-zinc-200 rounded-xl p-3">
              <div className="bg-zinc-900 text-white p-2 rounded-lg flex items-center justify-center flex-shrink-0">
                <Ticket className="w-4 h-4" />
              </div>
              <div className="min-w-0 text-left">
                <h4 className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider">Ringkasan Pemesanan</h4>
                <div className="font-bold text-xs text-zinc-900 truncate mt-0.5">{movieTitle}</div>
                <p className="text-[10px] text-zinc-500 mt-0.5">{studioName} · {formattedDate} @ {formattedTime}</p>
              </div>
            </div>

            {/* Display Selected Seats */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-left">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block mb-1">Kursi yang dipesan ({selectedSeatIds.length})</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {selectedSeatIds.map(seat => (
                  <span key={seat} className="text-xs bg-black text-white font-mono font-bold px-2.5 py-1 rounded">
                    {seat.replace("_", "")}
                  </span>
                ))}
              </div>
            </div>

            {/* Price Calculations breakdown load box */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3 relative min-h-[120px] flex flex-col justify-between">
              
              {loading ? (
                <div className="flex flex-col items-center justify-center py-6 text-zinc-500 text-xs gap-1.5 absolute inset-0 bg-white/90 rounded-xl">
                  <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Kalkulasi harga tiket dinamis...</span>
                </div>
              ) : null}

              {quote ? (
                <>
                  {/* Seat-by-seat breakdown */}
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1 text-left">
                    {quote.breakdown.map((rowItem) => (
                      <div key={rowItem.seat_id} className="flex justify-between items-center text-xs">
                        <span className="text-zinc-600 font-mono">
                          Kursi {rowItem.seat_id.replace("_", "")} 
                          {rowItem.seat_type === "hot" ? (
                            <span className="text-zinc-900 font-bold ml-1.5 px-1 py-0.5 bg-zinc-200/60 rounded text-[9px]">Hot Seat</span>
                          ) : (
                            <span className="text-zinc-400 text-[10px] ml-1.5">Standar</span>
                          )}
                        </span>
                        <span className="font-mono font-bold text-zinc-900">
                          Rp {rowItem.final_price.toLocaleString("id-ID")}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Pricing Modifiers List applied */}
                  {quote.applied_rules.length > 0 && (
                    <div className="border-t border-zinc-200 pt-2.5 text-left">
                      <p className="text-[9px] text-zinc-400 uppercase tracking-wider mb-1.5 font-bold">Multiplier Dinamis Yang Berlaku</p>
                      <div className="flex flex-wrap gap-1">
                        {quote.applied_rules.map((rule, idx) => (
                          <span
                            key={idx}
                            className="text-[9px] bg-zinc-200 text-zinc-800 px-2 py-0.5 rounded font-bold"
                          >
                            {rule}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary Footer */}
                  <div className="border-t border-zinc-200 pt-3 flex justify-between items-center">
                    <span className="text-xs text-zinc-500 uppercase font-bold">Total Pembayaran</span>
                    <span className="font-display font-black text-base text-zinc-900">
                      Rp {quote.final_price.toLocaleString("id-ID")}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-xs text-zinc-400">Menghitung rincian tiket...</div>
              )}
            </div>

            {/* Error notifications */}
            {errMsg && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs text-left font-medium">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{errMsg}</span>
              </div>
            )}

            {/* Ticketholder name input */}
            <div className="space-y-1.5 text-left">
              <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Nama Lengkap Pemesan</label>
              <input
                type="text"
                placeholder="Masukkan nama lengkap Anda..."
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errMsg) setErrMsg("");
                }}
                className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-800 transition-all font-medium"
              />
            </div>

            {/* CTAs */}
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={onClose}
                className="flex-1 border border-zinc-200 hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 text-xs font-bold py-3 rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handlePayment}
                disabled={paying || loading || !name.trim()}
                className="flex-1 bg-black hover:bg-zinc-800 disabled:opacity-40 text-white text-xs font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                {paying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memproses...
                  </>
                ) : (
                  <>
                    Konfirmasi Booking <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
