import React, { useState, useEffect } from "react";
import CustomerKiosk from "./customerpage/CustomerKiosk";
import AdminConsole from "./adminpage/AdminConsole";

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener("popstate", handleLocationChange);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  const isAdminRoute = currentPath.startsWith("/admin");

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col font-sans selection:bg-zinc-900 selection:text-white print:p-0">
      {isAdminRoute ? (
        /* MURNI HALAMAN ADMIN */
        <main className="flex-1 relative z-10 flex flex-col overflow-hidden bg-zinc-50 print:bg-white">
          {/* Subtle switcher back to Customer view */}
          <div className="shrink-0 bg-white border-b border-zinc-200 px-6 py-2.5 flex justify-between items-center text-xs text-zinc-500 print:hidden">
            <span className="font-mono text-[10px] tracking-wider uppercase text-zinc-400 font-bold">CineAI Administration Console</span>
            <button
              onClick={() => {
                window.history.pushState({}, "", "/");
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
              className="px-3 py-1 text-[10px] font-bold rounded bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 text-zinc-800 transition cursor-pointer uppercase tracking-wider"
            >
              ◄ Kembali ke Kiosk Customer
            </button>
          </div>
          <AdminConsole />
        </main>
      ) : (
        /* MURNI HALAMAN CUSTOMER */
        <>
          {/* Header Customer - Clean Minimalist (Airbnb Style Reference) */}
          <header className="relative z-20 shrink-0 border-b border-zinc-100 bg-white/90 backdrop-blur-md px-6 sm:px-12 py-4 flex items-center justify-between print:hidden">
            <div className="flex items-center gap-10">
              {/* Logo */}
              <div 
                className="flex items-center gap-2.5 cursor-pointer"
                onClick={() => {
                  window.history.pushState({}, "", "/");
                  window.dispatchEvent(new PopStateEvent("popstate"));
                }}
              >
                <div className="w-8 h-8 rounded bg-black flex items-center justify-center font-black text-xs text-white">
                  C
                </div>
                <span className="text-sm font-display font-black tracking-[0.2em] text-black">
                  CINEAI
                </span>
              </div>

              {/* Minimal Menu Links */}
              <nav className="hidden md:flex items-center gap-8 text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                <span className="text-black hover:text-black transition cursor-pointer">NOW SHOWING</span>
                <span className="hover:text-black transition cursor-pointer">AI RECOMMENDATION</span>
                <span className="hover:text-black transition cursor-pointer">FAST CHECKOUT</span>
              </nav>
            </div>
          </header>

          <main className="flex-1 relative z-10 flex flex-col overflow-hidden bg-white print:p-0">
            <CustomerKiosk />
          </main>
        </>
      )}
    </div>
  );
}
