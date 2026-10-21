import Header from './components/Header';
import Hero from './components/Hero';
import MainContent from './components/MainContent';
import Footer from './components/Footer';

export default function App() {
  return <div className="flex min-h-screen min-w-0 flex-col">
    <Header />
    <main className="flex-1"><Hero /><MainContent /></main>
    <Footer />
  </div>;
}
