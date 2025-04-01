require('dotenv').config({ path: './.env' });

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { ChatOpenAI } = require('@langchain/openai');
const { ChatAnthropic } = require('@langchain/anthropic');
const { HumanMessage, AIMessage, SystemMessage } = require('@langchain/core/messages');

// Validate required environment variables before proceeding
function validateEnvVars() {
  const requiredVars = {
    'claude-3-sonnet': ['ANTHROPIC_API_KEY'],
    'gpt-4o': ['OPENAI_API_KEY']
  };
  
  const missingVars = [];
  
  // Check config file first to determine which models we need
  const configPath = path.join(__dirname, '.mcp.config.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath));
      const modelsInUse = new Set();
      
      // Add models from config
      if (config.agents && config.agents.builder && config.agents.builder.model) {
        modelsInUse.add(config.agents.builder.model);
      }
      if (config.agents && config.agents.judge && config.agents.judge.model) {
        modelsInUse.add(config.agents.judge.model);
      }
      
      // Check for each model's required vars
      modelsInUse.forEach(model => {
        if (requiredVars[model]) {
          requiredVars[model].forEach(varName => {
            if (!process.env[varName]) {
              missingVars.push({ model, varName });
            }
          });
        }
      });
    } catch (error) {
      console.error(`❌ Error reading or parsing config file: ${error.message}`);
    }
  } else {
    // If no config, check all possible models
    Object.entries(requiredVars).forEach(([model, vars]) => {
      vars.forEach(varName => {
        if (!process.env[varName]) {
          missingVars.push({ model, varName });
        }
      });
    });
  }
  
  // Report missing variables
  if (missingVars.length > 0) {
    console.error('❌ Missing required API keys:');
    const uniqueMissing = new Map();
    
    missingVars.forEach(({ model, varName }) => {
      if (!uniqueMissing.has(varName)) {
        uniqueMissing.set(varName, [model]);
      } else {
        uniqueMissing.get(varName).push(model);
      }
    });
    
    uniqueMissing.forEach((models, varName) => {
      console.error(`  - ${varName} (required for: ${models.join(', ')})`);
    });
    
    console.log('\nTo fix this:');
    console.log('1. Create a .env file in this directory with the following content:');
    uniqueMissing.forEach((_, varName) => {
      console.log(`   ${varName}=your_api_key_here`);
    });
    console.log('\n2. Or set environment variables before running:');
    uniqueMissing.forEach((_, varName) => {
      console.log(`   export ${varName}=your_api_key_here`);
    });
    
    return false;
  }
  
  return true;
}

// Check files and configurations
function checkFilesAndConfig() {
  const configPath = path.join(__dirname, '.mcp.config.json');
  const memoryPath = path.join(__dirname, 'memory/history.json');
  const missingFiles = [];
  
  if (!fs.existsSync(configPath)) {
    missingFiles.push('.mcp.config.json');
  }
  
  if (!fs.existsSync(memoryPath)) {
    // Create memory directory if it doesn't exist
    const memoryDir = path.join(__dirname, 'memory');
    if (!fs.existsSync(memoryDir)) {
      try {
        fs.mkdirSync(memoryDir, { recursive: true });
        console.log('✅ Created memory directory');
      } catch (error) {
        console.error(`❌ Failed to create memory directory: ${error.message}`);
        missingFiles.push('memory/');
      }
    }
    
    // Create empty history file
    try {
      fs.writeFileSync(memoryPath, JSON.stringify([], null, 2));
      console.log('✅ Created empty history.json file');
    } catch (error) {
      console.error(`❌ Failed to create history.json: ${error.message}`);
      missingFiles.push('memory/history.json');
    }
  }
  
  if (missingFiles.length > 0) {
    console.error(`❌ Missing required files: ${missingFiles.join(', ')}`);
    
    if (missingFiles.includes('.mcp.config.json')) {
      console.log('\nYou need to create a .mcp.config.json file with this structure:');
      console.log(`
{
  "agents": {
    "builder": {
      "model": "claude-3-sonnet",
      "persona": "Builder",
      "rolePrompt": "You are a helpful AI assistant that specializes in building websites."
    },
    "judge": {
      "model": "gpt-4o",
      "persona": "Judge",
      "rolePrompt": "You are a helpful AI assistant that provides constructive feedback."
    }
  }
}
`);
    }
    
    return false;
  }
  
  return true;
}

