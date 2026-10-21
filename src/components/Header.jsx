export default function Header() {
  return <header className="border-b border-spruce/20">
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
      <a href="#" className="font-serif text-2xl font-bold text-spruce-deep">Book Library<span className="text-amber-600">.</span></a>
      <nav aria-label="Main navigation" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <a className="hover:underline" href="#catalog">Browse books</a>
        <a className="hover:underline" href="#about">Our story</a>
        <a className="hover:underline" href="#contact">Visit us</a>
      </nav>
    </div>
  </header>;
}
