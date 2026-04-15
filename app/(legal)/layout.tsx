import Link from 'next/link';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <span className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">Z</span>
            <span>ZapText</span>
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Back to home
          </Link>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {children}
      </main>
      <footer className="border-t border-border mt-16 py-8 text-center text-xs text-muted-foreground">
        <div className="max-w-5xl mx-auto px-4 flex flex-wrap items-center justify-center gap-6">
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/refund" className="hover:text-foreground">Refund Policy</Link>
          <Link href="/cancellation" className="hover:text-foreground">Cancellation</Link>
          <Link href="/contact" className="hover:text-foreground">Contact</Link>
          <Link href="/about" className="hover:text-foreground">About</Link>
        </div>
        <div className="mt-4">© 2026 ZapText. All rights reserved.</div>
      </footer>
    </div>
  );
}
