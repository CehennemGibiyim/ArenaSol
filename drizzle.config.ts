import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Windows sihirbazı DATABASE_URL'i .env dosyasına yazar; şema itme (push)
// bu değeri kullanır. Değer yoksa yerel varsayılana düşer.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
  },
});
