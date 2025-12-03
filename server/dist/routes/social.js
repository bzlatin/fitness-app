"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const id_1 = require("../utils/id");
const SQUAD_MEMBERS_AGGREGATE = `
  SELECT s.id, s.name, s.created_by,
    COALESCE(
      json_agg(
        json_build_object(
          'id', u.id,
          'name', u.name,
          'handle', u.handle,
          'avatar_url', u.avatar_url,
          'role', sm.role
        ) ORDER BY sm.joined_at ASC
      ) FILTER (WHERE u.id IS NOT NULL),
      '[]'::json
    ) AS members
  FROM squads s
  JOIN squad_members sm ON sm.squad_id = s.id
  JOIN users u ON u.id = sm.user_id
`;
const mapSquadRow = (row, viewerId) => {
    const members = row.members ?? [];
    return {
        id: row.id,
        name: row.name,
        isOwner: row.created_by === viewerId,
        memberCount: members.length,
        members: members.map((member) => ({
            id: member.id,
            name: member.name ?? "Athlete",
            handle: member.handle ?? undefined,
            avatarUrl: member.avatar_url ?? undefined,
            role: member.role ?? undefined,
        })),
    };
};
const fetchSquadsForUser = async (userId) => {
    const result = await (0, db_1.query)(`
      ${SQUAD_MEMBERS_AGGREGATE}
      WHERE s.id IN (
        SELECT squad_id FROM squad_members WHERE user_id = $1
      )
      GROUP BY s.id
      ORDER BY s.name
    `, [userId]);
    return result.rows.map((row) => mapSquadRow(row, userId));
};
const fetchSquadById = async (userId, squadId) => {
    const result = await (0, db_1.query)(`
      ${SQUAD_MEMBERS_AGGREGATE}
      WHERE s.id = $2
        AND s.id IN (
          SELECT squad_id FROM squad_members WHERE user_id = $1
        )
      GROUP BY s.id
    `, [userId, squadId]);
    if (result.rowCount === 0) {
        return null;
    }
    return mapSquadRow(result.rows[0], userId);
};
const router = (0, express_1.Router)();
const normalizeHandle = (value) => {
    if (!value)
        return undefined;
    const cleaned = value.replace(/^@+/, "").trim().toLowerCase();
    if (!cleaned)
        return undefined;
    return `@${cleaned}`;
};
const mapUserRow = (row) => ({
    id: row.id,
    name: row.name ?? "Athlete",
    email: row.email ?? undefined,
    handle: row.handle ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    bio: row.bio ?? undefined,
    plan: row.plan ?? "free",
    planExpiresAt: row.plan_expires_at,
    profileCompletedAt: row.profile_completed_at,
    trainingStyle: row.training_style,
    gymName: row.gym_name,
    gymVisibility: row.gym_visibility ?? "hidden",
    weeklyGoal: row.weekly_goal ?? 4,
    onboardingData: row.onboarding_data ?? undefined,
    progressiveOverloadEnabled: row.progressive_overload_enabled ?? undefined,
    restTimerSoundEnabled: row.rest_timer_sound_enabled ?? undefined,
});
const fetchUserSummary = async (userId) => {
    const result = await (0, db_1.query)(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [userId]);
    const row = result.rows[0];
    return {
        id: userId,
        name: row?.name ?? "Athlete",
        handle: row?.handle ?? undefined,
        avatarUrl: row?.avatar_url ?? undefined,
    };
};
const fetchRelationshipCounts = async (userId) => {
    const followers = await (0, db_1.query)(`SELECT COUNT(*)::text as count FROM follows WHERE target_user_id = $1`, [userId]);
    const following = await (0, db_1.query)(`SELECT COUNT(*)::text as count FROM follows WHERE user_id = $1`, [userId]);
    const friends = await (0, db_1.query)(`
      SELECT COUNT(*)::text as count
      FROM follows f
      JOIN follows f2
        ON f.user_id = $1
       AND f.target_user_id = f2.user_id
       AND f2.target_user_id = $1
    `, [userId]);
    return {
        followersCount: Number(followers.rows[0]?.count ?? 0),
        followingCount: Number(following.rows[0]?.count ?? 0),
        friendsCount: Number(friends.rows[0]?.count ?? 0),
    };
};
const fetchMutualFriends = async (userId, limit = 12) => {
    const result = await (0, db_1.query)(`
      SELECT u.*
      FROM follows f
      JOIN follows f2
        ON f.user_id = $1
       AND f.target_user_id = f2.user_id
       AND f2.target_user_id = $1
      JOIN users u
        ON u.id = f.target_user_id
      ORDER BY u.name ASC
      LIMIT $2
    `, [userId, limit]);
    return result.rows.map((row) => ({
        id: row.id,
        name: row.name ?? "Athlete",
        handle: row.handle ?? undefined,
        avatarUrl: row.avatar_url ?? undefined,
    }));
};
const fetchSharedFriends = async (viewerId, targetUserId, limit = 12) => {
    const shared = await (0, db_1.query)(`
      SELECT u.*
      FROM users u
      WHERE u.id IN (
        SELECT f.target_user_id
        FROM follows f
        JOIN follows f2
          ON f.user_id = $1
         AND f.target_user_id = f2.user_id
         AND f2.target_user_id = $1
      )
      AND u.id IN (
        SELECT f.target_user_id
        FROM follows f
        JOIN follows f2
          ON f.user_id = $2
         AND f.target_user_id = f2.user_id
         AND f2.target_user_id = $2
      )
      ORDER BY u.name ASC
      LIMIT $3
    `, [viewerId, targetUserId, limit]);
    return shared.rows.map((row) => ({
        id: row.id,
        name: row.name ?? "Athlete",
        handle: row.handle ?? undefined,
        avatarUrl: row.avatar_url ?? undefined,
    }));
};
const fetchWorkoutStats = async (userId) => {
    const sessions = await (0, db_1.query)(`SELECT finished_at
     FROM workout_sessions
     WHERE user_id = $1 AND finished_at IS NOT NULL
     ORDER BY finished_at DESC
     LIMIT 90`, [userId]);
    const workoutsCompleted = sessions.rowCount ?? 0;
    const formatIso = (value) => typeof value === "string" ? value : value.toISOString();
    const uniqueDays = Array.from(new Set(sessions.rows.map((row) => formatIso(row.finished_at).slice(0, 10)))).sort((a, b) => (a > b ? -1 : 1));
    let streak = 0;
    let previousDiff = null;
    const today = new Date();
    for (const day of uniqueDays) {
        const dayDate = new Date(`${day}T00:00:00Z`);
        const diffDays = Math.floor((today.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24));
        if (previousDiff === null) {
            if (diffDays > 1)
                break;
            streak = 1;
            previousDiff = diffDays;
            continue;
        }
        if (diffDays === previousDiff + 1) {
            streak += 1;
            previousDiff = diffDays;
        }
        else {
            break;
        }
    }
    return { workoutsCompleted, currentStreakDays: streak || undefined };
};
const fetchProfile = async (viewerId, targetUserId) => {
    const userResult = await (0, db_1.query)(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [targetUserId]);
    const user = userResult.rows[0];
    if (!user)
        return null;
    const counts = await fetchRelationshipCounts(targetUserId);
    const stats = await fetchWorkoutStats(targetUserId);
    const friendsPreview = viewerId === targetUserId
        ? await fetchMutualFriends(targetUserId, 12)
        : await fetchSharedFriends(viewerId, targetUserId, 12);
    const isFollowingResult = await (0, db_1.query)(`SELECT 1 FROM follows WHERE user_id = $1 AND target_user_id = $2 LIMIT 1`, [viewerId, targetUserId]);
    return {
        ...mapUserRow(user),
        ...counts,
        ...stats,
        friendsPreview,
        isFollowing: (isFollowingResult.rowCount ?? 0) > 0,
    };
};
const canView = (ownerId, visibility, viewerId, following, mutual) => {
    if (visibility === "private")
        return ownerId === viewerId;
    if (visibility === "followers") {
        return ownerId === viewerId || following.has(ownerId);
    }
    return ownerId === viewerId || mutual.has(ownerId);
};
const mapStatus = (row) => ({
    id: row.session_id,
    user: {
        id: row.user_id,
        name: row.name ?? "Athlete",
        handle: row.handle ?? undefined,
        avatarUrl: row.avatar_url ?? undefined,
    },
    templateId: row.template_id ?? undefined,
    templateName: row.template_name ?? undefined,
    startedAt: row.started_at,
    currentExerciseName: row.current_exercise_name ?? undefined,
    visibility: row.visibility,
    isActive: row.is_active,
    elapsedSeconds: Math.max(0, Math.floor((Date.now() - new Date(row.started_at).getTime()) / 1000)),
});
const mapShare = (row) => ({
    id: row.id,
    user: {
        id: row.user_id,
        name: row.name ?? "Athlete",
        handle: row.handle ?? undefined,
        avatarUrl: row.avatar_url ?? undefined,
    },
    sessionId: row.session_id ?? "",
    templateName: row.template_name ?? undefined,
    totalSets: row.total_sets ?? 0,
    totalVolume: row.total_volume ? Number(row.total_volume) : undefined,
    prCount: row.pr_count ?? undefined,
    createdAt: row.created_at,
    visibility: row.visibility,
    progressPhotoUrl: row.progress_photo_url ?? undefined,
});
router.get("/me", async (_req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const profile = await fetchProfile(userId, userId);
        if (!profile) {
            return res.status(404).json({ error: "User not found" });
        }
        return res.json(profile);
    }
    catch (err) {
        console.error("Failed to load current profile", err);
        return res.status(500).json({ error: "Failed to load profile" });
    }
});
router.put("/me", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const { name, handle, bio, avatarUrl, profileCompletedAt, trainingStyle, gymName, gymVisibility, weeklyGoal, onboardingData, progressiveOverloadEnabled, restTimerSoundEnabled, } = req.body;
    const handleProvided = Object.prototype.hasOwnProperty.call(req.body, "handle");
    const normalizedHandle = handleProvided ? normalizeHandle(handle) : undefined;
    if (name !== undefined && !name.trim()) {
        return res.status(400).json({ error: "Name cannot be empty" });
    }
    if (gymVisibility &&
        gymVisibility !== "hidden" &&
        gymVisibility !== "shown") {
        return res.status(400).json({ error: "Invalid gym visibility" });
    }
    if (progressiveOverloadEnabled !== undefined &&
        typeof progressiveOverloadEnabled !== "boolean") {
        return res.status(400).json({ error: "Invalid progressive overload flag" });
    }
    const updates = [];
    const values = [];
    let idx = 2;
    if (name !== undefined) {
        updates.push(`name = $${idx}`);
        values.push(name.trim());
        idx += 1;
    }
    if (handleProvided) {
        updates.push(`handle = $${idx}`);
        values.push(normalizedHandle ?? null);
        idx += 1;
    }
    if (bio !== undefined) {
        updates.push(`bio = $${idx}`);
        values.push(bio);
        idx += 1;
    }
    if (avatarUrl !== undefined) {
        updates.push(`avatar_url = $${idx}`);
        values.push(avatarUrl);
        idx += 1;
    }
    if (profileCompletedAt !== undefined) {
        updates.push(`profile_completed_at = $${idx}`);
        values.push(profileCompletedAt);
        idx += 1;
    }
    if (trainingStyle !== undefined) {
        updates.push(`training_style = $${idx}`);
        values.push(trainingStyle);
        idx += 1;
    }
    if (gymName !== undefined) {
        updates.push(`gym_name = $${idx}`);
        values.push(gymName ?? null);
        idx += 1;
    }
    if (gymVisibility !== undefined) {
        updates.push(`gym_visibility = $${idx}`);
        values.push(gymVisibility);
        idx += 1;
    }
    if (weeklyGoal !== undefined) {
        updates.push(`weekly_goal = $${idx}`);
        values.push(weeklyGoal);
        idx += 1;
    }
    if (onboardingData !== undefined) {
        updates.push(`onboarding_data = $${idx}`);
        values.push(onboardingData); // pg driver automatically handles JSONB serialization
        idx += 1;
    }
    if (progressiveOverloadEnabled !== undefined) {
        updates.push(`progressive_overload_enabled = $${idx}`);
        values.push(progressiveOverloadEnabled);
        idx += 1;
    }
    if (restTimerSoundEnabled !== undefined) {
        updates.push(`rest_timer_sound_enabled = $${idx}`);
        values.push(restTimerSoundEnabled);
        idx += 1;
    }
    if (updates.length === 0) {
        const profile = await fetchProfile(userId, userId);
        return res.json(profile);
    }
    updates.push(`updated_at = NOW()`);
    try {
        const result = await (0, db_1.query)(`
        UPDATE users
        SET ${updates.join(", ")}
        WHERE id = $1
        RETURNING *
      `, [userId, ...values]);
        const updated = result.rows[0];
        const counts = await fetchRelationshipCounts(userId);
        const stats = await fetchWorkoutStats(userId);
        return res.json({
            ...mapUserRow(updated),
            ...counts,
            ...stats,
            friendsPreview: await fetchMutualFriends(userId, 12),
            isFollowing: false,
        });
    }
    catch (err) {
        if (err instanceof Error &&
            "code" in err &&
            err.code === "23505") {
            return res.status(409).json({ error: "Handle already taken" });
        }
        console.error("Failed to update profile", err);
        return res.status(500).json({ error: "Failed to update profile" });
    }
});
router.delete("/me", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        await (0, db_1.query)(`DELETE FROM users WHERE id = $1`, [userId]);
        return res.status(204).send();
    }
    catch (err) {
        console.error("Failed to delete account", err);
        return res.status(500).json({ error: "Failed to delete account" });
    }
});
router.get("/profile/:id", async (req, res) => {
    const viewerId = res.locals.userId;
    if (!viewerId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const profile = await fetchProfile(viewerId, req.params.id);
        if (!profile) {
            return res.status(404).json({ error: "User not found" });
        }
        return res.json(profile);
    }
    catch (err) {
        console.error("Failed to load profile", err);
        return res.status(500).json({ error: "Failed to load profile" });
    }
});
router.get("/connections", async (_req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const following = await (0, db_1.query)(`
        SELECT u.*
        FROM follows f
        JOIN users u ON u.id = f.target_user_id
        WHERE f.user_id = $1
        ORDER BY u.name ASC
      `, [userId]);
        const followers = await (0, db_1.query)(`
        SELECT u.*
        FROM follows f
        JOIN users u ON u.id = f.user_id
        WHERE f.target_user_id = $1
        ORDER BY u.name ASC
      `, [userId]);
        const followingList = following.rows.map((row) => ({
            id: row.id,
            name: row.name ?? "Athlete",
            handle: row.handle ?? undefined,
            avatarUrl: row.avatar_url ?? undefined,
        }));
        const followersList = followers.rows.map((row) => ({
            id: row.id,
            name: row.name ?? "Athlete",
            handle: row.handle ?? undefined,
            avatarUrl: row.avatar_url ?? undefined,
        }));
        const followerIds = new Set(followersList.map((row) => row.id));
        const followingIds = new Set(followingList.map((row) => row.id));
        const friends = followingList.filter((row) => followerIds.has(row.id));
        const pendingInvites = followersList.filter((row) => !followingIds.has(row.id));
        const outgoingInvites = followingList.filter((row) => !followerIds.has(row.id));
        return res.json({
            friends,
            pendingInvites,
            outgoingInvites,
            following: followingList,
            followers: followersList,
        });
    }
    catch (err) {
        console.error("Failed to load connections", err);
        return res.status(500).json({ error: "Failed to load connections" });
    }
});
router.get("/squads", async (_req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const squads = await fetchSquadsForUser(userId);
        return res.json({ squads });
    }
    catch (err) {
        console.error("Failed to load squads", err);
        return res.status(500).json({ error: "Failed to load squads" });
    }
});
router.post("/squads", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const { name } = req.body;
    if (!name?.trim()) {
        return res.status(400).json({ error: "Squad name required" });
    }
    const squadId = (0, id_1.generateId)();
    try {
        await (0, db_1.query)(`INSERT INTO squads (id, name, created_by) VALUES ($1, $2, $3)`, [squadId, name.trim(), userId]);
        await (0, db_1.query)(`
        INSERT INTO squad_members (squad_id, user_id, role)
        VALUES ($1, $2, 'owner')
        ON CONFLICT (squad_id, user_id) DO NOTHING
      `, [squadId, userId]);
        const squad = await fetchSquadById(userId, squadId);
        if (!squad) {
            return res.status(404).json({ error: "Squad not found" });
        }
        return res.status(201).json({ squad });
    }
    catch (err) {
        console.error("Failed to create squad", err);
        return res.status(500).json({ error: "Failed to create squad" });
    }
});
router.post("/squads/:squadId/members", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const { handle } = req.body;
    const targetValue = (handle ?? "").trim();
    if (!targetValue) {
        return res.status(400).json({ error: "Handle or id required" });
    }
    const normalizedHandle = normalizeHandle(targetValue) ?? targetValue;
    try {
        const squadMembership = await (0, db_1.query)(`SELECT 1 FROM squad_members WHERE squad_id = $1 AND user_id = $2 LIMIT 1`, [req.params.squadId, userId]);
        if (squadMembership.rowCount === 0) {
            return res.status(403).json({ error: "Not a member of that squad" });
        }
        const targetResult = await (0, db_1.query)(`
        SELECT id
        FROM users
        WHERE id = $1 OR LOWER(handle) = LOWER($2)
        LIMIT 1
      `, [targetValue, normalizedHandle]);
        const target = targetResult.rows[0];
        if (!target) {
            return res.status(404).json({ error: "User not found" });
        }
        await (0, db_1.query)(`
        INSERT INTO squad_members (squad_id, user_id, role)
        VALUES ($1, $2, 'member')
        ON CONFLICT (squad_id, user_id) DO NOTHING
      `, [req.params.squadId, target.id]);
        const squad = await fetchSquadById(userId, req.params.squadId);
        if (!squad) {
            return res.status(404).json({ error: "Squad not found" });
        }
        return res.json({ squad });
    }
    catch (err) {
        console.error("Failed to add squad member", err);
        return res.status(500).json({ error: "Failed to invite member" });
    }
});
router.delete("/squads/:squadId", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const { squadId } = req.params;
    try {
        const squadResult = await (0, db_1.query)(`SELECT created_by FROM squads WHERE id = $1 LIMIT 1`, [squadId]);
        if (squadResult.rowCount === 0) {
            return res.status(404).json({ error: "Squad not found" });
        }
        const createdBy = squadResult.rows[0]?.created_by;
        if (createdBy !== userId) {
            return res
                .status(403)
                .json({ error: "Only the squad owner can delete it" });
        }
        await (0, db_1.query)(`DELETE FROM squads WHERE id = $1`, [squadId]);
        return res.status(204).send();
    }
    catch (err) {
        console.error("Failed to delete squad", err);
        return res.status(500).json({ error: "Failed to delete squad" });
    }
});
router.get("/search", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const term = (req.query.q ?? "").trim();
    if (!term) {
        return res.json([]);
    }
    try {
        const results = await (0, db_1.query)(`
        SELECT *
        FROM users
        WHERE id != $1
          AND (LOWER(name) LIKE LOWER($2) OR LOWER(handle) LIKE LOWER($2))
        ORDER BY updated_at DESC
        LIMIT 8
      `, [userId, `%${term}%`]);
        return res.json(results.rows.map((row) => ({
            id: row.id,
            name: row.name ?? "Athlete",
            handle: row.handle ?? undefined,
            avatarUrl: row.avatar_url ?? undefined,
        })));
    }
    catch (err) {
        console.error("Failed to search users", err);
        return res.status(500).json({ error: "Failed to search users" });
    }
});
router.post("/follow", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const targetUserId = req.body.userId;
    if (!targetUserId || targetUserId === userId) {
        return res.status(400).json({ error: "Invalid follow target" });
    }
    try {
        await (0, db_1.query)(`INSERT INTO follows (user_id, target_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, targetUserId]);
        return res.status(204).send();
    }
    catch (err) {
        console.error("Failed to follow user", err);
        return res.status(500).json({ error: "Failed to follow user" });
    }
});
router.delete("/follow/:id", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        await (0, db_1.query)(`DELETE FROM follows WHERE user_id = $1 AND target_user_id = $2`, [userId, req.params.id]);
        return res.status(204).send();
    }
    catch (err) {
        console.error("Failed to unfollow user", err);
        return res.status(500).json({ error: "Failed to unfollow user" });
    }
});
router.delete("/followers/:id", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        await (0, db_1.query)(`DELETE FROM follows WHERE user_id = $1 AND target_user_id = $2`, [req.params.id, userId]);
        return res.status(204).send();
    }
    catch (err) {
        console.error("Failed to decline invite", err);
        return res.status(500).json({ error: "Failed to decline invite" });
    }
});
// Squad invite link endpoints
router.post("/squads/:squadId/invites", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const { squadId } = req.params;
    try {
        // Verify user is admin/owner
        const memberResult = await (0, db_1.query)(`SELECT role FROM squad_members WHERE squad_id = $1 AND user_id = $2 LIMIT 1`, [squadId, userId]);
        if (memberResult.rowCount === 0) {
            return res.status(403).json({ error: "Not a member of this squad" });
        }
        const role = memberResult.rows[0].role;
        if (role !== "owner" && role !== "admin") {
            return res
                .status(403)
                .json({ error: "Only admins can create invite links" });
        }
        // Check squad exists and get max_members
        const squadResult = await (0, db_1.query)(`SELECT max_members FROM squads WHERE id = $1 LIMIT 1`, [squadId]);
        if (squadResult.rowCount === 0) {
            return res.status(404).json({ error: "Squad not found" });
        }
        // Generate unique code
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        const inviteId = (0, id_1.generateId)();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        await (0, db_1.query)(`
        INSERT INTO squad_invite_links (id, squad_id, code, created_by, expires_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [inviteId, squadId, code, userId, expiresAt.toISOString()]);
        return res.status(201).json({
            id: inviteId,
            code,
            expiresAt: expiresAt.toISOString(),
        });
    }
    catch (err) {
        console.error("Failed to create invite link", err);
        return res.status(500).json({ error: "Failed to create invite link" });
    }
});
router.get("/squad-invite/:code", async (req, res) => {
    const { code } = req.params;
    try {
        const result = await (0, db_1.query)(`
        SELECT
          sil.squad_id,
          s.name as squad_name,
          s.created_by,
          sil.expires_at,
          sil.is_revoked,
          s.max_members,
          COUNT(sm.user_id)::text as member_count
        FROM squad_invite_links sil
        JOIN squads s ON s.id = sil.squad_id
        LEFT JOIN squad_members sm ON sm.squad_id = s.id
        WHERE sil.code = $1
        GROUP BY sil.squad_id, s.name, s.created_by, sil.expires_at, sil.is_revoked, s.max_members
        LIMIT 1
      `, [code]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Invite link not found" });
        }
        const invite = result.rows[0];
        if (invite.is_revoked) {
            return res
                .status(410)
                .json({ error: "This invite link has been revoked" });
        }
        if (new Date(invite.expires_at) < new Date()) {
            return res.status(410).json({ error: "This invite link has expired" });
        }
        const memberCount = Number(invite.member_count);
        if (memberCount >= invite.max_members) {
            return res.status(400).json({ error: "This squad is full" });
        }
        // Get squad member previews
        const membersResult = await (0, db_1.query)(`
        SELECT u.id, u.name, u.avatar_url
        FROM squad_members sm
        JOIN users u ON u.id = sm.user_id
        WHERE sm.squad_id = $1
        ORDER BY sm.joined_at ASC
        LIMIT 6
      `, [invite.squad_id]);
        return res.json({
            squadId: invite.squad_id,
            squadName: invite.squad_name,
            memberCount,
            maxMembers: invite.max_members,
            membersPreview: membersResult.rows.map((m) => ({
                id: m.id,
                name: m.name ?? "Athlete",
                avatarUrl: m.avatar_url ?? undefined,
            })),
        });
    }
    catch (err) {
        console.error("Failed to get invite preview", err);
        return res.status(500).json({ error: "Failed to load invite" });
    }
});
router.post("/squad-invite/:code/join", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const { code } = req.params;
    try {
        // Get invite link details
        const inviteResult = await (0, db_1.query)(`
        SELECT id, squad_id, created_by, expires_at, is_revoked, uses_count
        FROM squad_invite_links
        WHERE code = $1
        LIMIT 1
      `, [code]);
        if (inviteResult.rowCount === 0) {
            return res.status(404).json({ error: "Invite link not found" });
        }
        const invite = inviteResult.rows[0];
        if (invite.is_revoked) {
            return res
                .status(410)
                .json({ error: "This invite link has been revoked" });
        }
        if (new Date(invite.expires_at) < new Date()) {
            return res.status(410).json({ error: "This invite link has expired" });
        }
        // Check if already a member
        const membershipCheck = await (0, db_1.query)(`SELECT 1 FROM squad_members WHERE squad_id = $1 AND user_id = $2 LIMIT 1`, [invite.squad_id, userId]);
        if ((membershipCheck.rowCount ?? 0) > 0) {
            return res
                .status(400)
                .json({ error: "You're already a member of this squad" });
        }
        // Check squad capacity
        const squadResult = await (0, db_1.query)(`
        SELECT s.max_members, COUNT(sm.user_id)::text as member_count
        FROM squads s
        LEFT JOIN squad_members sm ON sm.squad_id = s.id
        WHERE s.id = $1
        GROUP BY s.id, s.max_members
      `, [invite.squad_id]);
        if (squadResult.rowCount === 0) {
            return res.status(404).json({ error: "Squad not found" });
        }
        const squad = squadResult.rows[0];
        const memberCount = Number(squad.member_count);
        if (memberCount >= squad.max_members) {
            return res.status(400).json({ error: "This squad is full" });
        }
        // Add user to squad
        await (0, db_1.query)(`
        INSERT INTO squad_members (squad_id, user_id, role, invited_by)
        VALUES ($1, $2, 'member', $3)
      `, [invite.squad_id, userId, invite.created_by]);
        // Increment uses count
        await (0, db_1.query)(`UPDATE squad_invite_links SET uses_count = uses_count + 1 WHERE id = $1`, [invite.id]);
        // Return squad details
        const squadDetails = await fetchSquadById(userId, invite.squad_id);
        return res.status(201).json({ squad: squadDetails });
    }
    catch (err) {
        console.error("Failed to join squad", err);
        return res.status(500).json({ error: "Failed to join squad" });
    }
});
router.delete("/squads/:squadId/invites/:inviteId", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const { squadId, inviteId } = req.params;
    try {
        // Verify user is admin/owner
        const memberResult = await (0, db_1.query)(`SELECT role FROM squad_members WHERE squad_id = $1 AND user_id = $2 LIMIT 1`, [squadId, userId]);
        if (memberResult.rowCount === 0) {
            return res.status(403).json({ error: "Not a member of this squad" });
        }
        const role = memberResult.rows[0].role;
        if (role !== "owner" && role !== "admin") {
            return res
                .status(403)
                .json({ error: "Only admins can revoke invite links" });
        }
        // Revoke the invite
        await (0, db_1.query)(`
        UPDATE squad_invite_links
        SET is_revoked = true
        WHERE id = $1 AND squad_id = $2
      `, [inviteId, squadId]);
        return res.status(204).send();
    }
    catch (err) {
        console.error("Failed to revoke invite", err);
        return res.status(500).json({ error: "Failed to revoke invite" });
    }
});
router.get("/squads/:squadId/invites", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const { squadId } = req.params;
    try {
        // Verify user is admin/owner
        const memberResult = await (0, db_1.query)(`SELECT role FROM squad_members WHERE squad_id = $1 AND user_id = $2 LIMIT 1`, [squadId, userId]);
        if (memberResult.rowCount === 0) {
            return res.status(403).json({ error: "Not a member of this squad" });
        }
        const role = memberResult.rows[0].role;
        if (role !== "owner" && role !== "admin") {
            return res
                .status(403)
                .json({ error: "Only admins can view invite links" });
        }
        // Get all active invites
        const result = await (0, db_1.query)(`
        SELECT id, code, created_at, expires_at, is_revoked, uses_count
        FROM squad_invite_links
        WHERE squad_id = $1
        ORDER BY created_at DESC
      `, [squadId]);
        return res.json({
            invites: result.rows.map((row) => ({
                id: row.id,
                code: row.code,
                createdAt: row.created_at,
                expiresAt: row.expires_at,
                isRevoked: row.is_revoked,
                usesCount: row.uses_count,
            })),
        });
    }
    catch (err) {
        console.error("Failed to get invites", err);
        return res.status(500).json({ error: "Failed to load invites" });
    }
});
router.post("/active-status", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const { sessionId, templateId, templateName, visibility, currentExerciseName, } = req.body;
    if (!sessionId) {
        return res.status(400).json({ error: "sessionId required" });
    }
    const vis = visibility ?? "private";
    try {
        const result = await (0, db_1.query)(`
        INSERT INTO active_workout_statuses (session_id, user_id, template_id, template_name, visibility, current_exercise_name, is_active, started_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
        ON CONFLICT (session_id) DO UPDATE
          SET template_id = EXCLUDED.template_id,
              template_name = EXCLUDED.template_name,
              visibility = EXCLUDED.visibility,
              current_exercise_name = EXCLUDED.current_exercise_name,
              is_active = true,
              updated_at = NOW()
        RETURNING *
      `, [
            sessionId,
            userId,
            templateId ?? null,
            templateName ?? null,
            vis,
            currentExerciseName ?? null,
        ]);
        const row = result.rows[0];
        const user = await fetchUserSummary(userId);
        return res.json(mapStatus({
            ...row,
            name: user.name,
            handle: user.handle ?? null,
            avatar_url: user.avatarUrl ?? null,
        }));
    }
    catch (err) {
        console.error("Failed to set active workout status", err);
        return res.status(500).json({ error: "Failed to set status" });
    }
});
router.delete("/active-status/:sessionId", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        await (0, db_1.query)(`DELETE FROM active_workout_statuses WHERE session_id = $1 AND user_id = $2`, [req.params.sessionId, userId]);
        return res.status(204).send();
    }
    catch (err) {
        console.error("Failed to clear active status", err);
        return res.status(500).json({ error: "Failed to clear status" });
    }
});
router.post("/share", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const { sessionId, visibility, progressPhotoUrl, templateName, totalSets, totalVolume, prCount, } = req.body;
    if (!sessionId) {
        return res.status(400).json({ error: "sessionId required" });
    }
    const vis = visibility ?? "private";
    try {
        const result = await (0, db_1.query)(`
        INSERT INTO workout_shares (id, user_id, session_id, template_name, total_sets, total_volume, pr_count, visibility, progress_photo_url, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *
      `, [
            (0, id_1.generateId)(),
            userId,
            sessionId,
            templateName ?? null,
            totalSets ?? null,
            totalVolume ?? null,
            prCount ?? null,
            vis,
            progressPhotoUrl ?? null,
        ]);
        const row = result.rows[0];
        const user = await fetchUserSummary(userId);
        return res.status(201).json(mapShare({
            ...row,
            name: user.name,
            handle: user.handle ?? null,
            avatar_url: user.avatarUrl ?? null,
        }));
    }
    catch (err) {
        console.error("Failed to record share", err);
        return res.status(500).json({ error: "Failed to share workout" });
    }
});
router.get("/squad-feed", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const squadId = typeof req.query.squadId === "string" && req.query.squadId.trim().length > 0
        ? req.query.squadId.trim()
        : undefined;
    let squadMembers = null;
    try {
        if (squadId) {
            const squadMemberRows = await (0, db_1.query)(`SELECT user_id FROM squad_members WHERE squad_id = $1`, [squadId]);
            if (squadMemberRows.rowCount === 0) {
                return res.status(404).json({ error: "Squad not found" });
            }
            const membersSet = new Set(squadMemberRows.rows.map((row) => row.user_id));
            if (!membersSet.has(userId)) {
                return res.status(403).json({ error: "Not a member of this squad" });
            }
            squadMembers = membersSet;
        }
        const followingRows = await (0, db_1.query)(`SELECT target_user_id FROM follows WHERE user_id = $1`, [userId]);
        const following = new Set(followingRows.rows.map((row) => row.target_user_id));
        const mutualRows = await (0, db_1.query)(`SELECT user_id FROM follows WHERE target_user_id = $1 AND user_id = ANY($2::text[])`, [userId, Array.from(following)]);
        const mutual = new Set(mutualRows.rows.map((row) => row.user_id));
        const statuses = await (0, db_1.query)(`
        SELECT s.*, u.name, u.handle, u.avatar_url
        FROM active_workout_statuses s
        JOIN users u ON u.id = s.user_id
        WHERE s.is_active = true
        ORDER BY s.updated_at DESC
        LIMIT 12
      `);
        const shares = await (0, db_1.query)(`
        SELECT sh.*, u.name, u.handle, u.avatar_url
        FROM workout_shares sh
        JOIN users u ON u.id = sh.user_id
        ORDER BY sh.created_at DESC
        LIMIT 20
      `);
        const activeStatuses = statuses.rows
            .filter((row) => {
            if (squadMembers) {
                return row.visibility === "squad" && squadMembers.has(row.user_id);
            }
            return canView(row.user_id, row.visibility, userId, following, mutual);
        })
            .map(mapStatus);
        const recentShares = shares.rows
            .filter((row) => {
            if (squadMembers) {
                return row.visibility === "squad" && squadMembers.has(row.user_id);
            }
            return canView(row.user_id, row.visibility, userId, following, mutual);
        })
            .map(mapShare);
        return res.json({ activeStatuses, recentShares });
    }
    catch (err) {
        console.error("Failed to load squad feed", err);
        return res.status(500).json({ error: "Failed to load feed" });
    }
});
exports.default = router;
