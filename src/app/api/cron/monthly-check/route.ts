import type { NextRequest } from "next/server";

import { runScheduledCheck } from "@/checks/scheduled-check";

export const dynamic = "force-dynamic";

const isAuthorized = (request: NextRequest) => {
  const cronSecret = process.env.CRON_SECRET;

  return (
    cronSecret !== undefined &&
    cronSecret !== "" &&
    request.headers.get("authorization") === `Bearer ${cronSecret}`
  );
};

export const GET = async (request: NextRequest) => {
  if (!isAuthorized(request)) {
    return Response.json({ success: false }, { status: 401 });
  }

  try {
    const outcome = await runScheduledCheck();

    return Response.json({ success: true, outcome });
  } catch {
    console.error("定期確認処理に失敗しました。");

    return Response.json({ success: false }, { status: 500 });
  }
};
