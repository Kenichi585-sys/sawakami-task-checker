import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const vitestConfig = defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
  },
});

export default vitestConfig;
