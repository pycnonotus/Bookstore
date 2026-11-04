import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import AccountMenu from './AccountMenu';
import { useCart } from '../context/CartContext';

export default function Header() {
  const headerRef = useRef(null);
  const { count } = useCart();

  useLayoutEffect(() => {
    const header = headerRef.current;
    const updateHeight = () => document.documentElement.style.setProperty('--site-header-height', `${header.offsetHeight}px`);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(header);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--site-header-height');
    };
  }, []);

  return <header ref={headerRef} className="site-header sticky top-0 z-50 border-b border-spruce/20 bg-paper shadow-sm">
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6 lg:px-8">
      <Link to="/" className="font-serif text-2xl font-bold text-spruce-deep">Book Library<span className="text-amber-600">.</span></Link>
      <nav aria-label="Main navigation" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <a className="hover:underline" href="/#catalog">Browse books</a>
        <a className="hover:underline" href="/#staff-picks">Staff picks</a>
        <a className="hover:underline" href="/#events">Events</a>
        <a className="hover:underline" href="/#about">Our story</a>
        <a className="hover:underline" href="/#contact">Visit us</a>
        <Link className="font-semibold text-spruce hover:underline" to="/cart">Cart ({count})</Link>
      </nav>
      <AccountMenu />
    </div>
  </header>;
}
