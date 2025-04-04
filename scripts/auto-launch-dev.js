const axios = require('axios');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const GITHUB_USER = 'fmfg03';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const projectName = process.argv[2];
const shouldPushToGitHub = process.argv.includes('--push');

if (!projectName) {
  console.error('❌ Usage: node auto-launch-dev.js <project-name> [--push]');
  process.exit(1);
}

const projectPath = path.join(__dirname, '..', 'projects', projectName);
if (!fs.existsSync(projectPath)) {
  console.error(`❌ Project folder not found: ${projectPath}`);
  process.exit(1);
}

process.chdir(projectPath);
console.log(`📁 Launching project: ${projectName}`);

const createGitHubRepo = async (repoName) => {
  console.log(`📡 Creating GitHub repo: ${repoName}`);
  const url = 'https://api.github.com/user/repos';

  try {
    await axios.post(
      url,
      { name: repoName, private: false, auto_init: false },
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          'User-Agent': GITHUB_USER,
        },
      }
    );
    console.log('✅ GitHub repo created');
  } catch (err) {
    if (err.response?.status === 422) {
      console.log('ℹ️ Repo already exists. Skipping creation.');
    } else {
      throw err;
    }
  }
};

try {
  // Create .env if it doesn’t exist
  const envPath = path.join(projectPath, '.env');
  const gitignorePath = path.join(projectPath, '.gitignore');
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, `OPENAI_API_KEY=\nANTHROPIC_API_KEY=\n`);
    console.log('🛠️  Created .env file (edit it manually with real keys)');
  }
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, 'node_modules/\n.env\n');
  }

  console.log('📦 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });

  const packageJson = require(path.join(projectPath, 'package.json'));
  if (packageJson.scripts?.build) {
    console.log('🛠️  Running build...');
    execSync('npm run build', { stdio: 'inherit' });
  }

  console.log('🚀 Starting dev server with PM2...');
  execSync(`pm2 start npm --name ${projectName} -- run dev`, { stdio: 'inherit' });

  console.log('🧠 Starting llm-router...');
  execSync(`pm2 start node --name ${projectName}-router -- llm-router.js`, { stdio: 'inherit' });

  if (shouldPushToGitHub) {
    console.log('🔧 Preparing Git repo...');
    execSync('git init', { stdio: 'inherit' });
    execSync('git remote remove origin || true', { stdio: 'ignore' });
    execSync(`git remote add origin git@github.com:${GITHUB_USER}/${projectName}.git`, { stdio: 'inherit' });

    execSync('git add .', { stdio: 'inherit' });
    execSync('git commit -m "Initial commit from MCP launcher"', { stdio: 'inherit' });

    createGitHubRepo(projectName).then(() => {
      try {
        execSync('git pull --rebase origin main || true', { stdio: 'inherit' });
        execSync('git branch -M main', { stdio: 'inherit' });
        execSync('git push -u origin main', { stdio: 'inherit' });
        console.log(`✅ Pushed to GitHub: https://github.com/${GITHUB_USER}/${projectName}`);
      } catch (err) {
        console.error(`⚠️  Push failed: ${err.message}`);
      }
    });
  }

  console.log(`✅ Project "${projectName}" is live.`);
} catch (err) {
  console.error(`❌ ERROR: ${err.message}`);
  process.exit(1);
}
