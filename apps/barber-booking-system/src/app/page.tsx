import Link from "next/link";
import { SHOP } from "@/lib/config/shop";
import { BARBERS } from "@/lib/config/barbers";
import { SERVICES } from "@/lib/config/services";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-brand-bg text-white">
      <section className="container-shell py-16">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <p className="inline-flex rounded-full border border-brand-line bg-brand-card px-4 py-2 text-sm text-brand-gold">
              Duplicatable Barber Booking System
            </p>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-5xl font-black leading-tight">
                Shop-owned booking system for multi-barber operations.
              </h1>
              <p className="max-w-2xl text-lg text-brand-muted">
                Built for barbershops that want one account, multiple barbers,
                clean booking flow, and real ownership of customer data.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/book/" className="btn-gold">
                Open Booking Page
              </Link>
              <Link href="/admin/" className="btn-dark">
                Open Admin Stub
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="card-dark p-5">
                <p className="text-sm text-brand-muted">Shop</p>
                <p className="mt-2 text-2xl font-bold">{SHOP.name}</p>
              </div>
              <div className="card-dark p-5">
                <p className="text-sm text-brand-muted">Owner</p>
                <p className="mt-2 text-2xl font-bold">{SHOP.owner}</p>
              </div>
              <div className="card-dark p-5">
                <p className="text-sm text-brand-muted">Barbers</p>
                <p className="mt-2 text-2xl font-bold">{BARBERS.length}</p>
              </div>
            </div>
          </div>

          <div className="card-dark p-6">
            <h2 className="text-2xl font-bold">Starter Services</h2>
            <div className="mt-5 space-y-3">
              {SERVICES.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between rounded-2xl border border-brand-line bg-black/20 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold">{service.name}</p>
                    <p className="text-sm text-brand-muted">
                      {service.durationMinutes} min
                    </p>
                  </div>
                  <p className="font-bold">${service.price}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
