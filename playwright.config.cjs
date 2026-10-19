const { defineConfig } = require('@playwright/test');
const { resolve } = require('node:path');
module.exports = defineConfig({
  testDir: './tests', timeout: 45000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5175', viewport: {width:1440,height:1000}, channel:'msedge', headless:true },
  outputDir: 'artifacts/test-results',
  webServer: [
    {command:'node apps/server/dist/main.js',url:'http://127.0.0.1:3001/api/health',env:{PORT:'3001',GEARFLOW_DB_PATH:resolve('artifacts/e2e.sqlite')},reuseExistingServer:false},
    {command:'npm run dev --workspace=@gearflow/customer-web -- --host 127.0.0.1 --port 5175 --strictPort',url:'http://127.0.0.1:5175',env:{GEARFLOW_API_TARGET:'http://127.0.0.1:3001'},reuseExistingServer:false}
  ]
});
