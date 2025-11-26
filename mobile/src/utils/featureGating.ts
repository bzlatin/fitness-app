import { User } from "../types/user";

export const FREE_TEMPLATE_LIMIT = 3;

export function canCreateAnotherTemplate(user: User | null, currentTemplateCount: number): boolean {
  if (user?.plan === "pro" || user?.plan === "lifetime") {
    return true;
  }

  return currentTemplateCount < FREE_TEMPLATE_LIMIT;
}

export function isPro(user: User | null): boolean {
  return user?.plan === "pro" || user?.plan === "lifetime";
}
