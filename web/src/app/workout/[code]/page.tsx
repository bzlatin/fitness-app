import WorkoutShareClient from './workoutShareClient';

type WorkoutSharePageProps = {
  params: { code?: string } | Promise<{ code?: string }>;
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
};

const extractCode = (input: string) => input.match(/[0-9a-z]{8}/i)?.[0]?.toLowerCase() ?? null;

const getSearchParam = (params: Record<string, string | string[] | undefined>, key: string) => {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
};

export default async function WorkoutSharePage({ params, searchParams }: WorkoutSharePageProps) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});

  const raw = String(resolvedParams?.code ?? '').trim();
  const code = extractCode(raw);
  const debug = getSearchParam(resolvedSearchParams, 'debug') === '1';

  return <WorkoutShareClient raw={raw} code={code} debug={debug} />;
}

