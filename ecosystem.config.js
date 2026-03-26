module.exports = {
  apps: [
    {
      name: "ai-news-worker",
      script: "./worker.js",
      cwd: "./",
      // Secrets loaded from .env file via dotenv (see .env.example)
    },
  ],
}
