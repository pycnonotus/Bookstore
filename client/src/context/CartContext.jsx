import { createContext, useContext, useEffect, useState } from 'react';

const CartContext = createContext(null);
const key = 'book-library-cart-v1';
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const emptyCart = () => ({ requestId: crypto.randomUUID(), items: [] });

function loadCart() {
  try {
    const cart = JSON.parse(localStorage.getItem(key));
    if (uuid(cart?.requestId) && Array.isArray(cart.items) && cart.items.length <= 100 &&
      cart.items.every(item => uuid(item?.bookId) && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 99) &&
      new Set(cart.items.map(item => item.bookId)).size === cart.items.length) return cart;
  } catch { /* Storage can be unavailable. */ }
  return emptyCart();
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(loadCart);
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(cart)); } catch { /* In-memory cart still works. */ }
  }, [cart]);

  function update(bookId, getQuantity) {
    setCart(previous => {
      const current = previous.items.find(item => item.bookId === bookId)?.quantity || 0;
      const quantity = getQuantity(current);
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99 || quantity === current) return previous;
      if (!current && previous.items.length >= 100) return previous;
      const items = previous.items.filter(item => item.bookId !== bookId);
      if (quantity) items.push({ bookId, quantity });
      return { requestId: crypto.randomUUID(), items };
    });
  }

  return <CartContext.Provider value={{
    ...cart,
    count: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    add: bookId => update(bookId, quantity => quantity + 1),
    setQuantity: (bookId, quantity) => update(bookId, () => quantity),
    clear: requestId => setCart(previous => previous.requestId === requestId ? emptyCart() : previous),
  }}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
