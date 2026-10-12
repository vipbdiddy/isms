// Settings that depend on what's being built, added on top of app.json.
// The web version lives at https://vipbdiddy.github.io/isms/app/, so its build (.github/workflows/website.yml)
// sets ISMS_WEB_BASE_URL=/isms/app. The phone apps are built without it and don't use a base URL.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.ISMS_WEB_BASE_URL ? { baseUrl: process.env.ISMS_WEB_BASE_URL } : {}),
  },
});
