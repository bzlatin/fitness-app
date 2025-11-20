import { Router } from "express";
import { exercises } from "../data/exercises";

const router = Router();

router.get("/", (req, res) => {
  const { muscleGroup, equipment } = req.query;

  let results = exercises;
  if (muscleGroup && typeof muscleGroup === "string") {
    results = results.filter(
      (ex) => ex.primaryMuscleGroup === muscleGroup
    );
  }
  if (equipment && typeof equipment === "string") {
    results = results.filter((ex) => ex.equipment === equipment);
  }

  res.json(results);
});

export default router;
