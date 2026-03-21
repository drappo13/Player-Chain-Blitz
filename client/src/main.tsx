import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Signal to stale-cache detector that app loaded successfully
(window as any).__pcbLoaded = true;
