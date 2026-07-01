import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Apply saved theme (default: dark)
const saved = (() => { try { return localStorage.getItem("scada.theme"); } catch { return null; } })();
if (saved === "light") {
  document.documentElement.classList.remove("dark");
} else {
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")!).render(<App />);
