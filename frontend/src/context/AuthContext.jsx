import { createContext, useContext, useState, useEffect } from "react";
import { fetchCurrentUser, logoutUser } from "../services/api.js";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const storedUser = localStorage.getItem("user");
        try {
            return storedUser ? JSON.parse(storedUser) : null;
        } catch {
            return null;
        }
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const storedUser = localStorage.getItem("user");

            if (storedUser) {
                try {
                    const data = await fetchCurrentUser();
                    setUser(data.user);
                    localStorage.setItem("user", JSON.stringify(data.user));
                } catch {
                    localStorage.removeItem("user");
                    setUser(null);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        };

        initAuth();
    }, []);

    const login = (userData) => {
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
    };

    const refreshUser = async () => {
        try {
            const data = await fetchCurrentUser();
            setUser(data.user);
            localStorage.setItem("user", JSON.stringify(data.user));
        } catch {
            console.error("Failed to refresh user");
        }
    };

    const logout = async () => {
        setUser(null);
        localStorage.removeItem("user");
        try {
            await logoutUser();
        } catch (error) {
            console.error("Logout error", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
