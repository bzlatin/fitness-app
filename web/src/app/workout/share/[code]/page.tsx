import { redirect } from 'next/navigation';

type WorkoutShareRedirectPageProps = {
  params: {
    code: string;
  };
};

export default function WorkoutShareRedirectPage({ params }: WorkoutShareRedirectPageProps) {
  const raw = (params.code ?? '').trim();
  redirect(`/workout/${raw}`);
}

