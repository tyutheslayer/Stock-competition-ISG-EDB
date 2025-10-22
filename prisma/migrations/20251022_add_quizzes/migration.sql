-- ==========================================
-- Migration : add_quizzes
-- ==========================================

CREATE TABLE "Quiz" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT UNIQUE NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "visibility" TEXT DEFAULT 'PUBLIC',
  "difficulty" TEXT DEFAULT 'EASY',
  "isDraft" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Question" (
  "id" TEXT PRIMARY KEY,
  "quizId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "kind" TEXT DEFAULT 'SINGLE',
  "explanation" TEXT,
  "orderIndex" INTEGER DEFAULT 0,
  FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE CASCADE
);

CREATE TABLE "Choice" (
  "id" TEXT PRIMARY KEY,
  "questionId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "isCorrect" BOOLEAN DEFAULT FALSE,
  FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE
);

CREATE TABLE "QuizAttempt" (
  "id" TEXT PRIMARY KEY,
  "quizId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "startedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP,
  "scorePct" INTEGER,
  FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE TABLE "AttemptAnswer" (
  "id" TEXT PRIMARY KEY,
  "attemptId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "choiceId" TEXT,
  "isCorrect" BOOLEAN,
  FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("choiceId") REFERENCES "Choice" ("id")
);