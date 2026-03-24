module.exports = {
  apps: [
    {
      name: "ai-news-worker",
      script: "./worker.js",
      cwd: "./",
      env: {
        OPENROUTER_API_KEY: "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",
        OPENROUTER_MODEL: "openrouter/stepfun/step-3.5-flash:free",
        PGHOST: "localhost",
        PGPORT: "5432",
        PGDATABASE: "ai_news_db",
        PGUSER: "ai_news_user",
        PGPASSWORD: "StrongPass123!",
      },
    },
  ],
}
