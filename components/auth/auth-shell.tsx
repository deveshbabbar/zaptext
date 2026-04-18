import Link from "next/link";

type Mode = "signin" | "signup";

export default function AuthShell({ mode, children }: { mode: Mode; children: React.ReactNode }) {
  const isSignUp = mode === "signup";
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-background">
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[var(--ink)] text-[var(--background)] p-14">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            opacity: 0.05,
          }}
        />
        <Link href="/" className="relative flex items-center gap-2.5 font-bold text-[18px]">
          <span className="w-8 h-8 rounded-[8px] bg-[var(--accent)] text-[var(--accent-2)] grid place-items-center zt-mono font-extrabold text-[18px]">
            Z
          </span>
          <span>
            ZapText
            <sup className="opacity-50 font-normal text-[10px] ml-1">.shop</sup>
          </span>
        </Link>

        <div className="relative">
          <div className="zt-mono text-[11px] tracking-[.08em] uppercase mb-4" style={{ color: "#ffffff77" }}>
            {"// AI WhatsApp Bots · India"}
          </div>
          <h1 className="font-sans font-bold text-[clamp(40px,4.6vw,66px)] leading-[1.02] tracking-[-0.035em] text-balance m-0 mb-4">
            {isSignUp ? (
              <>
                Your <span className="zt-serif">first</span> bot,{" "}
                <span className="bg-[var(--accent)] text-[var(--accent-2)] rounded-[8px]" style={{ padding: "0 .14em" }}>
                  live in 5 min.
                </span>
              </>
            ) : (
              <>
                Welcome back, <span className="zt-serif">boss.</span>
                <br />
                Bot ne raat bhar{" "}
                <span className="bg-[var(--accent)] text-[var(--accent-2)] rounded-[8px]" style={{ padding: "0 .14em" }}>
                  kaam kiya.
                </span>
              </>
            )}
          </h1>
          <p className="max-w-[440px] leading-[1.55] text-[17px]" style={{ color: "#ffffffaa" }}>
            {isSignUp
              ? "Sign up, pick your business type, drop in your details. We handle the WhatsApp API and send you a verified number."
              : "Sign in to your dashboard — see last night's bookings, conversations your AI handled, and leads waiting for follow-up."}
          </p>
        </div>

        <div className="relative flex flex-col gap-3">
          <ProofRow
            initials="DK"
            text={<>&ldquo;27 missed calls WhatsApp pe convert — pehli raat.&rdquo;</>}
            by="— Dr. Karan Shah · Shah Dental, Ahmedabad"
          />
          <ProofRow
            emoji="🇮🇳"
            text={<>1,200+ Indian SMBs · 47M messages handled · &lt; 3s median reply</>}
            by="Built in Bengaluru · Official WhatsApp Business API"
          />
        </div>
      </section>

      <section className="flex flex-col justify-center items-center p-6 sm:p-10">
        <div className="w-full max-w-[440px]">
          <div className="lg:hidden mb-8">
            <Link href="/" className="inline-flex items-center gap-2.5 font-bold text-[18px]">
              <span className="w-8 h-8 rounded-[8px] bg-[var(--ink)] text-[var(--accent)] grid place-items-center zt-mono font-extrabold text-[18px]">
                Z
              </span>
              ZapText
            </Link>
          </div>
          <div className="zt-mono text-[11px] uppercase tracking-[.08em] text-[var(--mute)]">
            {`// ${isSignUp ? "Create account" : "Sign in"}`}
          </div>
          <h2 className="text-[36px] font-bold tracking-[-0.03em] leading-[1.05] mt-2.5 mb-1.5">
            {isSignUp ? (
              <>
                Start for <span className="zt-serif">free.</span>
              </>
            ) : (
              <>
                Sign in to <span className="zt-serif">ZapText.</span>
              </>
            )}
          </h2>
          <p className="text-[15px] text-[var(--ink-2)] m-0 mb-7">
            {isSignUp ? "No credit card. 500 conversations on us." : "Use the same email you onboarded with."}
          </p>

          <div className="zt-clerk">{children}</div>

          <div className="mt-5 text-[13.5px] text-[var(--ink-2)] text-center">
            {isSignUp ? (
              <>
                Already on ZapText?{" "}
                <Link href="/sign-in" className="font-semibold border-b border-[var(--ink)] pb-px">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New here?{" "}
                <Link href="/sign-up" className="font-semibold border-b border-[var(--ink)] pb-px">
                  Start free
                </Link>
              </>
            )}
          </div>
          <div className="mt-4 text-[11.5px] text-[var(--mute)] text-center leading-[1.5]">
            Protected by Clerk · SOC 2 Type II
          </div>
        </div>
      </section>
    </div>
  );
}

function ProofRow({
  initials,
  emoji,
  text,
  by,
}: {
  initials?: string;
  emoji?: string;
  text: React.ReactNode;
  by: string;
}) {
  return (
    <div
      className="flex gap-3.5 items-center rounded-[14px] px-4 py-3.5"
      style={{ background: "#ffffff0a", border: "1px solid #ffffff12" }}
    >
      <div className="w-9 h-9 rounded-full bg-[var(--accent)] text-[var(--accent-2)] grid place-items-center font-bold text-[14px] flex-shrink-0">
        {initials || emoji}
      </div>
      <div className="text-[13.5px] leading-[1.4]" style={{ color: "#ffffffdd" }}>
        {text}
        <div className="zt-mono text-[11.5px] mt-0.5" style={{ color: "#ffffff88" }}>
          {by}
        </div>
      </div>
    </div>
  );
}
