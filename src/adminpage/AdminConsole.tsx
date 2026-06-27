import React, { useState } from "react";
import { LogOut, Clapperboard } from "lucide-react";
import { adminLogin, adminRegister } from "../api";
import AdminDashboard from "./AdminDashboard";

export default function AdminConsole() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    return !!localStorage.getItem("cineai_session_token");
  });
  
  const [adminMail, setAdminMail] = useState("admin@cineai.com");
  const [adminPass, setAdminPass] = useState("admin");
  const [adminRegName, setAdminRegName] = useState("");
  const [adminRegMail, setAdminRegMail] = useState("");
  const [adminRegPass, setAdminRegPass] = useState("");
  const [authView, setAuthView] = useState<"login" | "register">("login");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const data = await adminLogin(adminMail, adminPass);
      localStorage.setItem("cineai_session_token", data.token);
      localStorage.setItem("cineai_admin_name", data.full_name);
      setIsAdminLoggedIn(true);
    } catch (err: any) {
      setAuthError(err.message || "Email atau password admin salah.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      await adminRegister(adminRegMail, adminRegPass, adminRegName);
      setAuthView("login");
      setAdminMail(adminRegMail);
      setAdminPass(adminRegPass);
      setAuthError("Pendaftaran admin berhasil. Silakan masuk.");
    } catch (err: any) {
      setAuthError(err.message || "Pendaftaran gagal.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem("cineai_session_token");
    localStorage.removeItem("cineai_admin_name");
    setIsAdminLoggedIn(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-zinc-50 text-zinc-950">
      {isAdminLoggedIn ? (
        /* Administrative dashboard is active and authenticated */
        <div className="flex-1 flex flex-col justify-between">
          <div className="shrink-0 bg-white border-b border-zinc-200 px-6 py-3 flex justify-between items-center text-xs text-zinc-600">
            <span>Masuk sebagai: <strong className="text-zinc-900 ml-1 font-bold">{localStorage.getItem("cineai_admin_name") || "Administrator"}</strong></span>
            <button
              onClick={handleAdminLogout}
              className="flex items-center gap-1.5 text-zinc-600 hover:text-red-600 transition cursor-pointer font-bold uppercase tracking-wider"
            >
              <LogOut className="w-3.5 h-3.5" /> Keluar (Sign Out)
            </button>
          </div>

          <AdminDashboard />
        </div>
      ) : (
        /* Authentication Walls login or register */
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8 min-h-[500px]">
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
            
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded bg-black flex items-center justify-center mx-auto text-white mb-3">
                <Clapperboard className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-display font-black text-black tracking-tight">Portal Administrator</h2>
              <p className="text-xs text-zinc-500 mt-1">Kelola data film, rincian studio, dan aturan harga dinamis</p>
            </div>

            {/* Auth View Render */}
            {authView === "login" ? (
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="space-y-1 text-left">
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Alamat Email</label>
                  <input
                    type="email" required
                    value={adminMail}
                    onChange={(e) => setAdminMail(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-xs text-zinc-900 focus:outline-none focus:border-black font-medium"
                  />
                </div>

                <div className="space-y-1 text-left">
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Kata Sandi (PIN)</label>
                  <input
                    type="password" required
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-xs text-zinc-900 focus:outline-none focus:border-black font-medium"
                  />
                </div>

                {authError && (
                  <p className={`text-[11px] font-bold p-2.5 rounded border text-center ${authError.includes("berhasil") ? "bg-zinc-50 border-zinc-200 text-zinc-800" : "bg-red-50 border-red-200 text-red-600"}`}>
                    {authError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  id="login-btn"
                  className="w-full bg-black hover:bg-zinc-800 text-white font-bold text-xs py-3 rounded hover:opacity-90 transition cursor-pointer uppercase tracking-wider"
                >
                  {authLoading ? "Memverifikasi Kredensial..." : "Masuk Ke Panel Admin"}
                </button>

                <p className="text-center text-xs text-zinc-500 mt-4">
                  Belum memiliki akun operator?{" "}
                  <button
                    type="button"
                    onClick={() => { setAuthView("register"); setAuthError(""); }}
                    className="text-black hover:underline font-bold"
                  >
                    Daftar Baru
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleAdminRegister} className="space-y-4">
                <div className="space-y-1 text-left">
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Nama Lengkap</label>
                  <input
                    type="text" required
                    value={adminRegName}
                    onChange={(e) => setAdminRegName(e.target.value)}
                    placeholder="Contoh: Operator CineAI"
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-xs text-zinc-900 focus:outline-none focus:border-black font-medium"
                  />
                </div>

                <div className="space-y-1 text-left">
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Alamat Email Admin</label>
                  <input
                    type="email" required
                    value={adminRegMail}
                    onChange={(e) => setAdminRegMail(e.target.value)}
                    placeholder="admin@cineai.com"
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-xs text-zinc-900 focus:outline-none focus:border-black font-medium"
                  />
                </div>

                <div className="space-y-1 text-left">
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Kata Sandi Keamanan</label>
                  <input
                    type="password" required
                    value={adminRegPass}
                    onChange={(e) => setAdminRegPass(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-xs text-zinc-900 focus:outline-none focus:border-black font-medium"
                  />
                </div>

                {authError && (
                  <p className="text-[11px] bg-red-50 border border-red-200 text-red-600 p-2.5 text-center rounded font-bold">
                    {authError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-black hover:bg-zinc-800 text-white font-bold text-xs py-3 rounded hover:opacity-90 transition cursor-pointer uppercase tracking-wider"
                >
                  {authLoading ? "Pendaftaran Operator..." : "Daftar Akun Operator"}
                </button>

                <p className="text-center text-xs text-zinc-500 mt-4">
                  Sudah memiliki akun?{" "}
                  <button
                    type="button"
                    onClick={() => { setAuthView("login"); setAuthError(""); }}
                    className="text-black hover:underline font-bold"
                  >
                    Masuk Sekarang
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
