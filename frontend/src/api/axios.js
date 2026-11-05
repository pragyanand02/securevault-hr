import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

let accessToken = null;
let refreshPromise = null;

export const setAccessToken = (token) => {
  accessToken = token || null;
};

export const getAccessToken = () => accessToken;

const api = axios.create({
  baseURL,
  withCredentials: true, // httpOnly refresh cookie
});

// Attach the short-lived access token (kept in memory, not localStorage, so an
// XSS payload cannot read it from persistent storage).
api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

const isAuthEndpoint = (url = '') =>
  url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh');

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !isAuthEndpoint(original.url)
    ) {
      original._retry = true;
      try {
        refreshPromise = refreshPromise || axios
          .post(`${baseURL}/auth/refresh`, {}, { withCredentials: true })
          .then((res) => {
            setAccessToken(res.data.accessToken);
            return res.data;
          })
          .finally(() => { refreshPromise = null; });

        const data = await refreshPromise;
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        setAccessToken(null);
        window.dispatchEvent(new Event('auth:logout'));
      }
    }

    return Promise.reject(error);
  }
);

export default api;
