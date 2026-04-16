import { redirect } from 'next/navigation';

// This route is a legacy redirect — all client detail pages should go through /admin/clients/[id]
// which has proper authentication. This prevents unauthenticated access to bot data.
export default async function ClientDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/clients/${id}`);
}
