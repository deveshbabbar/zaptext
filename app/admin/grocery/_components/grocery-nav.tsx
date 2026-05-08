// app/admin/grocery/_components/grocery-nav.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/admin/grocery/today', label: "Aaj ki list" },
  { href: '/admin/grocery/products', label: 'Products' },
  { href: '/admin/grocery/orders', label: 'Orders' },
  { href: '/admin/grocery/zones-slots', label: 'Zones & Slots' },
  { href: '/admin/grocery/recurring', label: 'Recurring' },
];

export default function GroceryNav({ clientName }: { clientName: string }) {
  const path = usePathname();
  return (
    <nav className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="font-semibold">🥬 {clientName}</div>
        <div className="flex flex-wrap gap-1 text-sm">
          {TABS.map((t) => {
            const active = path?.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded px-3 py-1.5 ${
                  active
                    ? 'bg-emerald-600 text-white'
                    : 'text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
