export const dynamic = 'force-dynamic';

const resolveAndroidPackage = () =>
  (process.env.ANDROID_PACKAGE_NAME || process.env.NEXT_PUBLIC_ANDROID_PACKAGE || 'com.pushpull.app')
    .toString()
    .trim();

const resolveFingerprints = () => {
  const raw =
    (process.env.ANDROID_SHA256_CERT_FINGERPRINTS ||
      process.env.NEXT_PUBLIC_ANDROID_SHA256_CERT_FINGERPRINTS ||
      '')
      .toString()
      .trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
};

export async function GET() {
  const packageName = resolveAndroidPackage();
  const fingerprints = resolveFingerprints();

  if (!fingerprints.length) {
    return Response.json(
      { error: 'ANDROID_SHA256_CERT_FINGERPRINTS is not configured for assetlinks.json' },
      { status: 500 }
    );
  }

  return Response.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

