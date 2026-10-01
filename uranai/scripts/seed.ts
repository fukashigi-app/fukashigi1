/**
 * 開発用デモデータ。`npm run db:seed`
 * 運営アカウント・デモ店舗・店舗スタッフを作成する（既存なら何もしない）。
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stores, users } from "@/lib/db/schema";
import { createOperator, createStore, createStoreUser, updateBankInfo } from "@/lib/services/stores";

const SYSTEM = { userId: null, role: "SYSTEM" as const };

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("seed is for development only");
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "AdminPass2026";
  const storeEmail = process.env.SEED_STORE_EMAIL ?? "store@example.com";
  const storePassword = process.env.SEED_STORE_PASSWORD ?? "StorePass2026";

  const [existingAdmin] = await db().select().from(users).where(eq(users.email, adminEmail));
  if (!existingAdmin) await createOperator({ name: "運営管理者", email: adminEmail, password: adminPassword });

  let [store] = await db().select().from(stores).where(eq(stores.name, "BAR Lune（デモ店舗）"));
  if (!store) {
    store = await createStore(
      { name: "BAR Lune（デモ店舗）", contactName: "月野 しずか", postalCode: "150-0001", address: "東京都渋谷区神宮前1-2-3 ルナビル2F", phone: "03-1234-5678", email: "lune@example.com" },
      SYSTEM,
    );
    await updateBankInfo(
      store.id,
      { bankName: "みずほ銀行", bankCode: "0001", branchName: "渋谷支店", branchCode: "210", accountType: "普通", accountNumber: "1234567", accountHolder: "カ）ルナ" },
      SYSTEM,
    );
    await createStoreUser(store.id, { name: "月野 しずか", email: storeEmail, password: storePassword }, SYSTEM);
  }
  const [cafe] = await db().select().from(stores).where(eq(stores.name, "Café Stella（デモ店舗）"));
  if (!cafe) {
    const c = await createStore({ name: "Café Stella（デモ店舗）", contactName: "星野 ひかり", postalCode: "530-0001", address: "大阪府大阪市北区梅田1-1-1", phone: "06-1234-5678", email: "stella@example.com" }, SYSTEM);
    await createStoreUser(c.id, { name: "星野 ひかり", email: "cafe@example.com", password: storePassword }, SYSTEM);
  }

  console.log("Seed completed");
  console.log(`  運営:   ${adminEmail} / ${adminPassword}  → /admin/login`);
  console.log(`  店舗:   ${storeEmail} / ${storePassword}  → /store/login`);
  console.log(`  QR URL: ${process.env.APP_URL}/s/${store.storeCode}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
