ALTER TABLE users
ADD COLUMN IF NOT EXISTS gym_preferences JSONB DEFAULT '{
  "equipment": [],
  "bodyweightOnly": false,
  "gyms": [],
  "activeGymId": null,
  "warmupSets": {
    "enabled": false,
    "numSets": 2,
    "startPercentage": 50,
    "incrementPercentage": 15
  },
  "cardio": {
    "enabled": false,
    "timing": "after",
    "type": "mixed",
    "duration": 20,
    "frequency": 2
  },
  "sessionDuration": 60
}';

ALTER TABLE workout_sessions
ADD COLUMN IF NOT EXISTS cardio_data JSONB;
