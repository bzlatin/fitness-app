"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../db");
const SEEDED_USER_IDS = [
    'demo-user',
    'demo-lifter',
    'coach-amy',
    'iron-mile',
    'neon-flash',
    'pulse-strider',
    'corecraft',
    'tempo-squad',
    'lifty-liz',
];
const parseArgs = (argv) => {
    const args = new Set(argv.slice(2));
    return {
        execute: args.has('--execute'),
        dryRun: !args.has('--execute'),
    };
};
const requireConfirmation = (execute) => {
    if (!execute)
        return;
    const confirm = process.env.CONFIRM_TEST_DATA_PURGE;
    if (confirm !== 'DELETE_TEST_DATA') {
        throw new Error('Refusing to run destructive purge without CONFIRM_TEST_DATA_PURGE=DELETE_TEST_DATA.');
    }
};
const collectTestUserIds = async () => {
    const result = await (0, db_1.query)(`
      SELECT id
      FROM users
      WHERE id = ANY($1::text[])
         OR (email IS NOT NULL AND LOWER(email) LIKE '%@example.com')
    `, [SEEDED_USER_IDS]);
    return Array.from(new Set(result.rows.map((row) => row.id)));
};
const countRows = async (sql, params) => {
    const result = await (0, db_1.query)(sql, params);
    return Number(result.rows[0]?.count ?? 0);
};
const tableExists = async (tableName) => {
    const result = await (0, db_1.query)(`SELECT to_regclass($1) IS NOT NULL AS exists`, [tableName]);
    return Boolean(result.rows[0]?.exists);
};
const main = async () => {
    const { execute, dryRun } = parseArgs(process.argv);
    requireConfirmation(execute);
    const testUserIds = await collectTestUserIds();
    const hasSubscriptionEvents = await tableExists("subscription_events");
    const waitlistCount = await countRows(`SELECT COUNT(*)::text AS count FROM waitlist_emails WHERE LOWER(email) LIKE '%@example.com'`, []);
    const counts = {
        users: testUserIds.length,
        workoutTemplates: await countRows(`SELECT COUNT(*)::text AS count FROM workout_templates WHERE user_id = ANY($1::text[])`, [testUserIds]),
        templateShares: await countRows(`SELECT COUNT(*)::text AS count FROM template_shares WHERE created_by = ANY($1::text[])`, [testUserIds]),
        subscriptionEvents: hasSubscriptionEvents
            ? await countRows(`SELECT COUNT(*)::text AS count FROM subscription_events WHERE user_id = ANY($1::text[])`, [testUserIds])
            : 0,
        appstoreNotifications: await countRows(`SELECT COUNT(*)::text AS count FROM appstore_notifications WHERE user_id = ANY($1::text[])`, [testUserIds]),
        waitlistEmails: waitlistCount,
    };
    console.log('[purge-test-data] Mode:', dryRun ? 'DRY RUN' : 'EXECUTE');
    console.log('[purge-test-data] Test users found:', testUserIds.length);
    if (testUserIds.length) {
        console.log('  -', testUserIds.join(', '));
    }
    console.log('[purge-test-data] Row counts:', counts);
    if (dryRun) {
        console.log('[purge-test-data] Dry run only. Re-run with --execute and CONFIRM_TEST_DATA_PURGE=DELETE_TEST_DATA to apply.');
        return;
    }
    if (testUserIds.length === 0 && waitlistCount === 0) {
        console.log('[purge-test-data] Nothing to purge.');
        return;
    }
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        if (testUserIds.length) {
            if (hasSubscriptionEvents) {
                await client.query(`DELETE FROM subscription_events WHERE user_id = ANY($1::text[])`, [testUserIds]);
            }
            await client.query(`DELETE FROM appstore_notifications WHERE user_id = ANY($1::text[])`, [testUserIds]);
            await client.query(`DELETE FROM template_shares WHERE created_by = ANY($1::text[])`, [testUserIds]);
            await client.query(`DELETE FROM workout_templates WHERE user_id = ANY($1::text[])`, [testUserIds]);
            await client.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [
                testUserIds,
            ]);
        }
        if (waitlistCount) {
            await client.query(`DELETE FROM waitlist_emails WHERE LOWER(email) LIKE '%@example.com'`);
        }
        await client.query('COMMIT');
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
    console.log('[purge-test-data] Purge complete.');
};
main()
    .catch((error) => {
    console.error('[purge-test-data] Failed:', error);
    process.exitCode = 1;
})
    .finally(async () => {
    await db_1.pool.end();
});
