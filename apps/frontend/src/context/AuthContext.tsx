import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getMe, logout as apiLogout } from '../services/api';
import type { User } from '../types';
type AuthValue = { user: User | null; loading: boolean; logout: () => Promise<void> };
const AuthContext = createContext<AuthValue | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) { const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true); useEffect(() => { getMe().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false)); }, []); const logout = async () => { await apiLogout(); setUser(null); }; return <AuthContext.Provider value={{ user, loading, logout }}>{children}</AuthContext.Provider>; }
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value; }
