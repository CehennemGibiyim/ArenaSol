import { desc } from "drizzle-orm";
import { db } from "@/db";
import { libraryItems } from "@/db/schema";
import { LibraryBrowser, type LibraryRow } from "@/components/library-browser";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  let items: LibraryRow[] = [];
  try {
    const rows = await db.select().from(libraryItems).orderBy(desc(libraryItems.integration), desc(libraryItems.id));
    items = rows.map((row) => ({
      id: row.id,
      name: row.name,
      repo: row.repo,
      packageName: row.packageName,
      language: row.language,
      category: row.category,
      description: row.description,
      install: row.install,
      capabilities: row.capabilities ?? [],
      integration: row.integration,
      momentum: row.momentum,
      docsUrl: row.docsUrl,
    }));
  } catch {
    items = [];
  }

  return (
    <div>
      <PageHeader
        eyebrow="Ekosistem · GitHub kütüphanesi"
        title="TikTok LIVE kütüphaneleri"
        description="Node, Python, C#, Java, Rust ve Go connector'ları; overlay sunucuları ve veri kütüphaneleri. Panele entegre olan sistemler, indirilebilir GitHub Pages web kütüphanesi ve Windows kurulum paketi burada."
        actions={<span className="chip">MIT · açık kaynak odaklı</span>}
      />
      <LibraryBrowser items={items} />
    </div>
  );
}
