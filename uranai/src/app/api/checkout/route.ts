import { z } from "zod";
import { guardPost, jsonError, jsonOk, readJson } from "@/lib/api";
import { getQrStoreCode, setAccessCookie } from "@/lib/cookies";
import { CheckoutError, createCheckout } from "@/lib/services/checkout";

const bodySchema = z.object({ fortuneType: z.enum(["BIRTHDAY", "ZODIAC", "BLOOD"]) }).strict();

/** 決済セッション作成。金額・店舗はサーバー側で決定する（body に金額や storeId は受け付けない） */
export async function POST(req: Request) {
  const blocked = await guardPost(req, "checkout", 20, 60);
  if (blocked) return blocked;
  let body;
  try {
    body = bodySchema.parse(await readJson(req));
  } catch {
    return jsonError(400, "invalid_request", "占いの種類を選び直してください。");
  }
  try {
    const { checkoutId, accessToken } = await createCheckout(await getQrStoreCode(), body.fortuneType);
    await setAccessCookie(accessToken);
    return jsonOk({ checkoutId }, 201);
  } catch (e) {
    if (e instanceof CheckoutError) return jsonError(e.httpStatus, e.code, e.userMessage);
    console.error("[api/checkout] failed", (e as Error).message);
    return jsonError(500, "internal", "エラーが発生しました。時間をおいて再度お試しください。");
  }
}
