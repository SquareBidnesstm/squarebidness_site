import createCheckoutHandler from "./create-checkout.js";

export default async function handler(req, res) {
  return createCheckoutHandler(req, res);
}
