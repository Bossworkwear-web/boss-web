/** Live deployment fingerprint — verify bossworkwear.au serves the latest Production build. */
export function GET() {
  return Response.json({
    gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    gitCommitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    builtAt: process.env.VERCEL_BUILD_COMPLETED_AT ?? null,
  });
}
