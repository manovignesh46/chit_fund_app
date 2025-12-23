module.exports = {
  apps: [
    {
      name: "chit-fund",
      cwd: "/home/mano/chit_fund_app/microfinance-app",
      script: "docker",
      args: "compose up -v",
      interpreter: "none",
      env: {
        NODE_ENV: "production"
      },
      autorestart: false,
      watch: false
    }
  ]
};
