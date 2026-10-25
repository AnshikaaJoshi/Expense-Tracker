import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, CircleAlert, Coffee, FileText, Filter, Leaf, LoaderCircle, LogOut, Plus, Search, ShoppingBag, Sparkles, Utensils, Wallet, X } from 'lucide-react';
import {
  ExpenseCategory, type Expense, type ExpenseInput, type ListExpensesParams,
  useCreateExpense, useDeleteExpense, useGetExpense, useGetExpenseSummary, useListExpenses, useUpdateExpense,
  getGetExpenseQueryKey, getGetExpenseSummaryQueryKey, getListExpensesQueryKey,
} from '@workspace/api-client-react';
import { Route, Switch, Link, Redirect, useLocation, useParams, Router as WouterRouter } from 'wouter';
import NotFound from '@/pages/not-found';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form } from '@/components/ui/form';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/error-boundary';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 45_000, refetchOnWindowFocus: false } } });
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

const appearance = {
  theme: shadcn, cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: { colorPrimary: '#315d4d', colorForeground: '#293b35', colorMutedForeground: '#718078', colorDanger: '#b94d42', colorBackground: '#fffdf8', colorInput: '#fffdf8', colorInputForeground: '#293b35', colorNeutral: '#e1ddd1', fontFamily: 'DM Sans, sans-serif', borderRadius: '1rem' },
  elements: {
    rootBox: 'w-full flex justify-center', cardBox: 'bg-[#fffdf8] rounded-3xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#293b35] font-semibold', headerSubtitle: 'text-[#718078]', socialButtonsBlockButtonText: 'text-[#293b35]',
    formFieldLabel: 'text-[#33473e]', footerActionLink: 'text-[#315d4d] font-semibold', footerActionText: 'text-[#718078]',
    dividerText: 'text-[#718078]', identityPreviewEditButton: 'text-[#315d4d]', formFieldSuccessText: 'text-[#315d4d]', alertText: 'text-[#293b35]',
    logoBox: 'mb-4', logoImage: 'h-9', socialButtonsBlockButton: 'border-[#e1ddd1] bg-[#fbf8f0] hover:bg-[#f3efe4]',
    formButtonPrimary: 'bg-[#315d4d] hover:bg-[#264d3e] text-white', formFieldInput: 'bg-[#fffdf8] border-[#e1ddd1] text-[#293b35]',
    footerAction: 'border-0', dividerLine: 'bg-[#e1ddd1]', alert: 'bg-[#fbf1eb] border-[#ead5c7]', otpCodeFieldInput: 'border-[#e1ddd1]',
    formFieldRow: 'mb-4', main: 'text-[#293b35]',
  },
};

const categories = Object.values(ExpenseCategory);
const categoryTone: Record<string, string> = {
  Food: 'bg-[#f5e8d2] text-[#8b6132]', Transport: 'bg-[#e4eee9] text-[#3e705d]', Shopping: 'bg-[#f1e6e1] text-[#9a6250]',
  Bills: 'bg-[#e8e9df] text-[#626b4a]', Health: 'bg-[#e1eee8] text-[#47775e]', Entertainment: 'bg-[#eee7d6] text-[#887344]',
  Travel: 'bg-[#e1ebed] text-[#4c737c]', Other: 'bg-[#ece9df] text-[#777361]',
};
const categoryIcon: Record<string, typeof Wallet> = { Food: Utensils, Transport: ArrowRight, Shopping: ShoppingBag, Bills: FileText, Health: Leaf, Entertainment: Sparkles, Travel: ArrowRight, Other: Wallet };

