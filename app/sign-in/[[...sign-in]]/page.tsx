import type { Metadata } from 'next';
import { SignIn } from '@clerk/nextjs';
import AuthShell from '@/components/auth/auth-shell';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to ZapText to manage your WhatsApp AI bots.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/sign-in' },
};

export default function SignInPage() {
  return (
    <AuthShell mode="signin">
      <SignIn
        appearance={{
          elements: {
            rootBox: 'w-full',
            card: 'shadow-none bg-transparent border-0 p-0',
            header: 'hidden',
            footer: 'hidden',
            socialButtonsBlockButton:
              'border border-[var(--line)] rounded-[12px] bg-[var(--card)] hover:border-[var(--ink)] text-[var(--ink)] font-semibold',
            formFieldInput:
              'rounded-[12px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:ring-2 focus:ring-[var(--accent)]',
            formButtonPrimary:
              'bg-[var(--ink)] hover:bg-black text-[var(--background)] rounded-[12px] font-bold py-3.5 text-[15px] normal-case',
            formFieldLabel: 'text-[12.5px] font-semibold text-[var(--ink-2)]',
            dividerLine: 'bg-[var(--line)]',
            dividerText: 'text-[var(--mute)] zt-mono text-[12px] uppercase',
            identityPreviewEditButton: 'text-[var(--ink)]',
            formResendCodeLink: 'text-[var(--ink)]',
          },
          variables: {
            colorPrimary: '#14130F',
            colorText: '#14130F',
            colorTextSecondary: '#6F6A5F',
            colorBackground: 'transparent',
            colorInputBackground: '#FFFDF7',
            colorInputText: '#14130F',
            borderRadius: '12px',
            fontFamily: 'var(--font-sans)',
          },
        }}
      />
    </AuthShell>
  );
}
