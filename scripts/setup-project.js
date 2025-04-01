const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');
const GITHUB_USER = 'fmfg03';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const projectName = process.argv[2];  // 'site-007' or whatever project name
const shouldPushToGitHub = process.argv.includes('--push');

if (!projectName) {
  console.error('❌ Project name is required.');
  process.exit(1);
}

// Path for new project
const projectPath = path.join(__dirname, '..', 'projects', projectName);

// Function to install dependencies
function installDependencies() {
  console.log('📦 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit', cwd: projectPath });
}

// Function to push to GitHub and handle force push
async function pushToGitHub() {
  console.log('🔧 Initializing Git repo...');
  execSync('git init', { stdio: 'inherit', cwd: projectPath });
  execSync('git add .', { stdio: 'inherit', cwd: projectPath });
  execSync('git commit -m "Initial commit from MCP launcher"', { stdio: 'inherit', cwd: projectPath });

  // Force push to avoid repo conflicts (this will overwrite history)
  console.log('🚀 Force pushing to GitHub...');
  await createGitHubRepo(projectName);
  const repoUrl = `git@github.com:${GITHUB_USER}/${projectName}.git`;
  execSync(`git remote add origin ${repoUrl}`, { stdio: 'inherit', cwd: projectPath });
  execSync('git branch -M main', { stdio: 'inherit', cwd: projectPath });
  execSync('git push -u origin main --force', { stdio: 'inherit', cwd: projectPath });

  console.log(`✅ Pushed to GitHub: ${repoUrl}`);
}

// Function to create a GitHub repo
async function createGitHubRepo(repoName) {
  const url = 'https://api.github.com/user/repos';
  const res = await axios.post(
    url,
    { name: repoName, private: false, auto_init: false },
    { headers: { Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': GITHUB_USER } }
  );

  if (res.status === 201) {
    console.log('✅ GitHub repo created');
  } else {
    throw new Error(`GitHub repo creation failed: ${res.status}`);
  }
}

// Function to update .gitignore to prevent API key push
function updateGitIgnore() {
  const gitignorePath = path.join(projectPath, '.gitignore');
  const envLine = '.env\n';

  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, envLine);
  } else {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    if (!gitignoreContent.includes('.env')) {
      fs.appendFileSync(gitignorePath, envLine);
    }
  }
}

async function setupProject() {
  try {
    // Step 1: Clone the MCP project (site-007 or custom project)
    console.log(`⬇️ Cloning MCP repo for ${projectName}...`);
    execSync(`git clone https://github.com/fmfg03/mcp-project-launcher.git ${projectPath}`, { stdio: 'inherit' });

    // Step 2: Install dependencies and handle any missing files
    installDependencies();
    updateGitIgnore();

    // Step 3: Force push to GitHub
    if (shouldPushToGitHub) {
      await pushToGitHub();
    }

    console.log(`✅ Project "${projectName}" is now set up with dependencies and pushed to GitHub.`);
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  }
}

setupProject();
