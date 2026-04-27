const RAW_BASE = import.meta.env.VITE_API_URL ?? '';
const API_BASE = RAW_BASE.replace(/\/+$/, '');

export function apiUrl(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}

export function apiFetch(path: string, init?: RequestInit) {
  return fetch(apiUrl(path), init);
}
