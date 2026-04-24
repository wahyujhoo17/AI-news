module.exports = {
  apps: [
    {
      name: "ai-news-worker",
      script: "./worker.js",
      cwd: "./",
      // Secrets loaded from .env file via dotenv (see .env.example)
    },
    {
      name: "ai-news-worker-id",
      script: "./worker-id.js",
      cwd: "./",
      max_memory_restart: "220M",
      // Indonesian language news worker — writes articles with language='id'
    },
  ],
}
