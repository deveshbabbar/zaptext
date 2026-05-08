// app/admin/grocery/layout.tsx
//
// Admin shell for grocery-vertical sellers. Reuses parent admin auth.
// Loads the current grocery client from Clerk userId; if user has no
// grocery client, redirect to onboarding.

import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getClientByOwnerUserId } from '@/lib/db/clients';
import GroceryNav from './_components/grocery-nav';

export default async function GroceryAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const client = await getClientByOwnerUserId(userId);
  if (!client) redirect('/onboard');
  if (client.type !== 'grocery') redirect('/admin');

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <GroceryNav clientName={client.business_name} />
      <main className="mx-auto max-w-6xl p-4 md:p-6">{children}</main>
    </div>
  );
}
