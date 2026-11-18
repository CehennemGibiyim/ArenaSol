import Link from "next/link";
import { MonitorDown } from "lucide-react";
import { PackageCenter } from "@/components/package-center";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function WindowsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Dağıtım · Windows"
        title="Windows kurulum paketi"
        description="Tek zip ile Windows kurulumu: KURULUM.bat, PowerShell sihirbazı, portable başlatıcı ve NSIS installer şablonu. Aynı paket GitHub web kütüphanesi overlay'lerini de içerir."
        actions={
          <>
            <a href="/api/packages/windows" className="btn btn-primary">
              <MonitorDown size={14} /> Paketi indir
            </a>
            <Link href="/kutuphane" className="btn">
              Web kütüphanesi
            </Link>
          </>
        }
      />
      <PackageCenter />
    </div>
  );
}
