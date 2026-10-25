import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkLoaded, ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { useGetMyProfile, getGetMyProfileQueryKey, useUpdateMyProfile } from '@workspace/api-client-react';
import { ArrowDownRight, ArrowRight, Check, CircleAlert, Compass, LockKeyhole, LogOut, ShieldCheck, Sparkles } from 'lucide-react';
import { Link, Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: 'top' as const,
    socialButtonsVariant: 'blockButton' as const,
  },
  variables: {
    colorPrimary: '#28695f',
    colorForeground: '#263d39',
    colorMutedForeground: '#71817d',
    colorDanger: '#a43b32',
    colorBackground: '#fbf8f0',
    colorInput: '#f8f4ea',
    colorInputForeground: '#263d39',
    colorNeutral: '#d9d2c4',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '14px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbf8f0] rounded-[24px] w-[440px] max-w-full overflow-hidden shadow-[0_22px_65px_rgba(41,61,55,.12)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-display text-[#263d39] tracking-[-.04em]',
    headerSubtitle: 'text-[#71817d]',
    socialButtonsBlockButtonText: 'font-semibold text-[#263d39]',
    formFieldLabel: 'font-semibold text-[#344b46]',
    footerActionLink: 'font-semibold text-[#28695f]',
    footerActionText: 'text-[#71817d]',
    dividerText: 'text-[#71817d]',
    identityPreviewEditButton: 'text-[#28695f]',
    formFieldSuccessText: 'text-[#28695f]',
    alertText: 'text-[#7a332d]',
    logoBox: 'mb-2',
    logoImage: 'max-h-9',
    socialButtonsBlockButton: 'border-[#ded8ca] bg-[#fffdf8] hover:bg-[#f5f0e4]',
    formButtonPrimary: 'bg-[#28695f] hover:bg-[#20574f] shadow-none',
    formFieldInput: 'border-[#ded8ca] bg-[#f8f4ea] text-[#263d39]',
    footerAction: 'border-t border-[#e6e0d4]',
    dividerLine: 'bg-[#ded8ca]',
    alert: 'border-[#e8c8c1] bg-[#fbefeb]',
    otpCodeFieldInput: 'border-[#ded8ca] bg-[#f8f4ea]',
    formFieldRow: 'gap-1.5',
    main: 'gap-5',
  },
};

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${compact ? 'gap-2' : ''}`}>
      <span className="grid h-9 w-9 place-items-center rounded-[13px] bg-[#28695f] text-[#f8f4e8] shadow-[0_5px_12px_rgba(40,105,95,.17)]">
        <Compass size={18} strokeWidth={1.8} />
      </span>
      <span className="font-ui text-[15px] font-bold tracking-[-.045em] text-[#263d39]">
        North<span className="font-medium text-[#68807a]">star</span>
      </span>
    </span>
  );
}

function Landing() {
  return (
    <main className="page-enter min-h-[100dvh] overflow-hidden">
      <header className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
          <Link href="/" aria-label="Northstar home" data-testid="link-brand-home">
          <BrandMark />
          </Link>
        <nav className="flex items-center gap-3" aria-label="Account navigation">
          <Link className="rounded-full px-4 py-2.5 text-sm font-semibold text-[#50635e] transition-colors hover:text-[#28695f]" href="/sign-in" data-testid="link-sign-in">
            Sign in
          </Link>
          <Link className="button-lift rounded-full bg-[#28695f] px-5 py-2.5 text-sm font-semibold text-[#fbf8f0]" href="/sign-up" data-testid="link-sign-up">
            Create account <ArrowRight className="ml-1.5 inline" size={15} />
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto grid max-w-[1240px] items-center gap-12 px-5 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-16 lg:grid-cols-[1.02fr_.98fr] lg:gap-6 lg:px-12 lg:pb-28 lg:pt-20">
        <div className="relative z-10 max-w-[650px]">
          <p className="reveal-up mb-7 inline-flex items-center gap-2 rounded-full border border-[#d8d5c8] bg-[#f5f1e7]/80 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[.16em] text-[#4c716a]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d88e68]" />
            A good place to begin
          </p>
          <h1 className="reveal-up delay-1 font-display max-w-[690px] text-[clamp(3.7rem,8.2vw,7rem)] leading-[.91] tracking-[-.06em] text-[#263d39]">
            Make room for <em className="font-normal text-[#9b654d]">what’s next.</em>
          </h1>
          <p className="reveal-up delay-2 mt-7 max-w-[440px] text-[16px] leading-[1.8] text-[#65736d] sm:text-[18px]">
            Your account, thoughtfully put together. Start with the essentials and shape a profile that feels like you.
          </p>
          <div className="reveal-up delay-3 mt-9 flex flex-wrap items-center gap-4">
            <Link className="button-lift inline-flex items-center rounded-full bg-[#28695f] px-6 py-3.5 text-[14px] font-bold text-[#fbf8f0]" href="/sign-up" data-testid="link-get-started">
              Get started <ArrowRight className="ml-2" size={16} />
            </Link>
            <Link className="inline-flex items-center gap-2 px-3 py-3 text-[13px] font-semibold text-[#60716b] transition-colors hover:text-[#28695f]" href="/sign-in" data-testid="link-already-have-account">
              I already have an account
            </Link>
          </div>
          <div className="mt-12 flex items-center gap-3 text-[12px] text-[#748079]" data-testid="text-private-by-design">
            <LockKeyhole size={15} className="text-[#658078]" />
            Private by design. Yours to update whenever you like.
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[580px] lg:ml-auto">
          <div className="paper-grain relative min-h-[390px] overflow-hidden rounded-[34px] bg-[#d7e3d8] px-7 py-8 sm:min-h-[520px] sm:px-10 sm:py-11">
            <div className="absolute -right-16 -top-24 h-[330px] w-[330px] rounded-full border border-[#9eb9a7]/60 sm:h-[430px] sm:w-[430px]" />
            <div className="absolute -right-4 top-5 h-[260px] w-[260px] rounded-full border border-[#9eb9a7]/50 sm:h-[350px] sm:w-[350px]" />
            <div className="absolute -right-20 bottom-[-116px] h-[320px] w-[320px] rounded-full bg-[#edc49f] sm:h-[420px] sm:w-[420px]" />
            <div className="absolute right-[14%] top-[25%] h-[185px] w-[185px] rounded-full bg-[#f5e5c6] shadow-[inset_-18px_-16px_0_rgba(174,133,94,.11)] sm:h-[230px] sm:w-[230px]" />
            <div className="absolute right-[22%] top-[35%] h-[120px] w-[120px] rounded-full border border-[#d7a880] sm:h-[146px] sm:w-[146px]" />
            <div className="absolute right-[31%] top-[44%] h-[44px] w-[44px] rounded-full bg-[#28695f] shadow-[0_8px_22px_rgba(40,105,95,.2)] sm:h-[54px] sm:w-[54px]" />
            <div className="relative z-10 flex h-full min-h-[335px] flex-col justify-between sm:min-h-[430px]">
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[.2em] text-[#42635b]">Your next chapter</span>
                <ArrowDownRight size={19} className="text-[#42635b]" />
              </div>
              <div className="flex items-end justify-between gap-4">
                <div className="float-slow rounded-[20px] border border-white/60 bg-[#fbf8ef]/80 p-4 shadow-[0_12px_32px_rgba(56,82,69,.1)] backdrop-blur-sm sm:p-5">
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#e6b68f] text-[#5c4d3e]">
                    <Sparkles size={15} />
                  </div>
                  <p className="font-display text-[22px] leading-tight text-[#29433d]">A fresh start.</p>
                  <p className="mt-1 text-[11px] text-[#76827a]">Made yours, from day one.</p>
                </div>
                <span className="mb-2 hidden rotate-90 text-[10px] font-bold uppercase tracking-[.2em] text-[#54746a] sm:inline">Take your time</span>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-5 right-5 hidden rounded-full border border-[#d9d4c7] bg-[#f7f3e9] px-4 py-2.5 text-xs font-semibold text-[#60736c] shadow-sm sm:block">
            A calmer kind of account
          </div>
        </div>
      </section>

      <section className="border-y border-[#dfdbcf] bg-[#f1eee4]">
        <div className="mx-auto grid max-w-[1240px] gap-8 px-5 py-8 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center sm:px-8 sm:py-9 lg:px-12">
          <div className="flex items-center gap-3">
            <ShieldCheck size={18} className="text-[#28695f]" />
            <p className="text-[13px] font-medium text-[#52645d]">A secure sign-in, handled with care</p>
          </div>
          <span className="hidden h-7 w-px bg-[#d7d2c5] sm:block" />
          <div className="flex items-center gap-3">
            <Compass size={18} className="text-[#a56d53]" />
            <p className="text-[13px] font-medium text-[#52645d]">One profile that stays yours</p>
          </div>
          <span className="hidden h-7 w-px bg-[#d7d2c5] sm:block" />
          <div className="flex items-center gap-3">
            <Check size={18} className="text-[#28695f]" />
            <p className="text-[13px] font-medium text-[#52645d]">Simple details, easy to change</p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1240px] items-end gap-8 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[.8fr_1.2fr] lg:px-12 lg:py-28">
        <p className="font-display max-w-[400px] text-[clamp(2.4rem,5vw,4.5rem)] leading-[.99] tracking-[-.045em] text-[#29423c]">
          A little more <em className="font-normal text-[#a16b50]">you.</em>
        </p>
        <div className="grid gap-8 border-t border-[#d9d4c7] pt-6 sm:grid-cols-2 sm:gap-12">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[.15em] text-[#a16b50]">01 / Start simply</span>
            <h2 className="mt-3 font-display text-[25px] leading-tight text-[#29423c]">Just the essentials.</h2>
            <p className="mt-2 text-sm leading-7 text-[#6b7871]">Create a secure account and step into a space that is ready when you are.</p>
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[.15em] text-[#a16b50]">02 / Make it yours</span>
            <h2 className="mt-3 font-display text-[25px] leading-tight text-[#29423c]">Your words, your profile.</h2>
            <p className="mt-2 text-sm leading-7 text-[#6b7871]">Add a name and a short introduction. Change either whenever the moment calls for it.</p>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1240px] flex-col gap-4 border-t border-[#dfdbcf] px-5 py-7 text-xs text-[#768079] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <BrandMark compact />
        <p>A considered beginning for whatever comes next.</p>
        <Link href="/sign-up" className="font-semibold text-[#28695f] hover:underline" data-testid="link-footer-create-account">Create your account <ArrowRight className="ml-1 inline" size={13} /></Link>
      </footer>
    </main>
  );
}

function HomeRoute() {
  return (
    <>
      <Show when="signed-in"><Redirect to="/account" /></Show>
      <Show when="signed-out"><Landing /></Show>
    </>
  );
}

function SignInPage() {
  return (
    <main className="auth-page page-enter relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -left-28 top-[-120px] h-[370px] w-[370px] rounded-full bg-[#d9e4d8]/55 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 -right-24 h-[440px] w-[440px] rounded-full bg-[#efd3b8]/45 blur-3xl" />
      <div className="relative z-10 w-full">
        <div className="mb-6 flex justify-center">
          <Link href="/" aria-label="Northstar home" data-testid="link-auth-brand"><BrandMark /></Link>
        </div>
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
        <p className="mx-auto mt-6 max-w-sm text-center text-xs leading-6 text-[#75817a]">Your account is yours. We keep the sign-in simple and your details private.</p>
      </div>
    </main>
  );
}

function SignUpPage() {
  return (
    <main className="auth-page page-enter relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -left-28 top-[-120px] h-[370px] w-[370px] rounded-full bg-[#d9e4d8]/55 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 -right-24 h-[440px] w-[440px] rounded-full bg-[#efd3b8]/45 blur-3xl" />
      <div className="relative z-10 w-full">
        <div className="mb-6 flex justify-center">
          <Link href="/" aria-label="Northstar home" data-testid="link-auth-brand"><BrandMark /></Link>
        </div>
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
        <p className="mx-auto mt-6 max-w-sm text-center text-xs leading-6 text-[#75817a]">A small step toward making this space your own.</p>
      </div>
    </main>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[850px] animate-pulse px-5 py-12 sm:px-8">
      <div className="mb-10 h-4 w-32 rounded bg-[#dfddd2]" />
      <div className="mb-3 h-12 w-64 rounded bg-[#dfddd2]" />
      <div className="mb-12 h-5 w-80 max-w-full rounded bg-[#e7e3d8]" />
      <div className="rounded-[28px] border border-[#e0dbcf] bg-[#fbf8f0] p-6 sm:p-10">
        <div className="mb-8 h-16 w-16 rounded-full bg-[#e7e3d8]" />
        <div className="mb-3 h-3 w-20 rounded bg-[#e7e3d8]" />
        <div className="mb-8 h-12 rounded-xl bg-[#efede5]" />
        <div className="mb-3 h-3 w-16 rounded bg-[#e7e3d8]" />
        <div className="h-28 rounded-xl bg-[#efede5]" />
      </div>
      <p className="mt-5 text-center text-xs text-[#78837c]" data-testid="status-profile-loading">Getting your profile ready…</p>
    </div>
  );
}

function ProfilePortal() {
  const { data: profile, isLoading, isError, error, refetch } = useGetMyProfile();
  const updateProfile = useUpdateMyProfile();
  const client = useQueryClient();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [validationError, setValidationError] = useState('');
  const initializedId = useRef<string | null>(null);

  useEffect(() => {
    if (profile && initializedId.current !== profile.id) {
      initializedId.current = profile.id;
      setDisplayName(profile.displayName);
      setBio(profile.bio);
    }
  }, [profile]);

  if (isLoading) return <ProfileSkeleton />;
  if (isError || !profile) {
    const errorMessage = error instanceof Error ? error.message : 'We couldn’t load your profile just now.';
    return (
      <main className="page-enter min-h-[100dvh] px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-[850px]">
          <AccountHeader userName={user?.firstName ?? undefined} onSignOut={() => signOut({ redirectUrl: basePath || '/' })} />
          <section className="mt-16 rounded-[28px] border border-[#e2c9c0] bg-[#fbf4ef] p-8 text-center sm:p-14" role="alert">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f0dfd6] text-[#a34e3e]"><CircleAlert size={22} /></span>
            <h1 className="mt-5 font-display text-3xl text-[#29423c]">A small pause.</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#746c65]" data-testid="status-profile-error">{errorMessage}</p>
            <button onClick={() => void refetch()} className="button-lift mt-6 rounded-full bg-[#28695f] px-5 py-3 text-sm font-semibold text-[#fbf8f0]" data-testid="button-retry-profile">Try again</button>
          </section>
        </div>
      </main>
    );
  }

  const cleanName = displayName.trim();
  const isDirty = displayName !== profile.displayName || bio !== profile.bio;
  const saveLabel = updateProfile.isPending ? 'Saving changes…' : 'Save profile';
  const profileInitial = (cleanName || user?.firstName || 'Y').charAt(0).toUpperCase();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cleanName) {
      setValidationError('Add a display name before saving.');
      return;
    }
    if (cleanName.length > 80 || bio.length > 240) return;
    setValidationError('');
    setSavedAt(null);
    updateProfile.mutate(
      { data: { displayName: cleanName, bio: bio.trim() } },
      {
        onSuccess: async () => {
          await client.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
          setSavedAt(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
        },
      },
    );
  }

  return (
    <main className="page-enter min-h-[100dvh] px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-[1000px]">
        <AccountHeader userName={user?.firstName ?? undefined} onSignOut={() => signOut({ redirectUrl: basePath || '/' })} />
        <section className="mb-8 mt-12 sm:mt-16">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[.18em] text-[#9c6b50]">Your account / Profile</p>
          <h1 className="font-display text-[clamp(2.8rem,6vw,4.5rem)] leading-[.98] tracking-[-.05em] text-[#29423c]" data-testid="text-profile-heading">
            A little more <em className="font-normal text-[#9c6b50]">you.</em>
          </h1>
          <p className="mt-4 max-w-lg text-[15px] leading-7 text-[#6c7972]">Set the name people see and share a little about yourself. You can change this any time.</p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <form onSubmit={handleSubmit} className="rounded-[28px] border border-[#e1dccf] bg-[#fbf8f0] p-6 shadow-[0_14px_40px_rgba(41,61,55,.045)] sm:p-9" data-testid="form-profile">
            <div className="mb-8 flex items-center gap-4 border-b border-[#e8e3d8] pb-7">
              <div className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-full bg-[#d8e4d9] font-display text-[26px] text-[#28695f]" aria-label="Profile initial">
                {profileInitial}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[#29423c]" data-testid="text-user-name">{cleanName || 'Your profile'}</p>
                <p className="mt-1 truncate text-xs text-[#7d8780]" data-testid="text-user-email">{user?.primaryEmailAddress?.emailAddress ?? 'Account profile'}</p>
              </div>
              <div className="ml-auto hidden items-center gap-1.5 rounded-full bg-[#e9f0e7] px-3 py-1.5 text-[11px] font-semibold text-[#3c6d5e] sm:inline-flex">
                <ShieldCheck size={13} /> Private
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label htmlFor="displayName" className="text-sm font-semibold text-[#354a44]">Display name</label>
                  <span className="text-[11px] text-[#8a9188]">{displayName.length}/80</span>
                </div>
                <input
                  id="displayName"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={80}
                  autoComplete="name"
                  className="field-focus w-full rounded-xl border border-[#ded9cd] bg-[#f7f3e9] px-4 py-3.5 text-[14px] text-[#29423c]"
                  placeholder="What should we call you?"
                  aria-describedby={validationError ? 'profile-validation-error' : undefined}
                  data-testid="input-display-name"
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label htmlFor="bio" className="text-sm font-semibold text-[#354a44]">A little about you</label>
                  <span className="text-[11px] text-[#8a9188]">{bio.length}/240</span>
                </div>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  maxLength={240}
                  rows={5}
                  className="field-focus w-full resize-y rounded-xl border border-[#ded9cd] bg-[#f7f3e9] px-4 py-3.5 text-[14px] leading-6 text-[#29423c]"
                  placeholder="A few words about what matters to you…"
                  data-testid="input-profile-bio"
                />
                {validationError && <p id="profile-validation-error" className="mt-2 text-xs font-medium text-[#a43b32]" role="alert" data-testid="status-profile-validation">{validationError}</p>}
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-3 border-t border-[#e8e3d8] pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-h-5 text-xs" aria-live="polite">
                {updateProfile.isError && <span className="inline-flex items-center gap-1.5 text-[#a43b32]" role="alert" data-testid="status-save-error"><CircleAlert size={14} /> We couldn’t save that. Please try again.</span>}
                {savedAt && !updateProfile.isError && <span className="inline-flex items-center gap-1.5 text-[#39705e]" data-testid="status-save-success"><Check size={14} /> Saved at {savedAt}</span>}
                {!savedAt && !updateProfile.isError && !isDirty && <span className="text-[#818b83]" data-testid="status-profile-saved">All changes saved</span>}
                {!savedAt && !updateProfile.isError && isDirty && <span className="text-[#818b83]" data-testid="status-profile-unsaved">Unsaved changes</span>}
              </div>
              <button
                type="submit"
                disabled={updateProfile.isPending || !isDirty || !cleanName}
                className="button-lift inline-flex min-h-12 items-center justify-center rounded-full bg-[#28695f] px-6 text-sm font-bold text-[#fbf8f0] transition disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:transform-none disabled:hover:shadow-none"
                data-testid="button-save-profile"
              >
                {updateProfile.isPending ? <span className="mr-2 h-4 w-4 animate-pulse rounded-full border-2 border-white/40 border-t-white" /> : null}
                {saveLabel}
              </button>
            </div>
          </form>

          <aside className="flex flex-col gap-4">
            <div className="rounded-[24px] bg-[#dce7dc] p-6">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#c6d8ca] text-[#28695f]"><Sparkles size={17} /></span>
              <h2 className="mt-5 font-display text-[23px] leading-tight text-[#29423c]">Settle in at your own pace.</h2>
              <p className="mt-3 text-[13px] leading-6 text-[#65766d]">A name and a few honest words are plenty. This profile is yours to shape.</p>
            </div>
            <div className="rounded-[24px] border border-[#e1dccf] bg-[#f4f0e6] p-6">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9c6b50]">Account since</p>
              <p className="mt-2 font-display text-[21px] text-[#29423c]" data-testid="text-account-created">{formatDate(profile.createdAt)}</p>
              <p className="mt-1 text-xs text-[#79847d]">Your profile has a place here.</p>
            </div>
          </aside>
        </div>
        <footer className="flex flex-col gap-3 py-8 text-xs text-[#7e8880] sm:flex-row sm:items-center sm:justify-between">
          <span>Changes are saved to your account profile.</span>
          <span data-testid="text-profile-updated">Last updated {formatDate(profile.updatedAt)}</span>
        </footer>
      </div>
    </main>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(date);
}

function AccountHeader({ userName, onSignOut }: { userName?: string; onSignOut: () => void }) {
  return (
    <header className="flex items-center justify-between border-b border-[#dedacf] pb-5">
      <Link href="/" aria-label="Northstar home" data-testid="link-account-brand"><BrandMark /></Link>
      <div className="flex items-center gap-3">
        {userName && <span className="hidden text-sm text-[#64736c] sm:inline" data-testid="text-greeting">Hello, {userName}</span>}
        <button onClick={onSignOut} className="inline-flex items-center gap-2 rounded-full border border-[#d9d5c9] bg-[#f8f5ec] px-4 py-2.5 text-xs font-semibold text-[#52665e] transition hover:border-[#b6c8ba] hover:text-[#28695f]" data-testid="button-sign-out">
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </header>
  );
}

function AccountRoute() {
  return (
    <>
      <Show when="signed-in"><ProfilePortal /></Show>
      <Show when="signed-out"><Redirect to="/" /></Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const prevUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserId.current !== undefined && prevUserId.current !== userId) client.clear();
      prevUserId.current = userId;
    });
    return unsubscribe;
  }, [addListener, client]);

  return null;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ClerkApplication() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Welcome back', subtitle: 'Pick up where you left off.' } },
        signUp: { start: { title: 'A good place to begin', subtitle: 'Create an account and make it yours.' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkLoaded>
        <ClerkQueryClientCacheInvalidator />
        <RoutedErrorBoundary>
          <Switch>
            <Route path="/" component={HomeRoute} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/account" component={AccountRoute} />
            <Route component={NotFound} />
          </Switch>
        </RoutedErrorBoundary>
      </ClerkLoaded>
    </ClerkProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <ClerkApplication />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
