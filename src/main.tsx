import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./map/maplibre-gl.css";
import { registerServiceWorker } from "./lib/pushNotifications";

registerServiceWorker().catch(() => {});

createRoot(document.getElementById("root")!).render(<App />);
