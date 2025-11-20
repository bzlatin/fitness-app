import { User } from "../types/user";

export function canCreateAnotherTemplate(user: User, currentTemplateCount: number): boolean {
  if (user.plan === "pro" || user.plan === "lifetime") {
    return true;
  }

  return currentTemplateCount < 5;
}

export function isPro(user: User): boolean {
  return user.plan === "pro" || user.plan === "lifetime";
}
