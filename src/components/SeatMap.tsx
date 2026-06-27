import React, { useMemo } from "react";
import { ShowtimeSeat } from "../types";
import { Music, AlertCircle } from "lucide-react";

interface SeatMapProps {
  showtimeSeats: ShowtimeSeat[];
  selectedSeatIds: string[]; // store local seat codes like "row_col", e.g., ["A_5"]
  onToggleSeat: (seatCode: string) => void;
}

const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

// Check if seat is in the hot premium zone
const isHotZone = (row: string, col: number): boolean => {
  return ["D", "E", "F", "G"].includes(row) && [5, 6].includes(col);
};

export default function SeatMap({ showtimeSeats, selectedSeatIds, onToggleSeat }: SeatMapProps) {
  // Convert list to lookup map: key "row_col" -> ShowtimeSeat
  const seatsLookup = useMemo(() => {
    const map: Record<string, ShowtimeSeat> = {};
    showtimeSeats.forEach((ss) => {
      map[ss.seat_id] = ss; // e.g. "D_5"
    });
    return map;
  }, [showtimeSeats]);

  return (
    <div className="flex flex-col items-center select-none py-4 bg-white">
      {/* Curved Cinematic Projection Screen Design - Minimalist Noir style */}
      <div className="relative w-full max-w-lg mb-8">
        <div className="w-full h-2 bg-black rounded" />
        <p className="text-center text-[9px] text-zinc-400 font-display font-bold tracking-[0.25em] uppercase mt-2">
          LAYAR UTAMA BIOSKOP (SCREEN)
        </p>
      </div>

      {/* Surround Speakers Layout Markers */}
      <div className="flex justify-between w-full max-w-lg px-4 mb-4 text-[9px] text-zinc-400 tracking-wider font-bold">
        <div className="flex items-center gap-1">
          <Music className="w-3 h-3 text-zinc-400" />
          <span>Surround Sound Left</span>
        </div>
        <span className="font-mono text-zinc-300">Dolby Atmos Audio</span>
        <div className="flex items-center gap-1">
          <span>Surround Sound Right</span>
          <Music className="w-3 h-3 text-zinc-400" />
        </div>
      </div>

      {/* Seating Grid Structure */}
      <div className="space-y-1.5 mb-6">
        {[...ROWS].reverse().map((row) => (
          <div key={row} className="flex items-center gap-2">
            {/* Left Row Identifier */}
            <span className="w-4 text-center text-xs text-zinc-400 font-mono font-black">{row}</span>

            {/* Left Aisle spacer */}
            <span className="w-1.5" />

            {/* Left Side: Seat Columns 1-5 */}
            <div className="flex gap-1.5">
              {Array.from({ length: 5 }, (_, i) => i + 1).map((col) => {
                const seatCode = `${row}_${col}`;
                const ss = seatsLookup[seatCode];
                const isOccupied = ss ? ss.status === "occupied" : false;
                const isSelected = selectedSeatIds.includes(seatCode);
                const isHot = isHotZone(row, col);

                return (
                  <button
                    key={col}
                    onClick={() => !isOccupied && onToggleSeat(seatCode)}
                    disabled={isOccupied}
                    id={`seat-${row}-${col}`}
                    className={`
                      w-7 h-7 rounded text-[9px] font-mono font-bold relative transition-all duration-100 cursor-pointer border
                      ${isOccupied 
                        ? "bg-zinc-100 border-zinc-200 text-zinc-300 cursor-not-allowed line-through" 
                        : isSelected
                          ? "bg-black border-black text-white scale-110"
                          : isHot
                            ? "bg-zinc-100 hover:bg-zinc-200 border-zinc-400 text-zinc-900"
                            : "bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-black hover:border-zinc-400"
                      }
                    `}
                    title={`Seat ${row}-${col} — ${isOccupied ? "Terisi" : isHot ? "Hot Zone (Premium)" : "Standar"}`}
                  >
                    {col}
                    {/* Seat bottom lip decoration */}
                    <span className={`absolute bottom-0.5 left-0.5 right-0.5 h-1 rounded-sm ${isSelected ? "bg-white/30" : isHot ? "bg-zinc-300" : "bg-zinc-100"}`} />
                  </button>
                );
              })}
            </div>

            {/* Middle Aisle (Gang / Jalan Tengah) */}
            <div className="w-5 flex items-center justify-center relative h-7">
              <span className="text-[7px] text-zinc-300 font-mono font-bold tracking-tight">AISLE</span>
            </div>

            {/* Right Side: Seat Columns 6-10 */}
            <div className="flex gap-1.5">
              {Array.from({ length: 5 }, (_, i) => i + 6).map((col) => {
                const seatCode = `${row}_${col}`;
                const ss = seatsLookup[seatCode];
                const isOccupied = ss ? ss.status === "occupied" : false;
                const isSelected = selectedSeatIds.includes(seatCode);
                const isHot = isHotZone(row, col);

                return (
                  <button
                    key={col}
                    onClick={() => !isOccupied && onToggleSeat(seatCode)}
                    disabled={isOccupied}
                    id={`seat-${row}-${col}`}
                    className={`
                      w-7 h-7 rounded text-[9px] font-mono font-bold relative transition-all duration-100 cursor-pointer border
                      ${isOccupied 
                        ? "bg-zinc-100 border-zinc-200 text-zinc-300 cursor-not-allowed line-through" 
                        : isSelected
                          ? "bg-black border-black text-white scale-110"
                          : isHot
                            ? "bg-zinc-100 hover:bg-zinc-200 border-zinc-400 text-zinc-900"
                            : "bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-black hover:border-zinc-400"
                      }
                    `}
                    title={`Seat ${row}-${col} — ${isOccupied ? "Terisi" : isHot ? "Hot Zone (Premium)" : "Standar"}`}
                  >
                    {col}
                    {/* Seat bottom lip decoration */}
                    <span className={`absolute bottom-0.5 left-0.5 right-0.5 h-1 rounded-sm ${isSelected ? "bg-white/30" : isHot ? "bg-zinc-300" : "bg-zinc-100"}`} />
                  </button>
                );
              })}
            </div>

            {/* Right Aisle Spacer */}
            <span className="w-1.5" />

            {/* Right Row Identifier */}
            <span className="w-4 text-center text-xs text-zinc-400 font-mono font-black">{row}</span>
          </div>
        ))}
      </div>

      {/* Grid Legend Panel */}
      <div className="flex flex-wrap items-center justify-center gap-4 bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5 text-xs text-zinc-500">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-white border border-zinc-200 inline-block" />
          <span>Kursi Standar (Rp 50.000)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-zinc-100 border border-zinc-400 inline-block" />
          <span className="text-zinc-900 font-bold">Hot Seat Premium (Rp 75.000)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-black border border-black inline-block" />
          <span className="text-black font-bold">Pilihan Anda</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-zinc-100 border border-zinc-200 inline-block text-center line-through text-zinc-300 text-[8px]" />
          <span>Sudah Terisi</span>
        </div>
      </div>

      {/* Hot seat pricing notice */}
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 bg-zinc-50 border border-zinc-200 px-4 py-2 rounded mt-4">
        <AlertCircle className="w-3.5 h-3.5 text-black" />
        <span>Pilihan baris D5-D6, E5-E6, F5-F6, G5-G6 adalah baris pandangan terbaik (Hot Seats).</span>
      </div>
    </div>
  );
}
