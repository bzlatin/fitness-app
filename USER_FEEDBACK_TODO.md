# User Feedback TODOs (Detailed)

## 1) Optional RIR (reps in reserve) per exercise with on/off toggle (DONE)

Context: Users want to log an RIR value on each exercise, but only if they choose to enable it.

Acceptance criteria:

- Users can enable/disable RIR logging without breaking existing data.
- When disabled, the RIR field is hidden and not required.
- When enabled, the RIR field is saved and displayed consistently in summaries.
- RIR values are validated and persisted in the workout payload.

Likely touchpoints:

- `mobile/src/screens/` workout logging UI
- `mobile/src/components/` input primitives
- `server/src/routes/` workout/session handlers
- `server/src/db.ts` or data models for workouts/sets

Notes to share when asking for help:

- Preferred toggle location and per-set vs per-exercise decision
- Desired RIR validation rules and display format

## 2) Different weight values per set

Context: Users want to log distinct weights for each set within an exercise.

Questions to answer before implementation:

- Is the current data model storing a single weight per exercise or per set?
- Should there be a quick-fill option to apply one weight to all sets?
- Do we need to support mixed units or unit conversion?

Acceptance criteria:

- Each set can store its own weight value.
- The UI makes it easy to edit individual sets without excessive taps.
- Server payloads and database records preserve per-set weights.
- Existing logged workouts still render correctly after the change.

Likely touchpoints:

- `mobile/src/screens/` workout editor/logging screen
- `mobile/src/components/` set row inputs
- `server/src/routes/` workout save endpoints
- `server/src/db.ts` or data schema for sets

Notes to share when asking for help:

- Current set data shape and where weight is stored today
- Desired UX for batch editing or default weights

## 3) Different rep counts per side for unilateral lifts

Context: For unilateral exercises, users want different rep counts for left/right sides.

Questions to answer before implementation:

- How do we identify unilateral exercises today (a flag on exercise templates)?
- Should reps be stored as left/right fields or as two set entries?
- How should summaries display side differences?

Acceptance criteria:

- Unilateral exercises allow separate rep inputs per side.
- Non-unilateral exercises remain unchanged and simple.
- Data is saved and reloaded correctly for both sides.

Likely touchpoints:

- `mobile/src/screens/` workout logging UI
- `mobile/src/components/` rep input components
- `server/src/routes/` workout save handlers
- Exercise template metadata in `server/src/data/` or similar

Notes to share when asking for help:

- How unilateral exercises are defined in the current data model
- Desired UI layout for left/right reps on small screens

## 4) Split "Back" into "Lats" and "Upper Back" for exercise creation

Context: When creating a new exercise, the muscle group list should separate back into two categories.

Questions to answer before implementation:

- Where is the muscle group list defined (mobile constants vs server seed data)?
- Do existing exercises need migration or re-mapping?
- How should filtering/search/grouping behave after the split?

Acceptance criteria:

- Users can select either "Lats" or "Upper Back" when creating exercises.
- Existing exercises continue to display correctly.
- Filters and summaries use the new categories without errors.

Likely touchpoints:

- `mobile/src/screens/` exercise creation flow
- `mobile/src/components/` picker/select components
- `server/src/data/` seed files or enums
- `server/src/routes/` exercise creation endpoint

Notes to share when asking for help:

- Where muscle groups are sourced today
- Any existing analytics or grouping that depends on "Back"

## 5) Custom lift names bug out when saving a workout

Context: Some custom exercise names change or break after saving a workout.

Questions to answer before implementation:

- What does "bug out" mean exactly (empty, truncated, replaced, duplicated)?
- Does it happen only to custom exercises or also predefined ones?
- Is the issue on initial save, on reload, or both?

Acceptance criteria:

- Custom exercise names persist correctly across save and reload.
- No name changes in the workout history or summaries.
- Regression checks cover custom + predefined names.

Likely touchpoints:

