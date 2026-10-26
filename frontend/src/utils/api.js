export const getAuthHeaders = (extraHeaders = {}) => {
  const token = localStorage.getItem('access_token');
  const headers = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const authFetch = async (url, options = {}) => {
  const headers = getAuthHeaders(options.headers || {});
  return fetch(url, { ...options, headers });
};

export default authFetch;
