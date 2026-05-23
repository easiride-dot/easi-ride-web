import express from "express";
import { loadEnv } from "vite";

const app = express();
app.use(express.json());

Object.assign(process.env, loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), ""));

const { default: reverseGeocode } = await import("../api/reverse-geocode.ts");
const { default: calculateTripFare } = await import("../api/calculate-trip-fare.ts");
const { default: searchLocations } = await import("../api/search-locations.ts");
const { default: monimeCreateCheckout } = await import("../api/monime-create-checkout.ts");
const { default: monimeVerifyCheckout } = await import("../api/monime-verify-checkout.ts");
const { default: monimeCheckoutSuccess } = await import("../api/monime-checkout-success.ts");
const { default: monimeCheckoutCancel } = await import("../api/monime-checkout-cancel.ts");
const { default: monimeStkPush } = await import("../api/monime-stk-push.ts");
const { default: monimeWebhook } = await import("../api/monime-webhook.ts");

app.post("/api/reverse-geocode", reverseGeocode);
app.post("/api/calculate-trip-fare", calculateTripFare);
app.get("/api/search-locations", searchLocations);
app.post("/api/monime-create-checkout", monimeCreateCheckout);
app.post("/api/monime-verify-checkout", monimeVerifyCheckout);
app.all("/api/monime-checkout-success", monimeCheckoutSuccess);
app.all("/api/monime-checkout-cancel", monimeCheckoutCancel);
app.post("/api/monime-stk-push", monimeStkPush);
app.post("/api/monime-webhook", monimeWebhook);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
