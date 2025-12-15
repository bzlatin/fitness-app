import { redirect } from 'next/navigation';

type WorkoutShareRedirectPageProps = {
  params: Promise<{
    code: string;
  }>;
};

export default async function WorkoutShareRedirectPage({ params }: WorkoutShareRedirectPageProps) {
  const resolvedParams = await params;
  const raw = (resolvedParams.code ?? '').trim();
  redirect(`/workout/${raw}`);
}
