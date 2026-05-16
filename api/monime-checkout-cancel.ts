export default async function handler(req: any, res: any) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).send("Method not allowed");
  }

  const orderId = req.query.orderId ? String(req.query.orderId) : "";
  const plan = req.query.plan === "solo" ? "solo" : "shared";
  const query = new URLSearchParams({ payment: "cancelled" });

  if (orderId) query.set("orderId", orderId);

  res.writeHead(303, { Location: `/checkout/${plan}?${query.toString()}` });
  return res.end();
}
