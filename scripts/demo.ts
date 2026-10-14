// Local demo: serves the fictional fixture websites and starts the dashboard, so you can
// try ProspectScan without auditing real businesses.  Run: npm run demo
import { JobStore } from '../src/jobs.js';
import { createApp } from '../src/server.js';
import { startFixtureSites } from '../test/fixtures.js';

const sites = await startFixtureSites();
const port = Number(process.env.PORT || 3000);
createApp(new JobStore(4, { allowPrivateNetworks: true })).listen(port, () => {
  console.log(`\nProspectScan demo: http://localhost:${port}\n\nPaste these fictional sites into the Websites box:\n`);
  for (const url of Object.values(sites.urls)) console.log('  ' + url);
  console.log('\nCtrl+C to stop.');
});
