import { create } from 'zustand';
import { User, auth } from '@/lib/auth';

interface UserStore {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: () => void;
  loginWithGoogle: () => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: () => {
    window.location.href = auth.getGitHubLoginUrl();
  },

  loginWithGoogle: () => {
    window.location.href = auth.getGoogleLoginUrl();
  },

  logout: async () => {
    await auth.logout();
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const user = await auth.verifyToken();
      set({ 
        user, 
        isAuthenticated: !!user,
        isLoading: false 
      });
    } catch (error) {
      set({ 
        user: null, 
        isAuthenticated: false,
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
}));