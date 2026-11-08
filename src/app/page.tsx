import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">SoldOut</h1>
      <p className="mt-2 text-zinc-600">
        Fill seats for paid programs through communities families trust. Parents text JOIN, get answers only from the
        organizer&apos;s own content, and receive the enrollment link when they&apos;re ready.
      </p>
      <ul className="mt-6 space-y-2">
        <li><Link className="text-blue-600 underline" href="/intake">/intake</Link> — add an event and its content</li>
        <li><Link className="text-blue-600 underline" href="/dashboard">/dashboard</Link> — scoreboard, organizer inbox, strategy</li>
        <li><Link className="text-blue-600 underline" href="/simulate">/simulate</Link> — text the agent as a parent</li>
      </ul>
    </main>
  );
}
