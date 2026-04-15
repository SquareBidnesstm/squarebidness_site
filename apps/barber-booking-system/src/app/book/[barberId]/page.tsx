import { notFound } from "next/navigation";
import { BARBERS } from "@/lib/config/barbers";
import { SERVICES } from "@/lib/config/services";
import { SHOP } from "@/lib/config/shop";

type PageProps = {
  params: Promise<{ barberId: string }>;
};

export default async function BarberBookingPage({ params }: PageProps) {
  const { barberId } = await params;
  const barber = BARBERS.find((item) => item.id === barberId);

  if (!barber) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-brand-bg text-white">
      <section className="container-shell py-16">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-brand-gold">
            {SHOP.name}
          </p>
          <h1 className="mt-2 text-4xl font-black">
            Book with {barber.displayName}
          </h1>
          <p className="mt-3 max-w-2xl text-brand-muted">
            This is the barber-specific booking lane. Later this page will use
            live availability from Supabase.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="card-dark p-6">
            <h2 className="text-2xl font-bold">Barber Details</h2>
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-brand-line bg-black/20 px-4 py-4">
                <p className="font-semibold">{barber.displayName}</p>
                <p className="text-sm text-brand-muted">{barber.role}</p>
              </div>
              <div className="rounded-2xl border border-brand-line bg-black/20 px-4 py-4">
                <p className="font-semibold">Booking Link</p>
                <p className="text-sm text-brand-muted">
                  /book/{barber.id}/
                </p>
              </div>
            </div>
          </div>

          <div className="card-dark p-6">
            <h2 className="text-2xl font-bold">Available Services</h2>
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

        <div className="card-dark mt-8 p-6">
          <h2 className="text-2xl font-bold">Booking Form Stub</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <input
              className="rounded-2xl border border-brand-line bg-black/20 px-4 py-3 text-white outline-none"
              placeholder="Client name"
            />
            <input
              className="rounded-2xl border border-brand-line bg-black/20 px-4 py-3 text-white outline-none"
              placeholder="Phone"
            />
            <input
              className="rounded-2xl border border-brand-line bg-black/20 px-4 py-3 text-white outline-none"
              placeholder="Email"
            />
            <select className="rounded-2xl border border-brand-line bg-black/20 px-4 py-3 text-white outline-none">
              {SERVICES.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </div>

          <button className="btn-gold mt-5">Save Booking Stub</button>
        </div>
      </section>
    </main>
  );
}
