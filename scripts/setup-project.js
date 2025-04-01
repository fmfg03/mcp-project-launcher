const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Initialize Git repository and push changes if there are changes to commit
function handleGitCommitAndPush(projectPath) {
  // Check if there are changes in the repository
  const status = execSync('cd ' + projectPath + ' && git status --porcelain', { stdio: 'pipe' }).toString();

  if (status) {
    console.log('Changes detected, committing...');
    execSync('cd ' + projectPath + ' && git add .', { stdio: 'inherit' });
    execSync('cd ' + projectPath + ' && git commit -m "Initial commit from MCP launcher"', { stdio: 'inherit' });
  } else {
    console.log('No changes to commit.');
  }

  // Push to GitHub
  console.log('Pushing changes to GitHub...');
  execSync(`cd ${projectPath} && git push -u origin main`, { stdio: 'inherit' });
}

// Initialize Git repository if not already initialized and handle push
function initializeGitRepo(projectPath, projectName) {
  if (!fs.existsSync(path.join(projectPath, '.git'))) {
    console.log('Initializing Git repo...');
    execSync('cd ' + projectPath + ' && git init', { stdio: 'inherit' });
    execSync('cd ' + projectPath + ' && git remote add origin git@github.com:fmfg03/' + projectName + '.git', { stdio: 'inherit' });
  } else {
    console.log('Git repo already initialized.');
  }

  handleGitCommitAndPush(projectPath);
}

(async () => {
  const projectName = 'site-007';  // Or dynamically assign as needed
  const projectPath = path.join(__dirname, '..', 'projects', projectName);

  // Initialize and handle git repo commit and push logic
  initializeGitRepo(projectPath, projectName);
})();
