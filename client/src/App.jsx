import Header from './components/Header';
import Hero from './components/Hero';
import MainContent from './components/MainContent';
import Footer from './components/Footer';
import Events from './components/Events';
import {useState} from 'react';
import StaffPicks from './components/StaffPicks';
import { Link, Route, Routes } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import CartPage from './pages/CartPage';
import OrdersPage from './pages/OrdersPage';
import RequireSession from './components/RequireSession';

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
        <Header/>
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<>
            <Hero/>
            <MainContent savedIds={savedIds} onSavedChange={setSaved}/>
            <StaffPicks savedIds={savedIds} onSavedChange={setSaved}/><Events/>
            </>} />
            <Route path="/login" element={<AuthPage key="login" mode="login" />} />
            <Route path="/register" element={<AuthPage key="register" mode="register" />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/orders" element={<RequireSession><OrdersPage /></RequireSession>} />
            <Route path="/orders/:id" element={<RequireSession><OrdersPage /></RequireSession>} />
            <Route path="*" element={<div className="mx-auto max-w-lg px-6 py-20"><h1 className="font-serif text-3xl">Page not found</h1><Link to="/" className="mt-4 inline-block text-spruce underline">Back to the bookstore</Link></div>} />
          </Routes>
        </main>
        <Footer/>
    </div>;
}
