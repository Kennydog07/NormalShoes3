// Creates a Stripe Checkout Session (hosted page, redirect) for lawful v4 items only.
// Reinstated from Kennydog07/NormalShoes and adapted to v4.
//
// Environment variables (same names as the original site):
//   STRIPE_SECRET_KEY   sk_live_... or sk_test_...  (STRIPE_SECRET_KET also accepted, as before)
//   STRIPE_PUBLISHABLE_KEY is no longer needed (hosted Checkout, no Stripe.js on the site).
//
// Prices live ONLY in data/products.json; the browser sends an id (and a quantity
// for blank disc packs). Inactive or unknown ids are refused. Route B (the compilation)
// is refused unless data/compilation.json status is "on sale". Route A requires the
// Disc Lab rights/use confirmation, which is stored as Stripe metadata.
const catalogue = require("../../data/products.json");
const compilation = require("../../data/compilation.json");

const STRIPE_API_VERSION = "2024-12-18.acacia";
// v2: "own rights incl. music; copies made by me, or by a nominee not connected to Normal Shoes and not paid to burn; personal use or given free"
const RIGHTS_TEXT_VERSION = "disc-lab-confirmation-v2";

const reply = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

function validate(req) {
  const id = typeof req.id === "string" ? req.id : "";
  const product = (catalogue.products || []).find((p) => p.id === id);
  if (!product) return { status: 400, error: "Unknown item." };
  if (!["A", "B", "C"].includes(product.route)) return { status: 400, error: "Item not available." };
  if (product.active !== true || !Number.isInteger(product.pricePence) || product.pricePence <= 0) return { status: 409, error: "Booking opens soon." };
  if (product.route === "B" && (product.id !== "compilation" || compilation.status !== "on sale")) return { status: 409, error: "Only sold once classified by the BBFC." };
  if (product.route === "A" && req.confirmRights !== true) return { status: 400, error: "Please tick the Disc Lab confirmation first." };
  let nominee = "";
  if (product.route === "A" && req.nomineeName != null && String(req.nomineeName).trim() !== "") {
    nominee = String(req.nomineeName).trim().replace(/[\u0000-\u001f]/g, "").slice(0, 100);
    if (req.nomineeConfirm !== true) return { status: 400, error: "Please confirm your nominee isn't connected to Normal Shoes and isn't paid to burn." };
  }
  let quantity = 1;
  if (product.quantityAdjustable) {
    quantity = Number(req.quantity);
    const perPack = Number(product.discsPerPack) || 1;
    const maxPacks = Math.floor((catalogue.maxDiscsPerSession || 10) / perPack);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxPacks) return { status: 400, error: `Maximum ${catalogue.maxDiscsPerSession || 10} discs per session.` };
  }
  if (product.shipping && (!Number.isInteger(product.shipping.pricePence) || product.shipping.pricePence < 0)) return { status: 409, error: "Booking opens soon." };
  return { product, quantity, nominee };
}
exports.validate = validate;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return reply(405, { error: "Method not allowed" });
  let req;
  try { req = JSON.parse(event.body || "{}"); } catch (e) { return reply(400, { error: "Bad request" }); }

  // Validate before checking the key, so bad/inactive ids are always refused.
  const v = validate(req);
  if (v.error) return reply(v.status, { error: v.error });

  const secretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KET;
  if (!secretKey) return reply(503, { error: "Online payment isn't set up yet." });

  const { product, quantity, nominee } = v;
  const site = process.env.URL || "https://normalshoes3.netlify.app";
  const p = new URLSearchParams();
  p.set("mode", "payment");
  p.set("success_url", `${site}/success?session_id={CHECKOUT_SESSION_ID}`);
  p.set("cancel_url", `${site}/cancelled`);
  p.set("billing_address_collection", "auto");
  p.set("line_items[0][quantity]", String(quantity));
  p.set("line_items[0][price_data][currency]", "gbp");
  p.set("line_items[0][price_data][unit_amount]", String(product.pricePence));
  p.set("line_items[0][price_data][product_data][name]", product.name);
  if (product.shipping) {
    p.set("shipping_address_collection[allowed_countries][0]", "GB");
    p.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
    p.set("shipping_options[0][shipping_rate_data][display_name]", product.shipping.label || "UK delivery");
    p.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(product.shipping.pricePence));
    p.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "gbp");
  }
  p.set("metadata[product_id]", product.id);
  p.set("metadata[route]", product.route);
  p.set("metadata[quantity]", String(quantity));
  if (product.route === "A") {
    p.set("metadata[disc_lab_confirmation]", "yes");
    p.set("metadata[disc_lab_confirmation_text]", RIGHTS_TEXT_VERSION);
    p.set("metadata[confirmed_at]", new Date().toISOString());
    p.set("metadata[nominee_name]", nominee || "none");
    p.set("metadata[nominee_not_connected_or_paid]", nominee ? "yes" : "n/a");
  }

  let res;
  try {
    res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded", "Stripe-Version": STRIPE_API_VERSION },
      body: p.toString(),
    });
  } catch (e) { return reply(502, { error: "Could not reach the payment provider." }); }
  const session = await res.json().catch(() => ({}));
  if (!res.ok || !session.url) {
    console.error("Stripe session creation failed:", res.status, session.error && session.error.message);
    return reply(502, { error: "Could not start payment." });
  }
  return reply(200, { url: session.url });
};
