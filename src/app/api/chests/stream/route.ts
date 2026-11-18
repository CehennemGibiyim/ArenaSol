import { chestEvents, listChests, listFlows } from "@/server/chest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      send("hello", { bridge: true, at: Date.now() });
      let lastCount = -1;
      const tick = async () => {
        try {
          const [chestRows, flowRows] = await Promise.all([listChests({}, 100), listFlows(50)]);
          const total = chestRows.length + flowRows.length;
          if (total !== lastCount) {
            send("snapshot", { chests: chestRows, flows: flowRows, count: total, at: Date.now() });
            lastCount = total;
          }
        } catch {
          /* akış sessizce sürer */
        }
      };
      // Yeni sandık anında anlık itme
      const onChest = (chest: unknown) => { try { send("chest", { chest, at: Date.now() }); } catch { /* kapandı */ } };
      chestEvents.on("chest", onChest);
      await tick();
      const timer = setInterval(() => {
        void tick();
        controller.enqueue(encoder.encode(": keep-alive\n\n"));
      }, 5000);
      const cleanup = () => { clearInterval(timer); chestEvents.off("chest", onChest); };
      setTimeout(() => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* zaten kapalı */
        }
      }, 5 * 60 * 1000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
