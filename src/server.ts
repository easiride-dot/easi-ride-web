import express from "express";
import { createServer, loadEnv } from "vite";

type ApiHandler = (req: express.Request, res: express.Response) => Promise<unknown> | unknown;

Object.assign(process.env, loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), ""));

const vite = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

const loadHandler = async (path: string): Promise<ApiHandler> => {
  const mod = await vite.ssrLoadModule(path);
  return mod.default as ApiHandler;
};

const app = express();
app.use(express.json());

app.post("/api/reverse-geocode", await loadHandler("/api/reverse-geocode.ts"));
app.post("/api/calculate-trip-fare", await loadHandler("/api/calculate-trip-fare.ts"));
app.get("/api/search-locations", await loadHandler("/api/search-locations.ts"));
app.post("/api/monime-create-checkout", await loadHandler("/api/monime-create-checkout.ts"));
app.post("/api/monime-verify-checkout", await loadHandler("/api/monime-verify-checkout.ts"));
app.all("/api/monime-checkout-success", await loadHandler("/api/monime-checkout-success.ts"));
app.all("/api/monime-checkout-cancel", await loadHandler("/api/monime-checkout-cancel.ts"));
app.post("/api/monime-stk-push", await loadHandler("/api/monime-stk-push.ts"));
app.post("/api/monime-webhook", await loadHandler("/api/monime-webhook.ts"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
