// web/src/contexts/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import {
  login as loginApi,
  verifyLoginOtp,
  getProfile,
  logout as logoutApi,
} from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Held in memory only — never persisted. If the user refreshes the
  // page mid-OTP, they fall back to the credentials step, which is
  // the safe behavior (the challenge is single-use anyway).
  const [pendingChallenge, setPendingChallenge] = useState(null);

  /* ================================================================
   | Bootstrap — restore session from localStorage, then refresh
   | the user against /profile to catch revoked tokens.
   | ================================================================ */
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (token && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setIsAuthenticated(true);

          const profileResponse = await getProfile();
          if (profileResponse.data) {
            const freshUser = profileResponse.data;
            setUser(freshUser);
            localStorage.setItem('user', JSON.stringify(freshUser));

            if (!freshUser.has_web_access) {
              console.warn('User does not have web access, logging out...');
              await logout();
            }
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
          setIsAuthenticated(false);
        }
      }
      setLoading(false);
    };

    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ================================================================
   | STEP 1 — Credentials
   |
   | Returns one of:
   |   { success: true }
   |   { requiresOtp: true, challengeId, maskedEmail, expiresIn }
   |   { success: false, error, status }
   | ================================================================ */
  const beginLogin = async (email, password) => {
    try {
      const response = await loginApi(email, password);
      const data = response.data || {};

      // ---------------------------------------------------------------
      // Enforcer path (or any role not covered by WEB_OTP_ROLES).
      // Backend returned a token directly — same shape as the old API.
      // ---------------------------------------------------------------
      if (data.token && data.user) {
        if (!data.user.has_web_access) {
          return {
            success: false,
            error:
              'This account does not have web access. Please use the mobile app.',
            status: 403,
          };
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        setIsAuthenticated(true);
        setPendingChallenge(null);

        return { success: true };
      }

      // ---------------------------------------------------------------
      // Admin/staff path — OTP was emailed.
      // ---------------------------------------------------------------
      if (data.requires_otp && data.challenge_id) {
        const challenge = {
          challengeId: data.challenge_id,
          maskedEmail: data.masked_email || email,
          expiresIn: data.expires_in || 600,
          email, // kept for resend
        };
        setPendingChallenge(challenge);

        return {
          requiresOtp: true,
          ...challenge,
        };
      }

      // ---------------------------------------------------------------
      // Neither a token nor a challenge — the server is misbehaving or
      // a proxy stripped the response. Don't guess; surface it.
      // ---------------------------------------------------------------
      return {
        success: false,
        error:
          data.message || 'Unexpected response from server. Please try again.',
        status: response.status,
      };
    } catch (error) {
      console.error('Login error:', error.response?.data || error.message);

      const status = error.response?.status;
      const serverMessage = error.response?.data?.message;

      let errorMessage = 'Login failed. Please check your credentials.';

      if (status === 401) {
        errorMessage = 'Invalid email or password.';
      } else if (status === 403) {
        errorMessage =
          serverMessage || 'Account is deactivated or access denied.';
      } else if (status === 422) {
        errorMessage = serverMessage || 'Please check the information you entered.';
      } else if (status === 429) {
        errorMessage =
          serverMessage ||
          'Too many attempts. Please wait a few minutes and try again.';
      } else if (status === 500) {
        // The backend deliberately hides the real error in production.
        // In dev, its `debug` payload (if present) is far more useful.
        errorMessage =
          serverMessage ||
          'The server ran into an error. Please try again in a moment.';
      } else if (status === 419) {
        errorMessage =
          'Session expired. Please refresh the page and try again.';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Connection timeout. Please check your network.';
      } else if (error.message === 'Network Error') {
        errorMessage =
          'Cannot connect to the server. Please make sure the API is running.';
      } else if (serverMessage) {
        errorMessage = serverMessage;
      }

      return {
        success: false,
        error: errorMessage,
        status,
        debug: error.response?.data?.debug || null,
      };
    }
  };

  /* ================================================================
   | STEP 2 — Verify OTP
   |
   | Returns one of:
   |   { success: true }
   |   { success: false, error, attemptsRemaining?, status? }
   | ================================================================ */
  const completeLogin = async (challengeId, code) => {
    try {
      const response = await verifyLoginOtp(challengeId, code);
      const data = response.data || {};

      if (!data.token || !data.user) {
        return {
          success: false,
          error:
            data.message ||
            'Unexpected response from server. Please try again.',
          status: response.status,
        };
      }

      if (!data.user.has_web_access) {
        return {
          success: false,
          error: 'This account does not have web access.',
          status: 403,
        };
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      setIsAuthenticated(true);
      setPendingChallenge(null);

      return { success: true };
    } catch (error) {
      console.error(
        'OTP verify error:',
        error.response?.data || error.message,
      );

      const status = error.response?.status;
      const serverMessage = error.response?.data?.message;
      const attemptsRemaining = error.response?.data?.attempts_remaining;

      let errorMessage = 'Could not verify the code. Please try again.';

      if (status === 422) {
        errorMessage = serverMessage || 'Incorrect or expired code.';
      } else if (status === 429) {
        errorMessage =
          serverMessage ||
          'Too many attempts. Please wait a few minutes and try again.';
      } else if (status === 401 || status === 403) {
        errorMessage =
          serverMessage || 'Your session expired. Please sign in again.';
      } else if (status === 500) {
        errorMessage =
          serverMessage ||
          'The server ran into an error. Please try again in a moment.';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Connection timeout. Please check your network.';
      } else if (error.message === 'Network Error') {
        errorMessage = 'Cannot connect to the server.';
      } else if (serverMessage) {
        errorMessage = serverMessage;
      }

      return {
        success: false,
        error: errorMessage,
        attemptsRemaining,
        status,
      };
    }
  };

  /* ================================================================
   | Convenience wrapper. Older callers that just want `login()`
   | can still use it — the shape is compatible with the previous
   | version except `requiresOtp` is now exposed.
   | ================================================================ */
  const login = async (email, password) => {
    const result = await beginLogin(email, password);

    if (result.requiresOtp) {
      return {
        success: false,
        requiresOtp: true,
        challengeId: result.challengeId,
        maskedEmail: result.maskedEmail,
        expiresIn: result.expiresIn,
      };
    }

    return result;
  };

  /* ================================================================
   | Logout — safe to call even if the token is already gone.
   | ================================================================ */
  const logout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await logoutApi();
      }
    } catch (error) {
      // Server-side revoke failed, but we still need to clear locally.
      console.error('Logout API error:', error?.response?.data || error.message);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setIsAuthenticated(false);
      setPendingChallenge(null);
    }
  };

  /* ================================================================
   | Helpers
   | ================================================================ */
  const resetPendingChallenge = () => setPendingChallenge(null);

  const hasRole = (roles) => {
    if (!user) return false;
    if (typeof roles === 'string') return user.role === roles;
    return roles.includes(user.role);
  };

  const isAdmin = () => user?.role === 'admin';
  const isStaff = () => user?.role === 'staff';
  const isEnforcer = () => user?.role === 'enforcer';
  const hasWebAccess = () => user?.has_web_access === true;
  const hasMobileAccess = () => user?.has_mobile_access === true;

  const refreshUser = async () => {
    try {
      const response = await getProfile();
      const freshUser = response.data;
      setUser(freshUser);
      localStorage.setItem('user', JSON.stringify(freshUser));
      return freshUser;
    } catch (error) {
      console.error('Refresh user error:', error);
      return null;
    }
  };

  /* ================================================================
   | Context value
   | ================================================================ */
  const value = {
    user,
    loading,
    isAuthenticated,
    pendingChallenge,

    // High-level auth
    login,           // convenience — one call, may return requiresOtp
    beginLogin,      // step 1 — credentials
    completeLogin,   // step 2 — OTP
    logout,

    // Challenge management (used by Login.jsx if the user navigates
    // back to the credentials step)
    resetPendingChallenge,

    // Role helpers
    hasRole,
    isAdmin,
    isStaff,
    isEnforcer,
    hasWebAccess,
    hasMobileAccess,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;