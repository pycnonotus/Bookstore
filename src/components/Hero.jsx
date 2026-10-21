export default function Hero() {
  return <section aria-labelledby="hero-title" className="bg-spruce-deep text-paper">
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 sm:py-16 md:grid-cols-[2fr_1fr] md:items-center lg:px-8 lg:py-20">
      <div className="min-w-0">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-amber-300">A little curiosity goes a long way</p>
        <h1 id="hero-title" className="max-w-2xl font-serif text-4xl leading-tight sm:text-5xl lg:text-6xl">Make room for your next great read.</h1>
        <p className="mt-5 max-w-lg leading-relaxed text-paper/80">Art, ideas, and discoveries. Explore our shelves and find something that stays with you long after the last page.</p>
        <a href="#catalog" className="mt-7 inline-block rounded bg-amber-300 px-6 py-3 font-semibold text-spruce-deep hover:bg-amber-200">Explore the shelves &rarr;</a>
        <a href="#events" className="ml-0 mt-4 block text-sm font-semibold text-amber-200 underline sm:ml-6 sm:inline-block">Upcoming events</a>
      </div>
      <div aria-hidden="true" className="flex h-44 min-w-0 items-end justify-center gap-2 border-b-8 border-paper/25 md:h-60">
        <span className="h-36 w-10 rounded-t bg-amber-300 md:h-48" />
        <span className="h-28 w-9 rounded-t border-t-8 border-white/30 bg-rose-400 md:h-40" />
        <span className="h-40 w-12 rounded-t border-t-8 border-white/30 bg-teal-600 md:h-56" />
        <span className="h-32 w-9 rounded-t bg-sky-300 md:h-44" />
        <span className="h-36 w-10 rounded-t border-t-8 border-white/30 bg-orange-400 md:h-52" />
      </div>
    </div>
  </section>;
}
