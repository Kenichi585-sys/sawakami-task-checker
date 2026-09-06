import "server-only";

import { neon } from "@neondatabase/serverless";

const getDatabaseUrl = () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl === undefined) {
    throw new Error("DATABASE_URLが設定されていません。");
  }

  return databaseUrl;
};

export const getSql = () => neon(getDatabaseUrl());
