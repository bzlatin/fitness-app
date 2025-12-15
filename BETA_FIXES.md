# Beta Testing Fixes & Improvements

## User Feedback - Workout Session Experience

### Warm-Up Features

- [x] Add warm-up sets before heavy working sets

  - Auto-suggest warm-up progression (e.g., 50% → 75% → 90% of working weight)
  - Mark warm-up sets differently in UI (lighter color, "WARM UP" badge)
  - Ability for users to toggle on/off
  - users can choose to toggle warm up sets to show or not when manually creating a workout too

- [x] Daily warm-up routine suggestion
  - Show dynamic warm-up exercises for muscle groups being trained
  - Example: "Roll chest" before chest workout

### Exercise Transition & Navigation

- [x] Fix exercise transition behavior
  - **Issue**: Currently auto-focuses on weight input when moving to next exercise
  - **Desired**: Show exercise name and image at top first (confirmation of what's next)
  - Keep focus on exercise overview, let user tap into weight input manually

### Weight & Rep Recommendations

- [x] Initial weight and rep suggestions for new exercises

  - Use progression service to analyze user's history with similar movements
  - Show suggested starting weight for users with no history on that exercise

- [x] Auto-carry weight to next set
  - Pre-fill next set with previous set's weight

### Exercise Instructions

- [x] Better exercise descriptions using instructions column in exercises table
  - Add more detailed instructions in a pop up hiding in an info icon or something (setup, execution, common mistakes)

### Post-Set Feedback

- [x] User difficulty feedback after each set
  - Quick rating: "Too Easy / Just Right / Too Hard"
  - Use feedback to improve next workout's weight suggestions
  - Store difficulty ratings in workout_sets table and use this data when recommending weight/reps

### Rest Timer Improvements

- [x] Customize rest timer for warm-ups vs working sets

  - Shorter default rest for warm-up sets (45s) ✅ Automatic detection
  - Normal working sets (90s) ✅
  - Longer rest for heavy sets (180s/3min) ✅ Smart detection based on weight and reps
  - Add stretch timer option ✅ 5-minute preset in timer adjustment modal
  - Added quick preset buttons: Warm-up (45s), Working (90s), Heavy (3min), Stretch (5min)

- [ ] Fix rest timer chime sound
  - When music is playing it is hard to hear it - how can we fix this? Also should it play no matters users silent mode on/off? i think if headphones are in and music is playing it should play the sound no matter what.

### UI/Display Fixes

- [x] Fix text overflow issues
  - **Issue**: Weight input/display bleeding off page
  - Fixed exercise name truncation with `numberOfLines={1}` and `flex: 1`
  - Fixed stats column with `flexShrink: 0` to prevent wrapping
  - Shortened "Add past" button to "Log" to prevent clipping on smaller screens

---
