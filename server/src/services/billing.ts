import { query } from "../db";

type UserBillingRow = {
  plan: string | null;
  plan_expires_at: string | null;
  apple_original_transaction_id: string | null;
  apple_subscription_id: string | null;
  subscription_platform: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
};

export const fetchUserBilling = async (userId: string) => {
  const result = await query<UserBillingRow>(
    `
      SELECT plan,
             plan_expires_at,
             apple_original_transaction_id,
             apple_subscription_id,
             subscription_platform,
             trial_started_at,
             trial_ends_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );
  if (!result.rowCount) {
    throw new Error("User not found");
  }
  return result.rows[0];
};

