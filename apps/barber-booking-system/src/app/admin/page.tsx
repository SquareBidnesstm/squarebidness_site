import { BARBERS } from "@/lib/config/barbers";
import { SERVICES } from "@/lib/config/services";
import { SHOP } from "@/lib/config/shop";

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-brand-bg text-white">
      <section className="container-shell py-16">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-brand-gold">
            Admin Stub
          </p>
          <h1 className="mt-2 text-4xl font-black">{SHOP.name} Dashboard</h1>
          <p className="mt-3 max-w-2xl text-brand-muted">
            This is the starter admin lane. Later this becomes bookings,
            blocked time, services, barbers, settings, and reporting.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="card-dark p-5">
            <p className="text-sm text-brand-muted">Barbers</p>
            <p className="mt-2 text-3xl font-black">{BARBERS.length}</p>
          </div>
          <div className="card-dark p-5">
            <p className="text-sm text-brand-muted">Services</p>
            <p className="mt-2 text-3xl font-black">{SERVICES.length}</p>
          </div>
          <div className="card-dark p-5">
            <p className="text-sm text-brand-muted">Deposits</p>
            <p className="mt-2 text-3xl font-black">
              {SHOP.requireDeposit ? "On" : "Off"}
            </p>
          </div>
        </div>

        <div className="card-dark mt-8 p-6">
          <h2 className="text-2xl font-bold">Next Admin Modules</h2>
          <div className="mt-5 space-y-3 text-brand-muted">
            <p>• bookings table</p>
            <p>• block time controls</p>
            <p>• barber management</p>
            <p>• service management</p>
            <p>• business hours settings</p>
            <p>• Stripe deposit toggle</p>
          </div>
        </div>
      </section>
    </main>
  );
}
