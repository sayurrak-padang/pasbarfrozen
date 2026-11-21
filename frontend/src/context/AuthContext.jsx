import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("rsp_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (name, email, password, phone = "", email_code = "") => {
    const { data } = await api.post("/auth/register", { name, email, password, phone: phone || null, email_code });
    localStorage.setItem("rsp_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const otpLogin = async (phone, code) => {
    const { data } = await api.post("/auth/otp/login", { phone, code });
    localStorage.setItem("rsp_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const emailOtpLogin = async (email, code) => {
    const { data } = await api.post("/auth/email-otp/login", { email, code });
    localStorage.setItem("rsp_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch (e) { console.warn("Logout request failed", e); }
    localStorage.removeItem("rsp_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, otpLogin, emailOtpLogin, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
