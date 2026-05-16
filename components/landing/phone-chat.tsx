"use client";

// Animated WhatsApp-style phone preview in the hero. Needs client JS for
// the staggered message playback (useEffect timers + scroll-to-bottom).
// Pulled out of the landing page so the rest of the page can stay
// server-rendered.

import { useEffect, useRef, useState } from "react";
import { Sticker } from "./_shared";

type ChatMsg = { who: "in" | "out"; t: string; time?: string; typing?: boolean };

const RESTAURANT_CHAT: ChatMsg[] = [
  { who: "in", t: "Bhaiya menu dikhao please", time: "7:42 PM" },
  {
    who: "out",
    t: "Namaste 👋 Aaj ke specials —<br/><b>• Hyderabadi Dum Biryani</b> ₹280<br/><b>• Chicken 65</b> ₹240<br/><b>• Veg Pulao</b> ₹180<br/><br/>Full menu bhejun?",
    time: "7:42 PM",
    typing: true,
  },
  { who: "in", t: "Haan bhejo, 2 biryani order karna hai", time: "7:43 PM" },
  {
    who: "out",
    t: "Done boss. 2× Dum Biryani = <b>₹560</b>. Delivery address last time ka use karun (Koramangala 5th Block)?",
    time: "7:43 PM",
    typing: true,
  },
  { who: "in", t: "Haan same address", time: "7:43 PM" },
  {
    who: "out",
    t: "Order placed ✓ ETA <b>32 min</b>. UPI link: pay.zpt.shop/a9x2<br/>Track: wa.me/track/8821",
    time: "7:44 PM",
    typing: true,
  },
];

const HEADER = {
  name: "Rohit's Biryani · Bot",
  avatar: "R",
};

export function PhoneChat() {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [rendered, setRendered] = useState<Array<ChatMsg & { id: number; isTyping?: boolean }>>([]);

  useEffect(() => {
    if (!RESTAURANT_CHAT.length) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let idCounter = 0;
    const playOnce = (startDelay = 300) => {
      let delay = startDelay;
      setRendered([]);
      RESTAURANT_CHAT.forEach((m) => {
        if (m.who === "out" && m.typing) {
          const typingId = ++idCounter;
          timers.push(
            setTimeout(() => {
              setRendered((prev) => [...prev, { ...m, id: typingId, isTyping: true }]);
              requestAnimationFrame(() => {
                if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
              });
            }, delay),
          );
          delay += 700;
        }
        const msgId = ++idCounter;
        timers.push(
          setTimeout(() => {
            setRendered((prev) => [...prev.filter((x) => !x.isTyping), { ...m, id: msgId }]);
            requestAnimationFrame(() => {
              if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
            });
          }, delay),
        );
        delay += m.who === "out" ? 1100 : 800;
      });
      timers.push(setTimeout(() => playOnce(0), delay + 3000));
    };
    playOnce();
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <div className="relative flex justify-center items-start">
      <Sticker
        className="hidden lg:flex absolute top-[60px] -left-[30px] -rotate-[4deg]"
        label="Response time"
        main={
          <>
            <b>1.2 seconds</b> · avg
          </>
        }
        dot
      />
      <Sticker
        className="hidden lg:flex absolute bottom-[120px] -right-[40px] rotate-[3deg]"
        label="More bookings"
        main={
          <>
            <b>3.4×</b> vs. missed calls
          </>
        }
        badge="3×"
      />
      <Sticker
        className="hidden lg:flex absolute top-[300px] -left-[60px] rotate-[2deg] zt-bob"
        label="Understands"
        main={
          <>
            <b>Hindi · English · Hinglish</b>
          </>
        }
        flag="🇮🇳"
      />

      <div
        className="w-[280px] sm:w-[320px] md:w-[340px] h-[540px] sm:h-[600px] md:h-[640px] max-w-full bg-[#111] rounded-[44px] p-3 relative z-[2]"
        style={{
          boxShadow:
            "0 40px 80px -30px rgba(20,20,15,.35), inset 0 0 0 1px rgba(0,0,0,.3), inset 0 2px 0 rgba(255,255,255,.05)",
        }}
      >
        <div
          className="absolute top-[18px] left-1/2 -translate-x-1/2 w-[110px] h-[26px] bg-black rounded-[16px] z-[5]"
          aria-hidden
        />
        <div className="w-full h-full rounded-[34px] overflow-hidden bg-[#ECE5DD] flex flex-col relative">
          <div className="bg-[#1f3d2d] text-white pt-[44px] pb-3 px-3.5 flex items-center gap-2.5 text-[14px]">
            <div className="w-9 h-9 rounded-full bg-[var(--accent)] text-[var(--accent-2)] grid place-items-center font-bold text-[14px] zt-mono flex-shrink-0">
              {HEADER.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[14px] tracking-tight">{HEADER.name}</div>
              <div className="text-[11px] opacity-70 flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[#8fffb0]"
                  style={{ boxShadow: "0 0 6px #8fffb0" }}
                />
                online · replies instantly
              </div>
            </div>
          </div>
          <div
            ref={bodyRef}
            className="zt-chat-body flex-1 overflow-y-auto p-[14px_12px] flex flex-col gap-2"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, rgba(31,61,45,0.04) 1px, transparent 1.5px), radial-gradient(circle at 80% 60%, rgba(31,61,45,0.04) 1px, transparent 1.5px)",
              backgroundSize: "120px 120px",
            }}
          >
            {rendered.map((m) =>
              m.isTyping ? (
                <div
                  key={m.id}
                  className="zt-msg max-w-[78%] py-2 px-2.5 rounded-[10px] text-[13.5px] leading-[1.4] bg-white self-start rounded-tl-[2px]"
                  style={{ boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)" }}
                >
                  <div className="inline-flex gap-[3px] py-1 zt-typing">
                    <i className="inline-block w-[5px] h-[5px] rounded-full bg-black/60" />
                    <i className="inline-block w-[5px] h-[5px] rounded-full bg-black/60" />
                    <i className="inline-block w-[5px] h-[5px] rounded-full bg-black/60" />
                  </div>
                </div>
              ) : (
                <div
                  key={m.id}
                  className={`zt-msg max-w-[78%] py-2 px-2.5 rounded-[10px] text-[13.5px] leading-[1.4] ${
                    m.who === "in"
                      ? "bg-white self-start rounded-tl-[2px]"
                      : "bg-[#D9FDD3] self-end rounded-tr-[2px]"
                  }`}
                  style={{ boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)" }}
                >
                  <span dangerouslySetInnerHTML={{ __html: m.t }} />
                  <div className="text-[10px] text-black/40 text-right mt-0.5 font-medium">
                    {m.time || ""} {m.who === "out" && <span style={{ color: "#53bdeb" }}>✓✓</span>}
                  </div>
                </div>
              ),
            )}
          </div>
          <div className="p-[8px_10px_12px] flex items-center gap-2">
            <div className="flex-1 bg-white rounded-[24px] px-3.5 py-2.5 text-[13px] text-black/50 flex items-center justify-between">
              <span>Type a message…</span>
              <span className="flex gap-2.5 opacity-50">📎 📷</span>
            </div>
            <div className="w-[38px] h-[38px] rounded-full bg-[#1f3d2d] text-white grid place-items-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
