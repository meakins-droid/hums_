import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api` : "/api",
});


api.interceptors.request.use((config) => {
  const token = localStorage.getItem("hums_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("hums_token");
      localStorage.removeItem("hums_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// Downloads a file the API streams back (Excel exports). Uses the same axios
// instance so the JWT header is attached, then hands the blob to the browser.
export async function downloadFile(url, fallbackName) {
  const res = await api.get(url, { responseType: "blob" });
  const disposition = res.headers["content-disposition"] || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const name = match ? match[1] : fallbackName;
  const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export default api;
