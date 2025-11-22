import { User } from "../types/user";

export function canCreateAnotherTemplate(user: User | null, currentTemplateCount: number): boolean {
  if (user?.plan === "pro" || user?.plan === "lifetime") {
    return true;
  }

  return currentTemplateCount < 5;
}

export function isPro(user: User | null): boolean {
  return user?.plan === "pro" || user?.plan === "lifetime";
}
