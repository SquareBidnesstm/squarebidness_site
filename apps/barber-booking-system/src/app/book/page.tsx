import Link from "next/link";
import { BARBERS } from "@/lib/config/barbers";
import { SERVICES } from "@/lib/config/services";
import { SHOP } from "@/lib/config/shop";

export default function BookingPage() {
  return (
    <main className="min-h-screen bg-brand-bg text-white">
      <section className="container-shell py-16">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-brand-gold">
            {SHOP.name}
          </p>
          <h1 className="mt-2 text-4xl font-black">Book an Appointment</h1>
          <p className="mt-3 max-w-2xl text-brand-muted">
            Shared-account booking model. The client picks a barber, selects a
            service, then books a time.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="card-dark p-6">
            <h2 className="text-2xl font-bold">Choose a Barber</h2>
            <div className="mt-5 space-y-3">
              {BARBERS.map((barber) => (
                <Link
                  key={barber.id}
                  href={`/book/${barber.id}/`}
                  className="block rounded-2xl border border-brand-line bg-black/20 px-4 py-4 transition hover:border-brand-gold"
                >
                  <p className="font-semibold">{barber.displayName}</p>
                  <p className="text-sm text-brand-muted">{barber.role}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="card-dark p-6">
            <h2 className="text-2xl font-bold">Starter Service Menu</h2>
            <div className="mt-5 space-y-3">
              {SERVICES.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between rounded-2xl border border-brand-line bg-black/20 px-4 py-4"
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
