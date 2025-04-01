const fs = require('fs');

const path = require('path');

const { execSync } = require('child_process');


const MCP_REPO = 'https://github.com/modelcontextprotocol/servers.git';

const TEMP_FOLDER = 'mcp-servers';

const SRC_PATH = path.join('projects', TEMP_FOLDER, 'src');


// === FULL LIST OF SUPPORTED SERVERS ===

// (you can expand or update this list anytime)

const SERVER_MAP = {

  'aws-kb-retrieval-server': 'Retrieval from AWS Knowledge Base',

  'brave-search': 'Web and local search using Brave Search API',

  'everart': 'AI image generation using various models',

  'everything': 'Reference / test server with tools and prompts',

  'fetch': 'Web content fetching and conversion',

  'filesystem': 'Secure file operations',

  'git': 'Git repo read/search tools',

  'github': 'GitHub repo/file API integration',

  'gitlab': 'GitLab project + API integration',

  'gdrive': 'Google Drive file access and search',

  'maps': 'Google Maps API access',

  'memory': 'Persistent memory via knowledge graph',

  'postgresql': 'Read-only Postgres DB access',

  'puppeteer': 'Browser automation and scraping',

  'redis': 'Redis interaction tools',

  'sentry': 'Sentry.io issue retrieval',

  'sequential-thinking': 'Dynamic reflective problem-solving',

  'slack': 'Slack channel + messaging API',

  'sqlite': 'SQLite business intelligence tools',

  'time': 'Time and timezone conversion tools',

  // Add more from README here...

};


function listServers() {

  console.log('\nÌ†ΩÌ≥ö Available MCP Servers:\n');

  Object.entries(SERVER_MAP).forEach(([key, desc]) => {

    console.log(`Ì†ΩÌ¥π ${key.padEnd(28)} ‚Äî ${desc}`);

  });

  console.log('\n');

  process.exit(0);

}


function abort(msg) {

  console.error(`‚ùå ${msg}`);

  process.exit(1);

}


// === MAIN ===

(async () => {

  const args = process.argv.slice(2);

  if (args.includes('--list')) return listServers();


  const serverId = args[0];

  const projectName = args[1];

  const push = args.includes('--push');


  if (!serverId || !projectName) {

    abort('Usage: node setup-project.js <server-id> <project-name> [--push]\nUse --list to see all server IDs.');

  }


  if (!SERVER_MAP[serverId]) {

    abort(`Unknown server ID: ${serverId}\nRun with --list to see valid options.`);

  }


  const projectsDir = path.join(__dirname, '..', 'projects');

  const projectPath = path.join(projectsDir, projectName);


  if (fs.existsSync(projectPath)) {

    abort(`Project folder already exists: ${projectPath}`);

  }


  // Clone repo if not already cloned

  const tempPath = path.join(projectsDir, TEMP_FOLDER);

  if (!fs.existsSync(tempPath)) {

    console.log('‚¨áÔ∏è  Cloning MCP servers repo...');

    execSync(`git clone ${MCP_REPO} ${TEMP_FOLDER}`, { cwd: projectsDir, stdio: 'inherit' });

  }


  // Check if server folder exists

  const sourcePath = path.join(projectsDir, TEMP_FOLDER, 'src', serverId);

  if (!fs.existsSync(sourcePath)) {

    abort(`Server "${serverId}" not found in src/`);

  }


  // Copy server folder into new project

  console.log(`Ì†ΩÌ≥¶ Creating project "${projectName}" using server "${serverId}"...`);

  execSync(`cp -r "${sourcePath}" "${projectPath}"`);


  // Cleanup MCP monorepo

  console.log('Ì†æÌ∑π Cleaning up MCP repo...');

  execSync(`rm -rf "${tempPath}"`);


  // Launch with auto-launch-dev.js

  console.log('Ì†ΩÌ∫Ä Bootstrapping project...');

  const launchScript = path.join(__dirname, 'auto-launch-dev.js');

  const launchCmd = `node "${launchScript}" "${projectName}" ${push ? '--push' : ''}`;

  execSync(launchCmd, { stdio: 'inherit' });


  console.log(`‚úÖ Project "${projectName}" is live.`);

})();

