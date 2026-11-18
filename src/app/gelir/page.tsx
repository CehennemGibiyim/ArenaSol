import { asc } from "drizzle-orm";
import { db } from "@/db";
import { creators } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import { RevenueConsole } from "@/components/revenue-console";

export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  let options: Array<{ value: string; label: string }> = [];
  try {
    const rows = await db
      .select({ id: creators.id, username: creators.username })
      .from(creators)
      .orderBy(asc(creators.username));
    options = rows.map((row) => ({ value: String(row.id), label: `@${row.username}` }));
  } catch {
    options = [];
  }

  return (
    <div>
      <PageHeader
        eyebrow="Finans · Mutabakat"
        title="Gelir & komisyon"
        description="Elmas kurunu, ajans komisyonunu ve tahsilat durumunu yönet. Hesaplayıcı ile yayıncı payını anında gör, kayıtları CSV olarak dışa aktar."
        actions={<span className="chip">TRY · USD · EUR</span>}
      />
      <RevenueConsole creators={options} />
    </div>
  );
}
