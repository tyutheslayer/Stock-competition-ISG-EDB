-- Create enum types
DO $$ BEGIN
  CREATE TYPE "QuizVisibility"  AS ENUM ('PUBLIC', 'PLUS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "QuizDifficulty"  AS ENUM ('EASY', 'MEDIUM', 'HARD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "QuestionKind"    AS ENUM ('SINGLE', 'MULTI');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Convert existing TEXT columns to enum types (casting from current values)
ALTER TABLE "Quiz"
  ALTER COLUMN "visibility" TYPE "QuizVisibility" USING "visibility"::text::"QuizVisibility",
  ALTER COLUMN "difficulty" TYPE "QuizDifficulty" USING "difficulty"::text::"QuizDifficulty";

ALTER TABLE "Question"
  ALTER COLUMN "kind" TYPE "QuestionKind" USING "kind"::text::"QuestionKind";