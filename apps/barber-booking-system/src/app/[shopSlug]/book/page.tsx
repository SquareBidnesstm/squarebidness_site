import { redirect } from "next/navigation";

// /[shopSlug]/book → redirect to /[shopSlug] (the barber selector landing page)
export default async function BookLanding({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;
  redirect(`/${shopSlug}`);
}
