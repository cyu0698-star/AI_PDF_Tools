"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("请输入访问密码");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "密码错误，请重试");
        return;
      }
      // Keep the existing dashboard client-side guard happy.
      localStorage.setItem("is_logged_in", "true");
      const from = new URLSearchParams(window.location.search).get("from");
      router.push(from && from.startsWith("/") ? from : "/dashboard");
    } catch {
      setError("登录失败，请检查网络后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[340px]">
      <h2
        className="text-[28px] font-bold tracking-tight text-slate-800 mb-1.5"
        style={{ fontFamily: "'DM Sans', 'Noto Sans SC', sans-serif" }}
      >
        访问验证
      </h2>
      <p className="text-[13px] text-slate-400 mb-9 leading-relaxed">
        请输入访问密码以继续使用 I Love 财务表单。
      </p>

      <form onSubmit={handleLogin}>
        <div className="mb-5">
          <label className="block text-xs font-medium text-slate-500 mb-1.5 tracking-wide">
            访问密码
          </label>
          <input
            type="password"
            placeholder="请输入访问密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="w-full px-3.5 py-[11px] border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 outline-none transition-all focus:border-blue-600 focus:bg-white focus:ring-[3px] focus:ring-blue-600/10 placeholder:text-slate-300"
          />
        </div>

        {error && (
          <p className="text-xs text-red-500 mb-3 animate-fade-in">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-[13px] bg-blue-600 text-white text-[15px] font-semibold rounded-lg shadow-md shadow-blue-600/25 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/30 hover:-translate-y-0.5 transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          {loading ? "验证中…" : "进入"}
        </button>
      </form>
    </div>
  );
}
