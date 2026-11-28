// What a test file needs to reach its own services. setup.ts sets these before the file loads.
export function buildTestDeps() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is unset: tests/support/setup.ts has not run");
  return { databaseUrl };
}
