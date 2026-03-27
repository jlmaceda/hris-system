import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      manifest: {
        name: "Fitness Depot HRIS",
        short_name: "HRIS",
        description: "HRIS Attendance and Payroll System",
        theme_color: "#22c55e",
        display: "standalone",
        background_color: "#ffffff",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            // App shell & navigations
            urlPattern: ({ request }: { request: Request }) => request.destination === "document",
            handler: "NetworkFirst",
            options: {
              cacheName: "documents",
            },
          },
          {
            // Images (selfies, thumbnails, etc.)
            urlPattern: ({ request }: { request: Request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "images",
            },
          },
          {
            // JS/CSS/static assets
            urlPattern: ({ request }: { request: Request }) => {
              const dest = request.destination;
              return dest === "script" || dest === "style" || dest === "worker" || dest === "font";
            },
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "assets",
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
