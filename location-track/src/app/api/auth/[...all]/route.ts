import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";
import { withPrivateNoStore } from "@/lib/cache";

export const dynamic = "force-dynamic";

const authHandlers = toNextJsHandler(auth);

export async function GET(request: Request) {
  return withPrivateNoStore(await authHandlers.GET(request));
}

export async function POST(request: Request) {
  return withPrivateNoStore(await authHandlers.POST(request));
}
