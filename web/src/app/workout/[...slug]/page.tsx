import { redirect } from 'next/navigation';

type WorkoutCatchAllPageProps = {
  params: Promise<{
    slug: string[];
  }>;
};

const extractCode = (input: string) => input.match(/[0-9a-z]{8}/i)?.[0] ?? null;

export default async function WorkoutCatchAllPage({ params }: WorkoutCatchAllPageProps) {
  const resolvedParams = await params;
  const slug = Array.isArray(resolvedParams.slug) ? resolvedParams.slug : [];
  const joined = slug.join('/');
  const code = extractCode(joined);
  if (code) {
    redirect(`/workout/${code}`);
  }
  redirect('/?invalidWorkoutShare=1');
}
