import { create } from 'zustand';

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('user')) || null,
  token: localStorage.getItem('access_token') || null,
  isAuthenticated: !!localStorage.getItem('access_token'),

  login: (userData, token) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    set({ user: userData, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  setUser: (userData) => {
    localStorage.setItem('user', JSON.stringify(userData));
    set({ user: userData });
  },

  refreshUser: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const userData = await res.json();
        localStorage.setItem('user', JSON.stringify(userData));
        set({ user: userData, isAuthenticated: true });
      }
    } catch (e) {
      console.warn("Failed to refresh user profile:", e);
    }
  }
}));

export default useAuthStore;
