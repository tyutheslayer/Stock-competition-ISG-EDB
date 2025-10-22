-- 1) Create enum types (idempotent)
DO $$ BEGIN
  CREATE TYPE "QuizVisibility"  AS ENUM ('PUBLIC', 'PLUS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "QuizDifficulty"  AS ENUM ('EASY', 'MEDIUM', 'HARD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "QuestionKind"    AS ENUM ('SINGLE', 'MULTI');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Drop defaults before altering types
ALTER TABLE "Quiz"     ALTER COLUMN "visibility" DROP DEFAULT;
ALTER TABLE "Quiz"     ALTER COLUMN "difficulty" DROP DEFAULT;
ALTER TABLE "Question" ALTER COLUMN "kind"       DROP DEFAULT;

-- 3) Sanitize any existing data so it casts cleanly
UPDATE "Quiz"
SET "visibility" = 'PUBLIC'
WHERE "visibility" IS NULL OR "visibility" NOT IN ('PUBLIC','PLUS');

UPDATE "Quiz"
SET "difficulty" = 'EASY'
WHERE "difficulty" IS NULL OR "difficulty" NOT IN ('EASY','MEDIUM','HARD');

UPDATE "Question"
SET "kind" = 'SINGLE'
WHERE "kind" IS NULL OR "kind" NOT IN ('SINGLE','MULTI');

-- 4) Convert column types to enums (cast from text)
ALTER TABLE "Quiz"
  ALTER COLUMN "visibility" TYPE "QuizVisibility" USING "visibility"::text::"QuizVisibility",
  ALTER COLUMN "difficulty" TYPE "QuizDifficulty" USING "difficulty"::text::"QuizDifficulty";

ALTER TABLE "Question"
  ALTER COLUMN "kind" TYPE "QuestionKind" USING "kind"::text::"QuestionKind";

-- 5) Re-add enum defaults
ALTER TABLE "Quiz"     ALTER COLUMN "visibility" SET DEFAULT 'PUBLIC'::"QuizVisibility";
ALTER TABLE "Quiz"     ALTER COLUMN "difficulty" SET DEFAULT 'EASY'::"QuizDifficulty";
ALTER TABLE "Question" ALTER COLUMN "kind"       SET DEFAULT 'SINGLE'::"QuestionKind";