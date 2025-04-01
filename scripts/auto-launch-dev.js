const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// === CONFIG ===
const GITHUB_USER = 'fmfg03';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// === INPUT ===
const projectName = process.argv[2];
const shouldPushToGitHub = process.argv.includes('--push');

if (!projectName) {
  console.error('❌ You must pass a project name.\nUsage: node auto-launch-dev.js <project-name> [--push]');
  process.exit(1);
}

const projectPath = path.join(__dirname, '..', 'projects', projectName);
if (!fs.existsSync(projectPath)) {
  console.error(`❌ Project folder not found: ${projectPath}`);
  process.exit(1);
}

process.chdir(projectPath);
console.log(`📁 Launching MCP project: ${projectName} from ${projectPath}`);


// === FUNCTIONS ===

async function repoExists(repoName) {
  const url = `https://api.github.com/repos/${GITHUB_USER}/${repoName}`;
  try {
    const res = await axios.get(url, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': GITHUB_USER,
      },
    });
    return res.status === 200;
  } catch (err) {
    if (err.response && err.response.status === 404) return false;
    throw err;
  }
}

async function createGitHubRepo(repoName) {
  const url = 'https://api.github.com/user/repos';
  const res = await axios.post(
    url,
    {
      name: repoName,
      private: false,
      auto_init: false,
    },
    {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': GITHUB_USER,
      },
    }
  );

  if (res.status === 201) {
    console.log('✅ GitHub repo created');
  } else {
    throw new Error(`GitHub repo creation failed: ${res.status}`);
  }
}


// === MAIN ===

(async () => {
  try {
    // Step 1: Install dependencies
    console.log('📦 Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });

    // Step 2: Launch dev server with PM2
    console.log('🚀 Starting dev server with PM2...');
    execSync(`pm2 start npm --name ${projectName} -- run dev`, { stdio: 'inherit' });

    // Step 3: Optionally push to GitHub
    if (shouldPushToGitHub) {
      const repoUrl = `git@github.com:${GITHUB_USER}/${projectName}.git`;

      // Create GitHub repo if not already exists
      const exists = await repoExists(projectName);
      if (!exists) {
        console.log(`📡 Creating GitHub repo: ${projectName}`);
        await createGitHubRepo(projectName);
      } else {
        console.log(`ℹ️ GitHub repo already exists: ${repoUrl}`);
      }

      console.log('🔧 Initializing local Git repo...');
      execSync('git init', { stdio: 'inherit' });
      execSync('git add .', { stdio: 'inherit' });
      execSync('git commit -m "Initial commit from MCP launcher"', { stdio: 'inherit' });

      execSync(`git remote add origin ${repoUrl}`, { stdio: 'inherit' });
      execSync('git branch -M main', { stdio: 'inherit' });
      execSync('git push -u origin main', { stdio: 'inherit' });

      console.log(`✅ Pushed to GitHub: ${repoUrl}`);
    }

    console.log(`✅ Project "${projectName}" is now live on PM2 and GitHub.`);
  } catch (err) {
    console.error(`❌ ERROR: ${err.message}`);
    process.exit(1);
  }
})();
