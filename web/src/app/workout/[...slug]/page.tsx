import { redirect } from 'next/navigation';

type WorkoutCatchAllPageProps = {
  params: {
    slug: string[];
  };
};

const extractCode = (input: string) => input.match(/[0-9a-z]{8}/i)?.[0] ?? null;

export default function WorkoutCatchAllPage({ params }: WorkoutCatchAllPageProps) {
  const slug = Array.isArray(params.slug) ? params.slug : [];
  const joined = slug.join('/');
  const code = extractCode(joined);
  if (code) {
    redirect(`/workout/${code}`);
  }
  redirect('/?invalidWorkoutShare=1');
}

