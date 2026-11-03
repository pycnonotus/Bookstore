import { events } from '../data/events';

export default function Events() {
  return <section id="events" aria-labelledby="events-title" className="bg-sky-900 text-paper">
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h2 id="events-title" className="font-serif text-3xl sm:text-4xl">Beyond the bookshelf</h2>
      <p className="mt-3 max-w-xl text-paper/80">Good books bring people together. Sample events from our bookstore community.</p>
      <div className="mt-8 grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {events.map(event => <article key={event.id} className="flex min-w-0 flex-col gap-4 rounded-xl border border-white/25 p-5 sm:flex-row">
          <time dateTime={event.dateTime} className="flex h-20 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-amber-300 text-spruce-deep">
            <span className="text-xs font-semibold uppercase">{event.month}</span><span className="text-3xl font-bold">{event.day}</span>
          </time>
          <div className="flex min-w-0 flex-1 flex-col">
            <h3 className="wrap-break-word font-serif text-xl font-semibold">{event.title}</h3>
            <p className="mt-2 text-sm text-amber-200">{event.meta}</p>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-paper/80">{event.description}</p>
            <a href={`mailto:Totaly@real.mail?subject=${encodeURIComponent(`Seat inquiry: ${event.title}`)}`} className="mt-5 self-start rounded border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-white/10">Ask about a seat &rarr;</a>
          </div>
        </article>)}
      </div>
    </div>
  </section>;
}
