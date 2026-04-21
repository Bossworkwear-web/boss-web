import { redirect } from "next/navigation";

type SignUpPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "mode" || value === undefined) {
      continue;
    }
    const v = Array.isArray(value) ? value[0] : value;
    if (v) {
      qs.set(key, v);
    }
  }
  qs.set("mode", "signup");
  redirect(`/log-in?${qs.toString()}`);
}
