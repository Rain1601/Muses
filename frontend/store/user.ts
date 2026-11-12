import { create } from 'zustand';
import { User, auth } from '@/lib/auth';

interface UserStore {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Browsing the dashboard without logging in (per-tab, sessionStorage). */
  isGuest: boolean;

  login: () => void;
  loginWithGoogle: () => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
  enterGuestMode: () => void;
}

const GUEST_KEY = 'muses-guest';

function readGuestFlag(): boolean {
  try {
    return typeof window !== 'undefined' && sessionStorage.getItem(GUEST_KEY) === '1';
  } catch {
    return false;
  }
}

function writeGuestFlag(on: boolean) {
  try {
    if (on) sessionStorage.setItem(GUEST_KEY, '1');
    else sessionStorage.removeItem(GUEST_KEY);
  } catch {
    // storage unavailable (private mode etc.) — guest state just won't survive a reload
  }
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isGuest: false,

  login: () => {
    window.location.href = auth.getGitHubLoginUrl();
  },

  loginWithGoogle: () => {
    window.location.href = auth.getGoogleLoginUrl();
  },

  logout: async () => {
    await auth.logout();
    writeGuestFlag(false);
    set({ user: null, isAuthenticated: false, isGuest: false });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      // Pick up token from URL if present (OAuth redirect)
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');
        if (urlToken) {
          await auth.handleCallback(urlToken);
          // Remove token from URL without reload
          const clean = window.location.pathname;
          window.history.replaceState({}, '', clean);
        }
      }

      const user = await auth.verifyToken();
      if (user) writeGuestFlag(false);
      set({
        user,
        isAuthenticated: !!user,
        isGuest: !user && readGuestFlag(),
        isLoading: false
      });
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        isGuest: readGuestFlag(),
        isLoading: false
      });
    }
  },

  setUser: (user) => {
    set({ 
      user, 
      isAuthenticated: !!user 
    });
  },

  enterGuestMode: () => {
    writeGuestFlag(true);
    set({ isGuest: true });
  },
}));