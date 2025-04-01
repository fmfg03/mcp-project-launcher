const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');

const MCP_REPO = 'https://github.com/modelcontextprotocol/servers.git';
const MCP_FOLDER_NAME = 'mcp-servers';
const SERVER_FOLDER = 'everything'; // Default server folder
const projectsDir = path.join(__dirname, '..', 'projects');
const GITHUB_USER = 'fmfg03';  // Change this to your GitHub username
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;  // Ensure GITHUB_TOKEN is set in your environment

function abort(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function writeConfigFile(projectPath) {
  const config = {
    agents: {
      builder: {
        model: 'gpt-4',
        persona: 'Builder',
        rolePrompt: 'You are a senior web developer helping build and iterate on a website idea.'
      },
      judge: {
        model: 'claude-3-sonnet',
        persona: 'Judge',
        rolePrompt: 'You are a critical reviewer evaluating the builder’s output and suggesting improvements.'
      }
    },
    conversationHistoryPath: './memory/history.json'
  };

  fs.writeFileSync(path.join(projectPath, '.mcp.config.json'), JSON.stringify(config, null, 2));
}

function createMemoryAndAssets(projectPath) {
  const memoryDir = path.join(projectPath, 'memory');
  fs.mkdirSync(memoryDir, { recursive: true });
  fs.writeFileSync(path.join(memoryDir, 'history.json'), '[]');

  const projectDir = path.join(projectPath, 'project');
  fs.mkdirSync(projectDir, { recursive: true });

  fs.writeFileSync(path.join(projectDir, 'index.html'), `<!DOCTYPE html>
<html>
<head>
  <title>My MCP Site</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <h1>Welcome to your new site</h1>
  <script src="script.js"></script>
</body>
</html>`);

  fs.writeFileSync(path.join(projectDir, 'styles.css'), `body {
  font-family: sans-serif;
  background: #f5f5f5;
  padding: 2rem;
}`);

  fs.writeFileSync(path.join(projectDir, 'script.js'), `console.log("Hello from your MCP site!");`);

  fs.writeFileSync(path.join(projectDir, 'content.md'), `# Content Plan

- Homepage
- About section
- Contact form
`);

  const tsconfig = {
    "compilerOptions": {
      "target": "ES2017",
      "module": "CommonJS",
      "moduleResolution": "Node",
      "esModuleInterop": true,
      "forceConsistentCasingInFileNames": true,
      "strict": true,
      "skipLibCheck": true,
      "downlevelIteration": true,
      "outDir": "dist"
    },
    "include": ["**/*.ts"],
    "exclude": ["node_modules"]
  };

  fs.writeFileSync(path.join(projectPath, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
}

// Create GitHub repository via GitHub API
async function createGitHubRepo(projectName) {
  const url = 'https://api.github.com/user/repos';
  const res = await axios.post(
    url,
    {
      name: projectName,
      private: false,  // Change this to true if you want a private repo
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
    console.log(`✅ GitHub repo created: ${projectName}`);
  } else {
    throw new Error(`GitHub repo creation failed: ${res.status}`);
  }
}

(async () => {
  const args = process.argv.slice(2);
  const projectName = args.find(arg => !arg.startsWith('--'));
  const push = args.includes('--push');

  if (!projectName) {
    abort('Missing project name.\nUsage: node setup-project.js site-006 --push');
  }

  const projectPath = path.join(projectsDir, projectName);
  if (fs.existsSync(projectPath)) {
    abort(`Project folder already exists: ${projectPath}`);
  }

  const tempPath = path.join(projectsDir, MCP_FOLDER_NAME);
  if (!fs.existsSync(tempPath)) {
    console.log('⬇️  Cloning MCP servers repo...');
    execSync(`git clone ${MCP_REPO} ${MCP_FOLDER_NAME}`, { cwd: projectsDir, stdio: 'inherit' });
  }

  const sourcePath = path.join(tempPath, 'src', SERVER_FOLDER);
  if (!fs.existsSync(sourcePath)) {
    abort(`Server folder not found: ${sourcePath}`);
  }

  console.log(`📦 Setting up project "${projectName}" from "${SERVER_FOLDER}" server...`);
  execSync(`cp -r "${sourcePath}" "${projectPath}"`);

  console.log('🧠 Writing config + memory...');
  writeConfigFile(projectPath);
  createMemoryAndAssets(projectPath);

  console.log('🧹 Cleaning up cloned MCP repo...');
  execSync(`rm -rf "${tempPath}"`);

  console.log('🚀 Bootstrapping dev server...');
  execSync(`cd ${projectPath} && npm install`, { stdio: 'inherit' });

  // Ensure .gitignore exists, create if it doesn't
  const gitignorePath = path.join(projectPath, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, '');
  }

  // Add .env to .gitignore if it's not already there
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  if (!gitignoreContent.includes('.env')) {
    fs.appendFileSync(gitignorePath, '\n.env\n');
  }

  // Ensure .env file is created with API keys (this will be ignored by Git)
  const envFilePath = path.join(projectPath, '.env');
  const envContent = `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY}
OPENAI_API_KEY=${process.env.OPENAI_API_KEY}`;
  fs.writeFileSync(envFilePath, envContent);

  // Automatically create GitHub repo if it doesn't exist
  try {
    await createGitHubRepo(projectName);
  } catch (err) {
    abort(err.message);
  }

  // Initialize Git repo, create the main branch and push
  console.log('🧹 Resetting git repo...');
  execSync('cd ' + projectPath + ' && git init', { stdio: 'inherit' });
  execSync('cd ' + projectPath + ' && git checkout -b main', { stdio: 'inherit' });

  // Handle already committed changes
  const status = execSync('cd ' + projectPath + ' && git status --porcelain', { stdio: 'pipe' }).toString();
  if (status) {
    execSync('cd ' + projectPath + ' && git add .', { stdio: 'inherit' });
    execSync('cd ' + projectPath + ' && git commit -m "Initial commit with full setup"', { stdio: 'inherit' });
  } else {
    console.log('No changes to commit.');
  }

  execSync('cd ' + projectPath + ' && git remote add origin git@github.com:fmfg03/' + projectName + '.git', { stdio: 'inherit' });
  execSync('cd ' + projectPath + ' && git push -u origin main', { stdio: 'inherit' });

  // Start PM2 dev server and llm-router.js
  const launcher = path.join(__dirname, 'auto-launch-dev.js');
  const cmd = `node "${launcher}" "${projectName}" ${push ? '--push' : ''}`;
  execSync(cmd, { stdio: 'inherit' });

  console.log(`✅ Project "${projectName}" is live.`);
})();
