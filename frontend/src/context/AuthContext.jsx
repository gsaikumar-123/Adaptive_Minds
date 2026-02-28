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
            const storedToken = localStorage.getItem("token");

            if (storedUser && storedToken) {
                try {
                    const data = await fetchCurrentUser(storedToken);
                    setUser(data.user);
                    localStorage.setItem("user", JSON.stringify(data.user));
                } catch {
                    localStorage.removeItem("user");
                    localStorage.removeItem("token");
                    setUser(null);
                }
            } else {
                localStorage.removeItem("user");
                localStorage.removeItem("token");
                setUser(null);
            }
            setLoading(false);
        };

        initAuth();
    }, []);

    const login = (userData, token) => {
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
        if (token) {
            localStorage.setItem("token", token);
        }
    };

    const refreshUser = async () => {
        try {
            const token = localStorage.getItem("token");
            const data = await fetchCurrentUser(token);
            setUser(data.user);
            localStorage.setItem("user", JSON.stringify(data.user));
        } catch {
            console.error("Failed to refresh user");
        }
    };

    const logout = async () => {
        setUser(null);
        localStorage.removeItem("token");
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
