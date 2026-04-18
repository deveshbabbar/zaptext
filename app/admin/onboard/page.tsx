'use client';

import Link from 'next/link';
import { BUSINESS_TYPES } from '@/lib/constants';
import { PageTopbar, PageHead } from '@/components/app/primitives';

export default function AdminOnboardPage() {
  return (
    <>
      <PageTopbar crumbs={<><b className="text-foreground">Onboard client</b> · pick business type</>} />
      <div style={{ padding: '28px 32px 60px' }} className="max-w-5xl">
        <PageHead
          title={<>What kind of <span className="zt-serif">business?</span></>}
          sub="Each type comes with its own preset FAQs, tone, and schema."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {BUSINESS_TYPES.map((bt) => (
            <Link
              key={bt.type}
              href={`/admin/onboard/${bt.type}`}
              className="border border-[var(--line)] rounded-[18px] bg-[var(--card)] hover:-translate-y-0.5 hover:border-[var(--ink)] transition block"
              style={{ padding: 22 }}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[34px] w-12 h-12 rounded-[12px] bg-[var(--bg-2)] flex items-center justify-center">
                  {bt.icon}
                </span>
                <h3 className="text-[20px] font-bold tracking-[-0.02em]">{bt.label}</h3>
              </div>
              <p className="text-[13px] text-[var(--ink-2)] m-0">{bt.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
