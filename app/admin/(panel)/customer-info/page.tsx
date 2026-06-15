import { CustomerInfoClient } from "./customer-info-client";

export const dynamic = "force-dynamic";

type CustomerInfoPageProps = {
  searchParams: Promise<{
    impersonate_error?: string;
    email?: string;
  }>;
};

export default async function CustomerInfoPage({ searchParams }: CustomerInfoPageProps) {
  const params = await searchParams;
  return (
    <CustomerInfoClient
      initialImpersonateError={params.impersonate_error ?? null}
      initialEmail={params.email ?? null}
    />
  );
}

