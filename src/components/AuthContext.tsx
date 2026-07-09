import React, { createContext, useContext, useEffect, useState } from 'react';

// We mock FirebaseUser
interface MockUser {
  uid: string;
  email: string;
  displayName: string;
}

interface AuthContextType {
  user: MockUser | null;
  token: string | null;
  loading: boolean;
  signInWithPassword: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<MockUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('ducvinh_auth_token');
    if (savedToken === 'DucVinh@123') {
      setToken(savedToken);
      setUser({ uid: 'admin', email: 'admin@ducvinh.com', displayName: 'Admin' });
    }
    setLoading(false);
  }, []);

  const signInWithPassword = async (password: string) => {
    setLoading(true);
    if (password === 'DucVinh@123') {
      localStorage.setItem('ducvinh_auth_token', password);
      setToken(password);
      setUser({ uid: 'admin', email: 'admin@ducvinh.com', displayName: 'Admin' });
    } else {
      setLoading(false);
      throw new Error('Mã bảo mật không chính xác!');
    }
    setLoading(false);
  };

  const logout = async () => {
    localStorage.removeItem('ducvinh_auth_token');
    setUser(null);
    setToken(null);
  };

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    headers.set('Content-Type', 'application/json');
    return fetch(url, { ...options, headers });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signInWithPassword, logout, fetchWithAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
