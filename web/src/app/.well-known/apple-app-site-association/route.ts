export const dynamic = 'force-dynamic';

const resolveTeamId = () =>
  (
    process.env.APPLE_TEAM_ID ||
    process.env.EXPO_APPLE_TEAM_ID ||
    process.env.EXPO_APPLE_DEVELOPER_TEAM_ID ||
    process.env.EXPO_PUBLIC_APPLE_TEAM_ID ||
    ''
  )
    .toString()
    .trim();

const resolveBundleId = () =>
  (process.env.IOS_BUNDLE_ID || process.env.NEXT_PUBLIC_IOS_BUNDLE_ID || 'com.pushpull.app')
    .toString()
    .trim();

export async function GET() {
  const teamId = resolveTeamId();
  const bundleId = resolveBundleId();

  if (!teamId) {
    return Response.json(
      { error: 'APPLE_TEAM_ID is not configured for apple-app-site-association' },
      { status: 500 }
    );
  }

  const appId = `${teamId}.${bundleId}`;

  return Response.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appID: appId,
            paths: ['/workout/*'],
          },
        ],
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

