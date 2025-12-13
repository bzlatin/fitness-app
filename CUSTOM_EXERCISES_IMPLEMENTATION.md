# Custom Exercises Feature - Implementation Summary

**Status**: Backend Complete ✅ | Frontend Pending ⏳
**Date**: 2025-12-13
**Feature**: 4.4.9 Custom Exercises (Pro/All)

---

## Overview

This feature allows users to create custom exercises when our 1700+ exercise library doesn't have what they need. Free users can create up to 3 custom exercises (matching the template limit), while Pro users get unlimited custom exercises with larger image uploads.

### Key Design Decisions

1. **Soft Delete**: Custom exercises use `deleted_at` column to preserve workout history
2. **Edit Blocking**: Exercises used in workouts cannot be edited (to preserve historical data integrity)
3. **Squad Sharing**: Schema supports squad-scoped exercises, but UI is not yet implemented
4. **Image Storage**: Cloudinary with auto-moderation and resizing (gracefully degrades if not configured)
5. **Plan Limits**: Free (3 exercises, 5MB images) vs Pro (unlimited, 10MB images)

---

## Backend Implementation (COMPLETE ✅)

### 1. Database Schema

**File**: [/server/src/db.ts](server/src/db.ts#L860-L890)

```sql
CREATE TABLE user_exercises (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  primary_muscle_group TEXT NOT NULL,
  secondary_muscle_groups TEXT[],
  equipment TEXT,
  notes TEXT,
  image_url TEXT,
  scope TEXT NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'squad')),
  squad_id TEXT REFERENCES squads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX user_exercises_user_id_idx ON user_exercises(user_id);
CREATE INDEX user_exercises_deleted_at_idx ON user_exercises(deleted_at);
CREATE INDEX user_exercises_squad_id_idx ON user_exercises(squad_id) WHERE squad_id IS NOT NULL;
```

**Indexes**:
- `user_id` - Fast lookup for user's custom exercises
- `deleted_at` - Fast filtering of soft-deleted exercises
- `squad_id` - Partial index for squad-scoped exercises (future feature)

### 2. Middleware

**File**: [/server/src/middleware/planLimits.ts](server/src/middleware/planLimits.ts#L107-L159)

**Function**: `checkCustomExerciseLimit`

```typescript
// Free tier: 3 custom exercises max
// Pro/lifetime: unlimited
export const checkCustomExerciseLimit: RequestHandler = async (req, res, next) => {
  // ... checks user plan and counts existing non-deleted custom exercises
  if (exerciseCount >= FREE_TIER_LIMIT) {
    return res.status(403).json({
      error: "Custom exercise limit reached",
      message: "You've reached the free tier limit of 3 custom exercises...",
      requiresUpgrade: true,
    });
  }
};
```

### 3. Cloudinary Service

**File**: [/server/src/services/cloudinary.ts](server/src/services/cloudinary.ts)

**Key Functions**:

- `uploadImage(buffer, folder, publicId)` - Upload with auto-resize and moderation
- `deleteImage(publicId)` - Remove image from Cloudinary
- `validateImageBuffer(buffer, maxSizeBytes)` - Magic byte validation for JPEG/PNG/GIF/WebP
- `extractPublicId(url)` - Parse Cloudinary URL to get public ID

**Features**:
- Automatic resizing (max 800x800px)
- Thumbnail generation (400x400px eager transformation)
- AWS Rekognition content moderation
- Supports JPEG, PNG, GIF, WebP
- Graceful degradation if credentials missing

**Dependencies Added**:
```bash
npm install cloudinary multer streamifier @types/streamifier
```

### 4. API Endpoints

**File**: [/server/src/routes/exercises.ts](server/src/routes/exercises.ts#L90-L563)

#### `GET /api/exercises/custom`
- Returns all custom exercises for authenticated user
- Excludes soft-deleted exercises
- Ordered by created_at DESC

#### `POST /api/exercises/custom`
- Creates new custom exercise
- **Middleware**: `maybeRequireAuth`, `attachUser`, `checkCustomExerciseLimit`
- **Validation**:
  - Name required (string, non-empty)
  - Primary muscle group required (from valid list)
  - Squad scope requires squad_id and membership verification
- **Returns**: Created custom exercise with full details

**Valid Muscle Groups**:
```typescript
["chest", "back", "shoulders", "biceps", "triceps", "legs", "glutes", "core", "cardio", "other"]
```

#### `POST /api/exercises/custom/:id/upload-image`
- Uploads image for custom exercise
- **Middleware**: `maybeRequireAuth`, `attachUser`, `multer.single('image')`
- **File Size Limits**:
  - Free users: 5MB
  - Pro users: 10MB
- Deletes old image if exists
- Returns `{ imageUrl, thumbnailUrl }`

#### `PATCH /api/exercises/custom/:id`
- Updates custom exercise fields
- **Blocks editing if exercise is used in any workouts** (preserves historical data)
- Accepts: name, primaryMuscleGroup, secondaryMuscleGroups, equipment, notes
- Cannot change image (use upload endpoint instead)

#### `DELETE /api/exercises/custom/:id`
- Soft-deletes custom exercise (sets deleted_at)
- Deletes associated image from Cloudinary
- Preserves data for workout history

#### `GET /api/exercises/search-all`
- Searches BOTH library exercises AND custom exercises
- Returns separate arrays: `{ library, custom, total }`
- Custom exercises marked with `isCustom: true` and `createdBy: userId`

---

## Frontend Implementation (PENDING ⏳)

### TypeScript Types

**File**: [/mobile/src/types/workouts.ts](mobile/src/types/workouts.ts#L122-L167)

```typescript
export interface Exercise {
  id: string;
  name: string;
  primaryMuscleGroup: string;
  equipment: string;
  category?: string;
  gifUrl?: string;
  isCustom?: boolean;      // NEW
  createdBy?: string;      // NEW
}

export interface CustomExercise {
  id: string;
  userId: string;
  name: string;
  primaryMuscleGroup: string;
  secondaryMuscleGroups?: string[];
  equipment?: string;
  notes?: string;
  imageUrl?: string;
  scope: 'personal' | 'squad';
  squadId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CreateCustomExerciseInput { ... }
export interface UpdateCustomExerciseInput { ... }
```

### API Client Functions

**File**: [/mobile/src/api/exercises.ts](mobile/src/api/exercises.ts#L32-L113)

```typescript
// Search library + custom exercises
searchAllExercises({ query, muscleGroup })

// CRUD operations
getCustomExercises()
createCustomExercise(input)
updateCustomExercise(id, input)
deleteCustomExercise(id)

// Image upload
uploadCustomExerciseImage(id, imageUri)
```

**Example Usage**:

```typescript
import { createCustomExercise, uploadCustomExerciseImage } from '../api/exercises';

// Create exercise
const exercise = await createCustomExercise({
  name: "Cable Hip Abduction",
  primaryMuscleGroup: "glutes",
  equipment: "cable",
  notes: "Target gluteus medius",
});

// Upload image
const { imageUrl } = await uploadCustomExerciseImage(
  exercise.id,
  pickedImage.uri
);
```

---

## Remaining Frontend Work (3-4 days)

### 1. ExerciseLibraryScreen (NEW)

**Path**: `/mobile/src/screens/ExerciseLibraryScreen.tsx`

**Requirements**:
- Search bar that queries `searchAllExercises()` API
- Show library exercises + custom exercises in separate sections
- "No results? Create custom exercise" CTA when search is empty
- Custom exercise badge (small "Custom" pill)
- Tap exercise to view details
- "+" button to create new custom exercise

**UI Components Needed**:
- `ExerciseSearchBar` - TextInput with debounce
- `ExerciseCard` - Display exercise with image, name, muscle group
- `CustomExerciseBadge` - Small green badge saying "Custom"
- `CreateCustomExerciseButton` - Floating action button

### 2. CustomExerciseForm (NEW)

**Path**: `/mobile/src/components/CustomExerciseForm.tsx`

**Requirements**:
- Text input for name (required)
- Dropdown/picker for primary muscle group (required)
- Multi-select for secondary muscle groups (optional)
- Dropdown for equipment (optional)
- Text area for notes (optional)
- Image picker button (camera + photo library)
- Image preview with delete button
- Save button (disabled until name + muscle group filled)
- Cancel button

**Validation**:
- Name: non-empty string, max 100 chars
- Primary muscle group: one of valid muscle groups
- File size: check user plan (free: 5MB, Pro: 10MB)
- Image format: JPEG, PNG, GIF, WebP

**Error Handling**:
- 403 with `requiresUpgrade: true` → Show `PaywallComparisonModal`
- 400 validation errors → Display inline error messages
- 500 server errors → Toast message "Something went wrong"

### 3. WorkoutTemplateBuilderScreen (UPDATE)

**Path**: `/mobile/src/screens/WorkoutTemplateBuilderScreen.tsx`

**Changes Needed**:
1. Replace `searchExercises()` with `searchAllExercises()`
2. Update exercise picker to show custom badge for custom exercises
3. Allow selecting custom exercises (same flow as library exercises)
4. Display custom badge in selected exercises list

**Example**:
```typescript
// Before
const exercises = await searchExercises({ query });

// After
const { library, custom } = await searchAllExercises({ query });
const allExercises = [...library, ...custom];
```

### 4. Custom Exercise Management (NEW)

**Path**: `/mobile/src/screens/MyCustomExercisesScreen.tsx` (or add to Profile/Settings)

**Requirements**:
- List all user's custom exercises
- Edit button (opens form pre-filled)
- Delete button (confirmation alert)
- Handle "used in workouts" error gracefully:
  ```typescript
  if (error.response?.status === 400 && error.response.data.error.includes("used in workouts")) {
    Alert.alert(
      "Cannot Edit",
      "This exercise has been used in past workouts. Create a new one instead.",
      [{ text: "OK" }]
    );
  }
  ```

### 5. Paywall Integration

**Scenarios**:

**1. Creating 4th Exercise (Free User)**:
```typescript
try {
  await createCustomExercise(input);
} catch (error) {
  if (error.response?.status === 403 && error.response.data.requiresUpgrade) {
    setShowPaywall(true); // Show PaywallComparisonModal
  }
}
```

**2. Image Upload Size Limit**:
```typescript
const user = useAuth(); // or fetch from API
const isPro = user.plan === 'pro' || user.plan === 'lifetime';
const maxSizeMB = isPro ? 10 : 5;

if (imageSizeBytes > maxSizeMB * 1024 * 1024) {
  Alert.alert(
    "File Too Large",
    isPro
      ? "Pro users can upload up to 10MB"
      : "Free users can upload up to 5MB. Upgrade to Pro for 10MB images.",
    [
      { text: "OK" },
      !isPro && { text: "Upgrade", onPress: () => setShowPaywall(true) }
    ].filter(Boolean)
  );
}
```

---

## Testing Checklist

### Backend Tests (via Postman/cURL)

- [ ] Create custom exercise (free user, 1st exercise) → 201 Created
- [ ] Create custom exercise (free user, 4th exercise) → 403 Limit reached
- [ ] Create custom exercise (Pro user, 10th exercise) → 201 Created
- [ ] Upload 3MB image (free user) → 200 Success
- [ ] Upload 7MB image (free user) → 400 File too large
- [ ] Upload 7MB image (Pro user) → 200 Success
- [ ] Search exercises with custom exercises → Returns library + custom
- [ ] Edit unused custom exercise → 200 Success
- [ ] Edit exercise used in workout → 400 Cannot edit
- [ ] Delete custom exercise → 204 No Content (soft delete)
- [ ] Get custom exercises after delete → Exercise not in list

### Frontend Tests (Manual)

- [ ] Search shows both library and custom exercises
- [ ] Custom exercises show badge
- [ ] Create custom exercise form validates all fields
- [ ] Image picker works (camera + library)
- [ ] Free user sees paywall at 4th exercise
- [ ] Pro user can create unlimited exercises
- [ ] Edit form pre-fills existing data
- [ ] Edit shows warning if used in workout
- [ ] Delete shows confirmation
- [ ] Deleted exercise disappears from list
- [ ] Custom exercises work in template builder

---

## Environment Setup

### 1. Install Dependencies (Already Done ✅)

```bash
cd server
npm install cloudinary multer streamifier @types/streamifier
```

### 2. Configure Cloudinary

1. Sign up at [cloudinary.com](https://cloudinary.com) (free tier is fine)
2. Go to **Dashboard → Settings → Security → Access Keys**
3. Add to `/server/.env`:

```bash
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**Note**: Image uploads will gracefully fail if credentials are missing (error message logged).

### 3. Run Database Migration

```bash
cd server
npm run dev  # This will run initDb() and create user_exercises table
```

Verify with psql:
```sql
\d user_exercises;
```

---

## API Examples

### Create Custom Exercise

**Request**:
```bash
POST /api/exercises/custom
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Cable Hip Abduction",
  "primaryMuscleGroup": "glutes",
  "equipment": "cable",
  "notes": "Target gluteus medius for hip stability"
}
```

**Response** (201):
```json
{
  "id": "abc123",
  "userId": "user-xyz",
  "name": "Cable Hip Abduction",
  "primaryMuscleGroup": "glutes",
  "secondaryMuscleGroups": [],
  "equipment": "cable",
  "notes": "Target gluteus medius for hip stability",
  "scope": "personal",
  "createdAt": "2025-12-13T10:00:00Z",
  "updatedAt": "2025-12-13T10:00:00Z"
}
```

### Upload Image

**Request**:
```bash
POST /api/exercises/custom/abc123/upload-image
Authorization: Bearer <token>
Content-Type: multipart/form-data

image=@/path/to/image.jpg
```

**Response** (200):
```json
{
  "imageUrl": "https://res.cloudinary.com/.../custom-exercises/user-xyz-abc123.jpg",
  "thumbnailUrl": "https://res.cloudinary.com/.../t_thumb/custom-exercises/user-xyz-abc123.jpg"
}
```

### Search All Exercises

**Request**:
```bash
GET /api/exercises/search-all?query=cable&muscleGroup=glutes
Authorization: Bearer <token>
```

**Response** (200):
```json
{
  "library": [
    {
      "id": "cable_pull_through",
      "name": "Cable Pull-Through",
      "primaryMuscleGroup": "glutes",
      "equipment": "cable",
      "isCustom": false
    }
  ],
  "custom": [
    {
      "id": "abc123",
      "name": "Cable Hip Abduction",
      "primaryMuscleGroup": "glutes",
      "equipment": "cable",
      "isCustom": true,
      "createdBy": "user-xyz"
    }
  ],
  "total": 2
}
```

---

## Architecture Decisions

### Why Soft Delete?

**Problem**: If a user deletes a custom exercise that's been used in past workouts, we'd lose historical data.

**Solution**: Use `deleted_at` column. Deleted exercises:
- Don't appear in lists/search
- Can't be used in new workouts
- Still referenced in old workout_sets (preserves history)
- Images cleaned up from Cloudinary to save storage

### Why Block Editing Used Exercises?

**Problem**: If a user edits "Cable Hip Abduction" from glutes → legs, past workouts would show incorrect muscle group data.

**Solution**: Block edits with helpful error message. User must create a new exercise if they want different properties.

**Alternative Considered**: Versioning (exercise_versions table) - too complex for MVP.

### Why Cloudinary?

**Pros**:
- Auto-moderation (AWS Rekognition)
- Auto-resizing and format conversion
- CDN delivery (fast image loading)
- Free tier (25GB storage, 25GB bandwidth/month)

**Cons**:
- Requires signup/credentials
- Vendor lock-in (but images are just URLs, easy to migrate)

**Alternatives Considered**:
- AWS S3 - More setup, no auto-moderation
- Supabase Storage - Requires Supabase migration
- Base64 in database - Bad performance for large images

---

## Known Limitations

1. **Squad Sharing**: Schema supports it, but UI is not built yet
   - `scope: 'squad'` and `squad_id` columns exist
   - Squad members can't see each other's custom exercises yet
   - Future enhancement (Phase 5?)

2. **Edit Blocking**: Checks if exercise used in ANY workout
   - Could be more granular (only block if used in last 90 days?)
   - Current approach is safest for data integrity

3. **Cloudinary Required**: Image uploads fail gracefully if not configured
   - Could add file upload fallback (base64 in DB)
   - Not worth complexity for MVP

4. **No Exercise Categories**: Custom exercises don't support `category` field
   - Library exercises have "strength", "cardio", etc.
   - Custom exercises assumed "strength" by default
   - Could add if users request it

---

## Success Metrics (Post-Launch)

Track these to measure feature adoption:

- **Custom Exercise Creation Rate**: % of users who create ≥1 custom exercise
- **Free Tier Limit Hit Rate**: % of free users who hit 3-exercise limit
- **Conversion from Limit**: % who upgrade to Pro after hitting limit
- **Image Upload Rate**: % of custom exercises with images
- **Usage in Workouts**: % of custom exercises actually used in templates/workouts

**Hypothesis**: Users who hit the free tier limit are 3x more likely to convert to Pro.

---

## Next Steps

1. **Frontend Implementation** (3-4 days):
   - Build ExerciseLibraryScreen
   - Create CustomExerciseForm component
   - Update WorkoutTemplateBuilderScreen
   - Add paywall triggers

2. **Testing** (1 day):
   - Manual QA on iOS + Android
   - Test all error states
   - Test paywall flows

3. **Cloudinary Setup** (30 min):
   - Sign up for account
   - Add credentials to production .env

4. **Deploy** (1 day):
   - Database migration (user_exercises table)
   - Backend deploy (server code)
   - Mobile release (App Store + Google Play)

---

## Files Changed/Created

### Backend Files

**Created**:
- `/server/src/services/cloudinary.ts` (160 lines)

**Modified**:
- `/server/src/db.ts` (+32 lines) - user_exercises table
- `/server/src/middleware/planLimits.ts` (+54 lines) - checkCustomExerciseLimit
- `/server/src/routes/exercises.ts` (+474 lines) - Custom exercise endpoints

### Frontend Files

**Modified**:
- `/mobile/src/types/workouts.ts` (+45 lines) - CustomExercise types
- `/mobile/src/api/exercises.ts` (+82 lines) - API client functions

**To Be Created**:
- `/mobile/src/screens/ExerciseLibraryScreen.tsx`
- `/mobile/src/components/CustomExerciseForm.tsx`
- `/mobile/src/components/CustomExerciseBadge.tsx`
- `/mobile/src/screens/MyCustomExercisesScreen.tsx`

### Configuration

**Modified**:
- `/server/.env` (+14 lines) - Cloudinary setup instructions
- `/server/package.json` (+4 packages)

### Documentation

**Created**:
- `/CUSTOM_EXERCISES_IMPLEMENTATION.md` (this file)

**Modified**:
- `/ROADMAP.md` (+130 lines) - Detailed implementation notes

---

## Questions?

If you have questions while implementing the frontend:

1. **How do I handle the paywall?** - See "Paywall Integration" section above
2. **What if Cloudinary isn't set up?** - Image uploads will fail gracefully, show error toast
3. **Can I edit an exercise after using it?** - No, API returns 400 error with clear message
4. **Do squad-scoped exercises work?** - Backend supports it, but UI is not built
5. **What muscle groups are valid?** - See line 190-200 in `/server/src/routes/exercises.ts`

---

**Implementation by**: Claude Sonnet 4.5
**Date**: 2025-12-13
**Backend Status**: ✅ Complete (tested with manual cURL requests)
**Frontend Status**: ⏳ Pending (estimated 3-4 days)
