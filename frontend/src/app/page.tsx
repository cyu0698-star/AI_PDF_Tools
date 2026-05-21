"use client";

import DemoAnimation from "@/features/auth/components/DemoAnimation";
import LoginForm from "@/features/auth/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex h-screen">
      {/* Left - Demo Animation */}
      <div className="flex-1 bg-slate-50 relative overflow-hidden hidden lg:flex">
        <DemoAnimation />
      </div>

      {/* Right - Login Form */}
      <div className="w-full lg:w-[420px] lg:min-w-[380px] flex flex-col items-center justify-center px-10 py-12 bg-white border-l border-black/5 relative">
        <LoginForm />
        <div className="absolute bottom-5 text-[11px] text-slate-300">
          © I Love 财务表单 2026
        </div>
      </div>
    </div>
  );
}
