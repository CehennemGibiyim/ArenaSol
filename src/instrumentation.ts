import { isCloudflareWorkers } from "@/lib/runtime";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Workers istekleri arasında arka plan döngüsü yaşamaz; tarama Windows ajanı
  // ve GitHub Actions tarafından yürütülür.
  if (isCloudflareWorkers()) return;
  try {
    const { startScannerLoop } = await import("@/server/scanner");
    startScannerLoop();
  } catch {
    /* tarayıcı ilk API çağrısında başlar */
  }
}
