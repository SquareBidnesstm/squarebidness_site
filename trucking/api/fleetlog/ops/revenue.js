import Stripe from "stripe";
export const config = { runtime: "nodejs" };

export default async function handler(req,res){
  const admin = process.env.FLEETLOG_ADMIN_TOKEN;
  if(req.query.admin !== admin) return res.status(401).json({ok:false});

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const subs = await stripe.subscriptions.list({ limit:100 });

  let mrr = 0;
  let single = 0;
  let fleet = 0;

  subs.data.forEach(s=>{
    if(s.status === "active"){
      const amount = s.items.data[0]?.price?.unit_amount || 0;
      mrr += amount;
      if(s.metadata?.tier === "fleet") fleet++;
      else single++;
    }
  });

  res.json({
    ok:true,
    mrr: mrr/100,
    active: subs.data.length,
    single,
    fleet
  });
}
