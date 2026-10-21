import Header from './components/Header';
import Hero from './components/Hero';
import MainContent from './components/MainContent';
import Footer from './components/Footer';
import Events from './components/Events';
import { useState } from 'react';
import StaffPicks from './components/StaffPicks';
import BookChat from './components/BookChat';

export default function App() {
  const [savedIds, setSavedIds] = useState(new Set());
  function setSaved(id, saved) {
    setSavedIds(previous => {
      const next = new Set(previous);
      if (saved) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  return <div className="flex min-h-screen min-w-0 flex-col">
    <Header />
    <main className="flex-1"><Hero /><BookChat savedIds={savedIds} onSavedChange={setSaved} /><MainContent savedIds={savedIds} onSavedChange={setSaved} /><StaffPicks savedIds={savedIds} onSavedChange={setSaved} /><Events /></main>
    <Footer />
  </div>;
}
