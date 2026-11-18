export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { startScannerLoop } = await import("@/server/scanner");
    startScannerLoop();
  } catch {
    /* tarayıcı ilk API çağrısında başlar */
  }
}
