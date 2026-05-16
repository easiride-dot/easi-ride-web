export default async function handler(req: any, res: any) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).send("Method not allowed");
  }

  const orderId = req.query.orderId ? String(req.query.orderId) : "";
  const query = new URLSearchParams();

  if (orderId) query.set("orderId", orderId);

  res.writeHead(303, { Location: `/checkout/complete?${query.toString()}` });
  return res.end();
}
