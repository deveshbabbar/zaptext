import { redirect } from 'next/navigation';

export default async function OnboardTypeRedirect({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  redirect(`/admin/onboard/${type}`);
}
