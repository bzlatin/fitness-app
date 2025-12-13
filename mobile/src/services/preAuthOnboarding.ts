import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OnboardingData, PartialOnboardingData } from '../types/onboarding';

export type PreAuthOnboardingStatus = 'in_progress' | 'skipped' | 'completed';

export type PreAuthOnboardingStateV1 = {
  version: 1;
  status: PreAuthOnboardingStatus;
  updatedAt: string;
  data?: PartialOnboardingData;
  linkedUserId?: string;
};

const STORAGE_KEY = 'push-pull.pre-auth-onboarding.v1';

const nowIso = () => new Date().toISOString();

export const loadPreAuthOnboarding = async (): Promise<PreAuthOnboardingStateV1 | null> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PreAuthOnboardingStateV1;
    if (parsed?.version !== 1) return null;
    if (
      parsed.status !== 'in_progress' &&
      parsed.status !== 'skipped' &&
      parsed.status !== 'completed'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const savePreAuthOnboardingDraft = async (data: PartialOnboardingData) => {
  const next: PreAuthOnboardingStateV1 = {
    version: 1,
    status: 'in_progress',
    updatedAt: nowIso(),
    data,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

export const completePreAuthOnboarding = async (data: OnboardingData) => {
  const next: PreAuthOnboardingStateV1 = {
    version: 1,
    status: 'completed',
    updatedAt: nowIso(),
    data,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

export const skipPreAuthOnboarding = async () => {
  const next: PreAuthOnboardingStateV1 = {
    version: 1,
    status: 'skipped',
    updatedAt: nowIso(),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

export const markPreAuthOnboardingLinked = async (userId: string) => {
  const existing = await loadPreAuthOnboarding();
  if (!existing) return;
  if (existing.status !== 'completed') return;
  const next: PreAuthOnboardingStateV1 = {
    ...existing,
    updatedAt: nowIso(),
    linkedUserId: userId,
    data: undefined,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

export const clearPreAuthOnboarding = async () => {
  await AsyncStorage.removeItem(STORAGE_KEY);
};

export const isPreAuthOnboardingFinished = (state: PreAuthOnboardingStateV1 | null) =>
  state?.status === 'skipped' || state?.status === 'completed';
