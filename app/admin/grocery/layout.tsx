// app/admin/grocery/layout.tsx
//
// Admin shell for the grocery vertical. The parent /admin/layout.tsx now
// supplies the sidebar (which includes a "Vertical · Grocery" section),
// so this layout no longer renders <GroceryNav>. We still verify the
// logged-in user is the owner of a grocery client because every child
// page calls `getClientByOwnerUserId(userId)` for scoping (single-tenant
// model — the demo user is both staff + grocery client owner). When the
// product moves to multi-tenant staff-can-manage-any-client, this auth
// path will need to switch to a client-id-from-URL pattern.

import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getClientByOwnerUserId } from '@/lib/db/clients';

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

  return <>{children}</>;
}
