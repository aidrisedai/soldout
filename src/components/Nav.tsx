import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`font-display text-2xl text-ink ${className}`}>
      Sold<span className="text-clay">Out</span>
    </Link>
  );
}

// Shared top bar for every page.
export default function Nav({ links = [], cta = true }: { links?: { href: string; label: string }[]; cta?: boolean }) {
  return (
    <header className="border-b border-line/70 bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <Logo />
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hidden rounded-full px-3 py-1.5 text-ink/80 hover:bg-sand hover:text-ink md:inline-block">{l.label}</Link>
          ))}
          {cta && (
            <Link href="/intake" className="ml-1 rounded-full bg-clay px-4 py-2 font-semibold text-white hover:bg-clay-dark">Start a campaign</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
