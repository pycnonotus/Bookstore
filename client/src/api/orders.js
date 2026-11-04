async function request(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Unable to load your order. Please try again.');
    error.status = response.status;
    throw error;
  }
  return data;
}

export const placeOrder = cart => request('/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ requestId: cart.requestId, items: cart.items }),
});
export const loadOrders = (id, signal) => request(id ? `/api/orders/${encodeURIComponent(id)}` : '/api/orders', { signal });
export const formatMoney = (cents, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
