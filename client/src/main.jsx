import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import { CartProvider } from './context/CartContext';

createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter><CartProvider><App/></CartProvider></BrowserRouter>
    </React.StrictMode>
);