- `mobile/src/screens/` workout save flow
- `server/src/routes/` workout save endpoint
- `server/src/db.ts` or serialization logic

Notes to share when asking for help:

- Repro steps, example exercise names, and any logs/errors

## 6) Immediate bug fixes or small features

- [x] Logging a set dims the audio until the timer runs out - it should only do this when the timer sound plays!
      Fix notes: Gate the audio-ducking call behind the timer sound playback event (not the set logging action). Check for any global "timer active" state that is lowering volume; move it to "play timer sound" only, and restore volume immediately after the sound finishes.
      Validation: Log a set with timer on/off, ensure volume only dips during the timer sound.
- [x] x button on suggested start
      Fix notes: Confirm the suggested-start card renders a close affordance. If missing, add a Pressable X icon to the card header and wire it to dismiss the suggestion (likely state in the workout start screen). Persist dismissal for the session only unless we want it remembered.
      Validation: Tap X to hide, and it should not block starting a workout.
- [x] ensure green highlight goes to next set after hitting log (isn’t working if timer is turned off) - it should highlight the set that is NOT logged & is next in order
      Validation: With timer off, log a set and verify highlight jumps to next unlogged set.
- [ ] save live visibility to be set to the last option you chose (for active workout sessions)
      Fix notes: Persist the visibility preference in local storage or session state (e.g., AsyncStorage + active session id). Load the stored value when resuming an active session and set the toggle default accordingly.
      Validation: Change visibility, background the app, reopen active session, and confirm it sticks.
- [ ] swapping to a custom workout in an active workout session does not properly swap the image
      Fix notes: Ensure the workout image source is keyed to the current workout id and updates when swapping. If a cache key or memo is stale, clear it on swap and update the image field on the active session state.
      Validation: Swap to a custom workout and confirm its image renders immediately and persists on reload.
- [ ] ensure the weights and sets get auto filled into next set
      Fix notes: After logging a set, copy prior set values into the next unlogged set (weight, reps, etc.) if the next set is empty. Use a guard to avoid overwriting user edits.
      Validation: Log a set, confirm next set pre-fills; edit next set manually, then log prior and confirm it does not overwrite.
- [ ] getting an issue when trying to change gym name to “crunch” it only saves “C” fix this (i had this issue with changing name and we fixed it) ensure editing profile works perfectly
      Fix notes: The input is likely being truncated by validation or a controlled input bug. Verify the text input uses full string state and server accepts full name length. Check any debounced save or "onChangeText" handler that might send only the first character.
      Validation: Update gym name to "crunch", save, reload profile, and confirm full value persists.
- [ ] i tried saving my workout and it glitched and all the sets are unlogged now
      Fix notes: On save, ensure the payload includes logged flags per set and server preserves them. Look for client-side reset logic after a failed save or a rehydrate path that defaults logged=false. Add a guard so failed saves do not reset local state.
      Validation: Save a workout with mixed logged/unlogged sets, refresh history, confirm statuses persist.
- [ ] it doesn’t let me add a decimal for distance in treadmill logging
      Fix notes: Update the distance input to accept decimals (keyboardType="decimal-pad" on iOS, "numeric" with decimal support on Android) and adjust validation/parsing to allow one decimal point.
      Validation: Enter 1.5 miles/kilometers and confirm it saves and renders correctly.
- [ ] it says i have unlogged sets when doing to save but it shows all my sets are logged. fix this bug
      Fix notes: The save gate likely checks a stale or incorrect "unlogged" computation. Ensure the validation uses the current set states and counts only sets that are required (skip warmups or deleted sets).
      Validation: Mark all sets logged, attempt save, and ensure no warning appears.
- [ ] when you delete a workout from your history it should delete in the squad feed and friends feed as well
      Fix notes: Confirm the delete endpoint also removes associated feed items. If feeds are derived from workout ids, cascade delete in the server and/or filter out missing workouts in feed queries.
      Validation: Delete a workout and verify it disappears from history, squad feed, and friends feed.