// Initialize agents with error handling
function initializeAgents() {
  const agents = {};
  
  try {
    if (process.env.OPENAI_API_KEY) {
      agents['gpt-4o'] = new ChatOpenAI({ 
        modelName: 'gpt-4o', 
        temperature: 0,
        openAIApiKey: process.env.OPENAI_API_KEY 
      });
    }
  } catch (error) {
    console.error(`❌ Failed to initialize OpenAI agent: ${error.message}`);
  }
  
  try {
    if (process.env.ANTHROPIC_API_KEY) {
      agents['claude-3-sonnet'] = new ChatAnthropic({ 
        modelName: 'claude-3-sonnet-20240229', 
        temperature: 0.3,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY
      });
    }
  } catch (error) {
    console.error(`❌ Failed to initialize Anthropic agent: ${error.message}`);
  }
  
  return agents;
}

// Main execution
async function main() {
  // Step 1: Validate environment variables
  if (!validateEnvVars()) {
    process.exit(1);
  }
  
  // Step 2: Check files and configuration
  if (!checkFilesAndConfig()) {
    process.exit(1);
  }
  
  // Now that validation passed, load config and history
  const configPath = path.join(__dirname, '.mcp.config.json');
  const memoryPath = path.join(__dirname, 'memory/history.json');
  
  const config = JSON.parse(fs.readFileSync(configPath));
  const history = JSON.parse(fs.readFileSync(memoryPath));
  
  // Initialize agents
  const agents = initializeAgents();
  
  // Validate that we have the required agents
  const requiredModels = [
    config.agents.builder.model,
    config.agents.judge.model
  ];
  
  const missingAgents = requiredModels.filter(model => !agents[model]);
  if (missingAgents.length > 0) {
    console.error(`❌ Missing required agent models: ${missingAgents.join(', ')}`);
    process.exit(1);
  }
  
  // Setup readline
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  // Chat function
  const chatWithAgent = async (agentConfig, input) => {
    const model = agents[agentConfig.model];
    const messages = [
      new SystemMessage(agentConfig.rolePrompt),
      ...history.map((h) =>
        h.role === 'user' ? new HumanMessage(h.content) : new AIMessage(h.content)
      ),
      new HumanMessage(input)
    ];
  
    try {
      const res = await model.invoke(messages);
      history.push({ role: 'assistant', content: res.content });
      fs.writeFileSync(memoryPath, JSON.stringify(history, null, 2));
      return res.content;
    } catch (error) {
      console.error(`❌ Error from ${agentConfig.model}: ${error.message}`);
      return `[Error from ${agentConfig.persona}: ${error.message}]`;
    }
  };
  
  // Delay function
  const delay = (ms) => new Promise(res => setTimeout(res, ms));
  
  console.log('🧠 MCP Conversation started.\n');
  if (history.length === 0) {
    const prompt = 'Let's build a website together. What's the best way to start?';
    history.push({ role: 'user', content: prompt });
  }

  // Main conversation loop
  while (true) {
    const builder = config.agents.builder;
    const judge = config.agents.judge;

    try {
      const builderReply = await chatWithAgent(builder, history[history.length - 1].content);
      console.log(`👷 ${builder.persona}: ${builderReply}\n`);

      await delay(500);

      const judgeReply = await chatWithAgent(judge, builderReply);
      console.log(`🧑‍⚖️ ${judge.persona}: ${judgeReply}\n`);
    } catch (error) {
      console.error(`❌ Error in conversation loop: ${error.message}`);
    }

    await new Promise((resolve) => {
      rl.question('💬 Your follow-up (or press Enter to continue): ', (input) => {
        if (input.trim()) {
          history.push({ role: 'user', content: input.trim() });
        }
        resolve();
      });
    });
  }
}

// Run the application
main().catch(error => {
  console.error(`❌ Fatal error: ${error.message}`);
  process.exit(1);
});