function money(cents: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(cents / 100);
}
function localDate(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function readableDate(date: string, format: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Intl.DateTimeFormat('en-IN', format).format(localDate(date));
}
function Brand({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" className={`inline-flex items-center gap-3 no-underline ${inverse ? 'text-[#f6f1e4]' : 'text-foreground'}`} data-testid="link-brand">
    <img src={`${basePath}/logo.svg`} alt="" className="h-9 w-9" />
    <span className="font-display text-[23px] tracking-tight">little ledger</span>
  </Link>;
}

function HomePage() {
  return <main className="min-h-[100dvh] overflow-hidden bg-[#f5f1e6] text-[#263b33]">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 md:px-10">
      <Brand />
      <div className="flex items-center gap-3">
        <Link href="/sign-in" className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-[#eae5d8]" data-testid="link-sign-in">Sign in</Link>
        <Link href="/sign-up" className="rounded-full bg-[#315d4d] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:-translate-y-0.5 hover:bg-[#254c3d]" data-testid="link-get-started">Start a journal</Link>
      </div>
    </header>
    <section className="mx-auto grid max-w-7xl items-center gap-10 px-6 pb-20 pt-10 md:grid-cols-[1.05fr_.95fr] md:px-10 md:pb-28 md:pt-16">
      <div className="page-enter relative z-10">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d9d4c7] bg-[#faf7ed] px-4 py-2 text-xs font-bold uppercase tracking-[.16em] text-[#637c6d]"><span className="h-2 w-2 rounded-full bg-[#c4924a]" />A softer way to keep track</p>
        <h1 className="max-w-2xl font-display text-[clamp(3.4rem,7vw,6.5rem)] leading-[.96] tracking-[-.055em]">Your money,<br /><em className="font-medium text-[#92714a]">in plain sight.</em></h1>
        <p className="mt-7 max-w-lg text-lg leading-8 text-[#66756c]">A small, thoughtful place to note what you spend. No scorecards. No guilt. Just a clearer picture, one day at a time.</p>
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <Link href="/sign-up" className="group inline-flex items-center gap-3 rounded-full bg-[#315d4d] px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-[#315d4d]/10 hover:-translate-y-1 hover:bg-[#254c3d]" data-testid="link-create-account">Make your first note <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" /></Link>
          <span className="text-sm text-[#758078]">A little more clarity, daily.</span>
        </div>
      </div>
      <div className="relative page-enter [animation-delay:120ms]">
        <div className="absolute -right-12 -top-8 h-64 w-64 rounded-full bg-[#e8d9b7]/50 blur-3xl" />
        <div className="relative mx-auto max-w-[520px] rotate-[1.5deg] rounded-[2rem] border border-[#ddd6c4] bg-[#fffdf8] p-5 shadow-[0_32px_90px_rgba(46,64,49,.13)] md:p-7">
          <div className="flex items-center justify-between border-b border-[#eee9de] pb-5">
            <div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8a9489]">A page from your month</p><p className="mt-1 font-display text-2xl">A gentler overview</p></div>
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eff0e4] text-[#496c59]"><CalendarDays size={20} /></div>
          </div>
          <div className="py-7">
            <p className="text-sm text-[#7d887e]">Your spending, so far</p><div className="mt-1 flex items-baseline gap-2"><span className="font-display text-5xl tracking-tight">₹ 8,420</span><span className="text-sm text-[#809083]">this month</span></div>
            <div className="mt-6 h-28 overflow-hidden rounded-2xl bg-[#f3f1e8] px-3 pt-2">
              <svg viewBox="0 0 440 110" className="h-full w-full" preserveAspectRatio="none" aria-label="Gentle monthly spending trend">
                <path d="M0,84 C35,73 55,89 88,67 S142,60 176,72 S226,23 264,49 S319,67 352,35 S405,43 440,19 L440,110 L0,110 Z" fill="#d8e4d5" />
                <path d="M0,84 C35,73 55,89 88,67 S142,60 176,72 S226,23 264,49 S319,67 352,35 S405,43 440,19" fill="none" stroke="#47725a" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div className="space-y-3 border-t border-[#eee9de] pt-5">
            {['A familiar lunch', 'The ride across town', 'A book for the evening'].map((t, i) => <div key={t} className="flex items-center gap-3">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${i === 0 ? 'bg-[#f4ead9] text-[#926c3f]' : i === 1 ? 'bg-[#e6eee9] text-[#4d725d]' : 'bg-[#eee8e1] text-[#816c5a]'}`}>{i === 0 ? <Coffee size={17} /> : i === 1 ? <ArrowRight size={17} /> : <ShoppingBag size={17} />}</span>
              <span className="flex-1 text-sm font-medium">{t}</span><span className="text-sm font-semibold">₹{[240, 185, 499][i]}</span>
            </div>)}
          </div>
        </div>
        <div className="absolute -bottom-8 -left-4 hidden rounded-2xl border border-[#dcd6c7] bg-[#fbf8ef] p-4 shadow-md md:block"><p className="text-xs text-[#7d887e]">No perfect budget needed.</p><p className="mt-1 font-display text-xl text-[#486c57]">Just your real life.</p></div>
      </div>
    </section>
    <section className="border-y border-[#e3decf] bg-[#eeebdf]">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 md:grid-cols-3 md:px-10">
        {[['Notice the little things', 'A quick note is enough. Add the detail that helps you remember, and leave the rest.'], ['See the shape of a month', 'Gentle summaries turn scattered purchases into a picture you can actually use.'], ['Keep the judgment out', 'Spending is information, not a verdict. Your journal is here to help you notice.']].map(([title, body], i) => <article key={title} className="flex gap-4">
          <span className="font-display text-3xl text-[#b28d59]">0{i + 1}</span><div><h2 className="font-display text-xl">{title}</h2><p className="mt-2 text-sm leading-6 text-[#6d796f]">{body}</p></div>
        </article>)}
      </div>
    </section>
    <footer className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-6 py-8 text-sm text-[#7d887e] md:flex-row md:px-10"><Brand /><span>A little ledger for real life.</span></footer>
  </main>;
}

function SignInPage() {
  return <AuthFrame><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></AuthFrame>;
}
function SignUpPage() {
  return <AuthFrame><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></AuthFrame>;
}
function AuthFrame({ children }: { children: ReactNode }) {
  return <main className="flex min-h-[100dvh] items-center justify-center bg-[#f4f0e5] px-4 py-10"><div className="w-full max-w-xl"><div className="mb-7 text-center"><Brand /><p className="mt-4 text-sm text-muted-foreground">A quieter way to understand your everyday spending.</p></div>{children}</div></main>;
}
function CacheInvalidator() {
  const { addListener } = useClerk();
  const cache = useQueryClient();
  const [location, setLocation] = useLocation();
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      cache.clear();
      if (!user && location !== '/') setLocation('/');
    });
    return unsubscribe;
  }, [addListener, cache, location, setLocation]);
  return null;
}
function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/user-portal" /></Show><Show when="signed-out"><HomePage /></Show></>;
}
function Protected({ children }: { children: ReactNode }) {
  return <><Show when="signed-in">{children}</Show><Show when="signed-out"><Redirect to="/" /></Show></>;
}
function PortalRoute() { return <Protected><Dashboard /></Protected>; }
function ExpensesRoute() { return <Protected><ExpensesPage /></Protected>; }
function ExpenseDetailRoute() { return <Protected><ExpenseDetail /></Protected>; }
function SignOutControl() {
  const { signOut } = useClerk();
  return <button type="button" data-testid="button-sign-out" onClick={() => signOut({ redirectUrl: basePath || '/' })} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#c6d0c5] hover:bg-white/10 hover:text-white"><LogOut size={17} />Sign out</button>;
}
function Shell({ children, active }: { children: ReactNode; active: 'home' | 'expenses' }) {
  const { user } = useUser();
  return <div className="min-h-[100dvh] bg-[#f5f2e9] md:flex">
    <aside className="flex flex-row items-center justify-between bg-[#25483c] px-5 py-4 text-[#f5f0e3] md:sticky md:top-0 md:flex md:h-[100dvh] md:w-[248px] md:flex-col md:items-stretch md:px-5 md:py-7">
      <div><div className="mb-7 hidden md:block"><Brand inverse /></div><div className="md:hidden"><Brand inverse /></div>
        <p className="mb-3 hidden px-3 text-[10px] font-bold uppercase tracking-[.2em] text-[#9fb2a3] md:block">Your journal</p>
        <nav className="flex items-center gap-1 md:flex-col md:items-stretch">
          <Link href="/user-portal" data-testid="link-dashboard" className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${active === 'home' ? 'bg-[#3b5f4f] text-white' : 'text-[#c6d0c5] hover:bg-white/10'}`}><Wallet size={17} />Overview</Link>
          <Link href="/expenses" data-testid="link-expenses" className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${active === 'expenses' ? 'bg-[#3b5f4f] text-white' : 'text-[#c6d0c5] hover:bg-white/10'}`}><FileText size={17} />Expenses</Link>
        </nav>
      </div>
      <div className="hidden border-t border-white/15 pt-5 md:block"><div className="mb-4 flex items-center gap-3 px-2">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-[#d6c69e] text-sm font-bold text-[#25483c]">{(user?.firstName || user?.username || 'Y').slice(0, 1).toUpperCase()}</div>
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{user?.firstName || 'Your journal'}</p><p className="truncate text-xs text-[#a8b8aa]">Personal space</p></div>
      </div><SignOutControl /></div>
    </aside>
    <main className="min-w-0 flex-1 px-5 pb-12 pt-7 md:px-10 md:pt-10"><div className="mx-auto max-w-[1260px] page-enter">{children}</div></main>
  </div>;
}

function LoadingBlock() {
  return <div className="space-y-5" data-testid="status-loading"><div className="h-8 w-52 animate-pulse rounded-lg bg-[#e6e3d8]" /><div className="grid gap-4 md:grid-cols-3"><div className="h-32 animate-pulse rounded-2xl bg-[#e8e5db]" /><div className="h-32 animate-pulse rounded-2xl bg-[#e8e5db]" /><div className="h-32 animate-pulse rounded-2xl bg-[#e8e5db]" /></div><div className="h-72 animate-pulse rounded-2xl bg-[#e8e5db]" /></div>;
}
function ErrorState({ retry }: { retry: () => void }) {
  return <div className="soft-card rounded-3xl p-10 text-center" data-testid="status-error"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f7e9e0] text-[#a75545]"><CircleAlert size={21} /></span><h3 className="mt-4 font-display text-2xl">We couldn’t open this page</h3><p className="mt-2 text-sm text-muted-foreground">Your journal is still here. Try loading it again in a moment.</p><Button className="mt-5 rounded-full" onClick={retry} data-testid="button-retry">Try again</Button></div>;
}

function SummaryDateRange({ range, setRange }: { range: string; setRange: (range: string) => void }) {
  return <div className="flex rounded-full bg-[#ebe8dd] p-1" role="group" aria-label="Chart date range">
    {[['month', 'Month'], ['3m', '3 months'], ['year', 'Year']].map(([id, label]) => <button key={id} type="button" data-testid={`button-range-${id}`} onClick={() => setRange(id)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${range === id ? 'bg-[#fffdf8] text-[#315d4d] shadow-sm' : 'text-[#788177] hover:text-[#315d4d]'}`}>{label}</button>)}
  </div>;
}
function dateRange(range: string) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - (range === 'year' ? 11 : range === '3m' ? 2 : 0), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: iso(start), to: iso(end) };
}
function Dashboard() {
  const [range, setRange] = useState('month');
  const bounds = dateRange(range);
  const summaryQuery = useGetExpenseSummary(bounds, { query: { queryKey: getGetExpenseSummaryQueryKey(bounds) } });
  const listQuery = useListExpenses(undefined, { query: { queryKey: getListExpensesQueryKey() } });
  const summary = summaryQuery.data;
  const latest = (listQuery.data || []).slice(0, 5);
  const monthName = new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(new Date());
  const chartData = summary?.byMonth.map((entry) => ({ month: new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date(Number(entry.month.slice(0, 4)), Number(entry.month.slice(5, 7)) - 1, 1)), total: entry.totalCents })) || [];
  const categoryData = summary?.byCategory.slice().sort((a, b) => b.totalCents - a.totalCents).slice(0, 6) || [];
  return <Shell active="home">
    <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#819083]">Your spending journal</p><h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">A clearer month.</h1><p className="mt-2 text-sm text-[#79847a]">A look at the things your money did in {monthName}.</p></div>
      <Link href="/expenses" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#315d4d] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:-translate-y-0.5 hover:bg-[#254c3d]" data-testid="link-add-expense"><Plus size={17} />Add an expense</Link>
    </div>
    {summaryQuery.isLoading ? <LoadingBlock /> : summaryQuery.isError ? <ErrorState retry={() => summaryQuery.refetch()} /> : <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[1.35fr_.8fr_.8fr]">
        <article className="relative overflow-hidden rounded-3xl bg-[#315d4d] p-6 text-[#f8f4e8] md:p-7" data-testid="metric-total-spent"><div className="absolute -right-12 -top-20 h-56 w-56 rounded-full border border-white/10" /><div className="absolute -right-1 -top-9 h-36 w-36 rounded-full border border-white/10" /><div className="relative"><p className="text-sm text-[#c8d5c9]">Total written down</p><p className="mt-3 font-display text-4xl tracking-tight md:text-5xl">{money(summary?.totalCents || 0)}</p><p className="mt-5 flex items-center gap-2 text-xs text-[#c4d2c5]"><span className="grid h-6 w-6 place-items-center rounded-full bg-white/10"><ArrowDownRight size={13} /></span>Every note gives you a little more context.</p></div></article>
        <article className="soft-card rounded-3xl p-6" data-testid="metric-expense-count"><p className="text-sm text-[#79847a]">Things you noted</p><p className="mt-4 font-display text-4xl">{summary?.expenseCount ?? 0}</p><p className="mt-3 text-xs text-[#8b9488]">No right number. Just your number.</p></article>
        <article className="soft-card rounded-3xl p-6" data-testid="metric-average"><p className="text-sm text-[#79847a]">Average note</p><p className="mt-4 font-display text-4xl">{money(summary?.averageCents || 0)}</p><p className="mt-3 text-xs text-[#8b9488]">A helpful reference, not a target.</p></article>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <section className="soft-card rounded-3xl p-5 md:p-7" data-testid="chart-monthly-spending">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#879287]">Over time</p><h2 className="mt-1 font-display text-2xl">Your spending rhythm</h2></div><SummaryDateRange range={range} setRange={setRange} /></div>
          {chartData.length ? <ResponsiveContainer width="100%" height={240} debounce={0}><AreaChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
            <defs><linearGradient id="ledgerFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#638b6c" stopOpacity={.32} /><stop offset="100%" stopColor="#638b6c" stopOpacity={.015} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="#e9e6dc" strokeDasharray="3 6" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#899187', fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#899187', fontSize: 11 }} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} width={42} /><Tooltip formatter={(value: number) => [money(value), 'Spent']} contentStyle={{ border: '1px solid #e4dfd2', borderRadius: 14, background: '#fffdf8', boxShadow: '0 8px 24px #263b3315' }} /><Area type="monotone" dataKey="total" name="Spent" stroke="#47725a" strokeWidth={2.5} fill="url(#ledgerFill)" activeDot={{ r: 5, fill: '#47725a', stroke: '#fffdf8', strokeWidth: 3 }} isAnimationActive={false} />
          </AreaChart></ResponsiveContainer> : <ChartEmpty />}
        </section>
        <section className="soft-card rounded-3xl p-5 md:p-7" data-testid="chart-category-spending"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#879287]">Where it went</p><h2 className="mt-1 font-display text-2xl">By category</h2>
          {categoryData.length ? <><ResponsiveContainer width="100%" height={190} debounce={0}><BarChart data={categoryData} layout="vertical" margin={{ top: 10, right: 12, bottom: 0, left: 4 }}><CartesianGrid horizontal={false} stroke="#e9e6dc" strokeDasharray="3 6" /><XAxis type="number" hide /><YAxis type="category" dataKey="category" width={92} axisLine={false} tickLine={false} tick={{ fill: '#718078', fontSize: 12 }} /><Tooltip cursor={false} formatter={(value: number) => [money(value), 'Spent']} contentStyle={{ border: '1px solid #e4dfd2', borderRadius: 14, background: '#fffdf8' }} /><Bar dataKey="totalCents" name="Spent" fill="#789178" fillOpacity={.86} activeBar={{ fillOpacity: 1 }} radius={[0, 8, 8, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer><div className="mt-1 flex flex-wrap gap-2">{categoryData.map((item) => <span key={item.category} className={`rounded-full px-3 py-1.5 text-xs ${categoryTone[item.category]}`}>{item.category}<span className="ml-2 font-semibold">{money(item.totalCents)}</span></span>)}</div></> : <ChartEmpty />}
        </section>
      </div>
      <section className="soft-card rounded-3xl p-5 md:p-7" data-testid="section-recent-expenses">
        <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#879287]">Recently noted</p><h2 className="mt-1 font-display text-2xl">Your latest entries</h2></div><Link href="/expenses" className="inline-flex items-center gap-2 text-sm font-semibold text-[#456b54] hover:gap-3" data-testid="link-view-all">See all <ArrowRight size={16} /></Link></div>
        {listQuery.isLoading ? <div className="space-y-3">{[1,2,3].map(n => <div key={n} className="h-14 animate-pulse rounded-xl bg-[#eeece3]" />)}</div> : listQuery.isError ? <ErrorState retry={() => listQuery.refetch()} /> : latest.length ? <ExpenseRows expenses={latest} /> : <EmptyExpenses />}
      </section>
    </div>}
  </Shell>;
}
function ChartEmpty() { return <div className="grid h-[220px] place-items-center rounded-2xl bg-[#f4f2e9] text-center"><div><span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#e3e9dd] text-[#58745c]"><Leaf size={19} /></span><p className="mt-3 font-display text-lg">A picture will grow here</p><p className="mt-1 text-xs text-[#849084]">Add a few expenses to see your rhythm.</p></div></div>; }
function EmptyExpenses() {
  return <div className="rounded-2xl border border-dashed border-[#d9d7ca] bg-[#f8f6ef] px-6 py-10 text-center" data-testid="empty-expenses"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e7ede3] text-[#4c7258]"><Wallet size={23} /></span><h3 className="mt-4 font-display text-2xl">Your page is still open.</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#78847a]">Whenever you’re ready, add the first thing you spent on. There’s no need to have it all figured out.</p><Link href="/expenses" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#315d4d] px-5 py-3 text-sm font-semibold text-white hover:bg-[#254c3d]" data-testid="button-empty-add"><Plus size={16} />Add your first expense</Link></div>;
}

function ExpenseRows({ expenses }: { expenses: Expense[] }) {
  return <div className="divide-y divide-[#eeece3]">{expenses.map((expense) => {
    const Icon = categoryIcon[expense.category] || Wallet;
    return <Link href={`/expenses/${expense.id}`} key={expense.id} data-testid={`row-expense-${expense.id}`} className="group flex items-center gap-3 py-3.5 first:pt-1 last:pb-1 hover:translate-x-0.5">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${categoryTone[expense.category]}`}><Icon size={18} /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#34473c]">{expense.description}</span><span className="mt-1 block text-xs text-[#879087]">{expense.category} <span className="mx-1">·</span>{readableDate(expense.spentOn, { day: 'numeric', month: 'short' })}</span></span>
      <span className="text-sm font-semibold tabular-nums text-[#374b3e]">{money(expense.amountCents)}</span><ArrowRight size={16} className="ml-1 text-[#abb2a7] opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
    </Link>;
  })}</div>;
}

const expenseSchema = z.object({
  description: z.string().trim().min(1, 'Give this note a short name.').max(120, 'Keep the name under 120 characters.'),
  amount: z.coerce.number().positive('Enter an amount greater than zero.'),
  category: z.enum(categories as [string, ...string[]]),
  spentOn: z.string().min(1, 'Choose the day this happened.'),
  notes: z.string().max(280, 'Notes can be up to 280 characters.'),
});
type ExpenseFormValues = z.infer<typeof expenseSchema>;

function ExpenseForm({ initial, onSubmit, pending, onCancel, submitLabel }: { initial?: Expense; onSubmit: (input: ExpenseInput) => void; pending: boolean; onCancel?: () => void; submitLabel: string }) {
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: initial ? { description: initial.description, amount: initial.amountCents / 100, category: initial.category, spentOn: initial.spentOn, notes: initial.notes || '' } : { description: '', amount: undefined, category: ExpenseCategory.Food, spentOn: new Date().toISOString().slice(0, 10), notes: '' },
  });
  const submit = (values: ExpenseFormValues) => onSubmit({ description: values.description.trim(), amountCents: Math.round(values.amount * 100), category: values.category as ExpenseInput['category'], spentOn: values.spentOn, notes: values.notes.trim() });
  const field = (name: keyof ExpenseFormValues) => form.formState.errors[name]?.message as string | undefined;
  const control = 'h-12 rounded-xl border-[#e1ded3] bg-[#fffdf8] px-4 text-sm shadow-none focus-visible:ring-[#77977b]';
  return <Form {...form}><form onSubmit={form.handleSubmit(submit)} className="space-y-4" data-testid="form-expense">
    <div><label htmlFor="description" className="mb-1.5 block text-xs font-semibold text-[#596a5d]">What was it?</label><Input id="description" className={control} placeholder="A small description" {...form.register('description')} data-testid="input-expense-description" />{field('description') && <p className="mt-1 text-xs text-destructive">{field('description')}</p>}</div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div><label htmlFor="amount" className="mb-1.5 block text-xs font-semibold text-[#596a5d]">Amount in rupees</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#899187]">₹</span><Input id="amount" type="number" min="0.01" step="0.01" className={`${control} pl-9`} placeholder="0.00" {...form.register('amount')} data-testid="input-expense-amount" /></div>{field('amount') && <p className="mt-1 text-xs text-destructive">{field('amount')}</p>}</div>
      <div><label htmlFor="category" className="mb-1.5 block text-xs font-semibold text-[#596a5d]">Category</label><div className="relative"><select id="category" className={`${control} w-full appearance-none`} {...form.register('category')} data-testid="select-expense-category">{categories.map(c => <option key={c} value={c}>{c}</option>)}</select><ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#899187]" size={16} /></div></div>
    </div>
    <div><label htmlFor="spentOn" className="mb-1.5 block text-xs font-semibold text-[#596a5d]">Date</label><Input id="spentOn" type="date" className={control} {...form.register('spentOn')} data-testid="input-expense-date" />{field('spentOn') && <p className="mt-1 text-xs text-destructive">{field('spentOn')}</p>}</div>
    <div><label htmlFor="notes" className="mb-1.5 block text-xs font-semibold text-[#596a5d]">A note to remember <span className="font-normal text-[#9aa197]">· optional</span></label><Textarea id="notes" rows={3} className="resize-none rounded-xl border-[#e1ded3] bg-[#fffdf8] px-4 py-3 text-sm focus-visible:ring-[#77977b]" placeholder="Add a little context, if it helps." {...form.register('notes')} data-testid="input-expense-notes" /><div className="mt-1 flex justify-between text-xs text-[#91988e]">{field('notes') ? <span className="text-destructive">{field('notes')}</span> : <span>Only you will see this.</span>}<span>{form.watch('notes')?.length || 0}/280</span></div></div>
    <div className="flex justify-end gap-3 border-t border-[#ece9df] pt-4">{onCancel && <Button type="button" variant="ghost" onClick={onCancel} className="rounded-full" data-testid="button-cancel-expense">Cancel</Button>}<Button type="submit" disabled={pending} className="min-w-36 rounded-full bg-[#315d4d] hover:bg-[#254c3d]" data-testid="button-submit-expense">{pending ? <><LoaderCircle className="mr-2 animate-spin" size={16} />Saving…</> : <><Check className="mr-2" size={16} />{submitLabel}</>}</Button></div>
  </form></Form>;
}
function ExpenseDialog({ open, onClose, children, title, description }: { open: boolean; onClose: () => void; children: ReactNode; title: string; description: string }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1d302a]/40 px-0 backdrop-blur-[3px] sm:items-center sm:px-4" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] bg-[#f8f6ef] p-6 shadow-2xl sm:max-w-xl sm:rounded-[2rem] sm:p-8" role="dialog" aria-modal="true" aria-labelledby="expense-dialog-title">
      <div className="mb-6 flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#7c897d]">A moment for your journal</p><h2 id="expense-dialog-title" className="mt-1 font-display text-3xl">{title}</h2><p className="mt-1 text-sm text-[#7c887d]">{description}</p></div><button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#e9e6dc]" data-testid="button-close-expense"><X size={18} /></button></div>{children}
    </section>
  </div>;
}
function ExpensesPage() {
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const stableSearch = search.trim();
  const params = useMemo<ListExpensesParams>(() => ({ ...(stableSearch ? { search: stableSearch } : {}), ...(category ? { category: category as ExpenseInput['category'] } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }), [stableSearch, category, from, to]);
  const query = useListExpenses(params, { query: { queryKey: getListExpensesQueryKey(params) } });
  const create = useCreateExpense({ mutation: { onSuccess: async () => { await cache.invalidateQueries({ queryKey: getListExpensesQueryKey() }); await cache.invalidateQueries({ queryKey: ['/api/expenses/summary'] }); setOpen(false); } } });
  const clear = () => { setSearch(''); setCategory(''); setFrom(''); setTo(''); };
  return <Shell active="expenses">
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#819083]">Everyday, as it happened</p><h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">Your expenses.</h1><p className="mt-2 text-sm text-[#79847a]">A simple record, whenever you need one.</p></div><Button onClick={() => setOpen(true)} className="rounded-full bg-[#315d4d] px-5 hover:bg-[#254c3d]" data-testid="button-new-expense"><Plus size={17} className="mr-2" />Add expense</Button></div>
    <section className="soft-card mb-5 rounded-3xl p-4 md:p-5" data-testid="section-expense-filters">
      <div className="grid gap-3 md:grid-cols-[1.4fr_.8fr_.8fr_.8fr_auto]">
        <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#899187]" size={17} /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your notes…" className="h-11 rounded-xl border-[#e1ded3] bg-[#fffdf8] pl-11" data-testid="input-expense-search" /></div>
        <div className="relative"><select aria-label="Filter by category" value={category} onChange={e => setCategory(e.target.value)} className="h-11 w-full appearance-none rounded-xl border border-[#e1ded3] bg-[#fffdf8] px-4 text-sm text-[#516257]" data-testid="select-filter-category"><option value="">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#899187]" size={16} /></div>
        <Input aria-label="From date" type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-11 rounded-xl border-[#e1ded3] bg-[#fffdf8] text-sm" data-testid="input-filter-from" />
        <Input aria-label="To date" type="date" value={to} onChange={e => setTo(e.target.value)} className="h-11 rounded-xl border-[#e1ded3] bg-[#fffdf8] text-sm" data-testid="input-filter-to" />
        <Button variant="ghost" onClick={clear} className="h-11 rounded-xl px-3 text-[#718078]" data-testid="button-clear-filters"><Filter size={15} className="mr-2" />Clear</Button>
      </div>
    </section>
    {query.isLoading ? <div className="soft-card space-y-3 rounded-3xl p-6" data-testid="status-loading">{[1,2,3,4,5].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-[#eeece3]" />)}</div> : query.isError ? <ErrorState retry={() => query.refetch()} /> : <section className="soft-card rounded-3xl p-5 md:p-7" data-testid="list-expenses">
      <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#879287]">Your notes</p><h2 className="mt-1 font-display text-2xl">{query.data?.length || 0} {query.data?.length === 1 ? 'expense' : 'expenses'}</h2></div><span className="text-xs text-[#8b9488]">{stableSearch || category ? 'Matching your filters' : 'Newest first'}</span></div>
      {query.data?.length ? <ExpenseRows expenses={query.data} /> : stableSearch || category || from || to ? <div className="py-12 text-center" data-testid="empty-filtered"><p className="font-display text-2xl">Nothing matches those details.</p><p className="mt-2 text-sm text-[#79847a]">Try a different search or clear the filters.</p><Button variant="outline" className="mt-4 rounded-full" onClick={clear} data-testid="button-reset-filters">Clear filters</Button></div> : <EmptyExpenses />}
    </section>}
    <ExpenseDialog open={open} onClose={() => setOpen(false)} title="Add an expense" description="A quick note is all it needs."><ExpenseForm onCancel={() => setOpen(false)} onSubmit={(data) => create.mutate({ data })} pending={create.isPending} submitLabel="Save expense" /></ExpenseDialog>
  </Shell>;
}

function ExpenseDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const cache = useQueryClient();
  const query = useGetExpense(id, { query: { enabled: !!id, queryKey: getGetExpenseQueryKey(id) } });
  const update = useUpdateExpense({ mutation: { onSuccess: async (expense) => { cache.setQueryData(getGetExpenseQueryKey(id), expense); await cache.invalidateQueries({ queryKey: getListExpensesQueryKey() }); await cache.invalidateQueries({ queryKey: ['/api/expenses/summary'] }); } } });
  const remove = useDeleteExpense({ mutation: { onSuccess: async () => { await cache.invalidateQueries({ queryKey: getListExpensesQueryKey() }); await cache.invalidateQueries({ queryKey: ['/api/expenses/summary'] }); setLocation('/expenses'); } } });
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (query.isLoading) return <Shell active="expenses"><LoadingBlock /></Shell>;
  if (query.isError) return <Shell active="expenses"><ErrorState retry={() => query.refetch()} /></Shell>;
  if (!query.data) return <Shell active="expenses"><div className="soft-card rounded-3xl p-10 text-center"><h2 className="font-display text-3xl">We couldn’t find that note.</h2><Link href="/expenses" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#456b54]"><ArrowLeft size={16} />Back to expenses</Link></div></Shell>;
  const expense = query.data;
  const Icon = categoryIcon[expense.category] || Wallet;
  return <Shell active="expenses">
    <Link href="/expenses" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#718078] hover:text-[#315d4d]" data-testid="link-back-expenses"><ArrowLeft size={16} />All expenses</Link>
    <section className="soft-card mx-auto max-w-3xl rounded-[2rem] p-6 md:p-10" data-testid={`detail-expense-${expense.id}`}>
      <div className="flex items-start justify-between gap-4"><div className={`grid h-14 w-14 place-items-center rounded-2xl ${categoryTone[expense.category]}`}><Icon size={23} /></div><div className="flex gap-2"><Button variant="outline" onClick={() => setEditing(true)} className="rounded-full border-[#dcd9ce]" data-testid="button-edit-expense">Edit</Button><Button variant="outline" onClick={() => setConfirmDelete(true)} className="rounded-full border-[#ead6d0] text-[#a64f45] hover:bg-[#fbefea]" data-testid="button-delete-expense">Delete</Button></div></div>
      <p className="mt-8 text-xs font-bold uppercase tracking-[.16em] text-[#849084]">{expense.category} · {readableDate(expense.spentOn)}</p>
      <h1 className="mt-2 font-display text-4xl leading-tight md:text-5xl">{expense.description}</h1><p className="mt-4 font-display text-4xl text-[#456b54]">{money(expense.amountCents)}</p>
      {expense.notes ? <div className="mt-8 rounded-2xl bg-[#f3f1e9] p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#879287]">A note to remember</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#546459]">{expense.notes}</p></div> : <p className="mt-8 text-sm text-[#8a9389]">No extra note was added.</p>}
      {update.isSuccess && <p className="mt-6 flex items-center gap-2 text-sm text-[#4e7659]" data-testid="status-expense-saved"><Check size={16} />Your changes are saved.</p>}
      {update.isError && <p className="mt-6 text-sm text-destructive" data-testid="status-update-error">Couldn’t save that change. Please try again.</p>}
    </section>
    <ExpenseDialog open={editing} onClose={() => setEditing(false)} title="Edit this note" description="Make any changes you need."><ExpenseForm initial={expense} onCancel={() => setEditing(false)} onSubmit={data => update.mutate({ id, data }, { onSuccess: () => setEditing(false) })} pending={update.isPending} submitLabel="Save changes" /></ExpenseDialog>
    <ExpenseDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this note?" description="This note will be removed from your journal.">
      <div className="rounded-2xl bg-[#efede4] p-4"><p className="font-semibold">{expense.description}</p><p className="mt-1 text-sm text-[#7d887e]">{money(expense.amountCents)} · {readableDate(expense.spentOn)}</p></div>
      {remove.isError && <p className="mt-3 text-sm text-destructive" data-testid="status-delete-error">We couldn’t delete this expense. Please try again.</p>}
      <div className="mt-5 flex justify-end gap-3"><Button variant="ghost" onClick={() => setConfirmDelete(false)} className="rounded-full" data-testid="button-cancel-delete">Keep note</Button><Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate({ id })} className="rounded-full" data-testid="button-confirm-delete">{remove.isPending ? 'Deleting…' : 'Delete note'}</Button></div>
    </ExpenseDialog>
  </Shell>;
}

function ClerkRouter() {
  const [location, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Pick up where your money journal left off.' } }, signUp: { start: { title: 'Start your journal', subtitle: 'A little more clarity, one day at a time.' } } }}
    routerPush={to => setLocation(stripBase(to))} routerReplace={to => setLocation(stripBase(to), { replace: true })}>
    <QueryClientProvider client={queryClient}><CacheInvalidator /><TooltipProvider><ErrorBoundary resetKey={location.pathname}><Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/user-portal" component={PortalRoute} />
      <Route path="/expenses" component={ExpensesRoute} />
      <Route path="/expenses/:id" component={ExpenseDetailRoute} />
      <Route component={NotFound} />
    </Switch></ErrorBoundary><Toaster /></TooltipProvider></QueryClientProvider>
  </ClerkProvider>;
}
function App() {
  return <WouterRouter base={basePath}><ClerkRouter /></WouterRouter>;
}
export default App;
