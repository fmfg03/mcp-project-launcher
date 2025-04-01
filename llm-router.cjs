require('dotenv').config({ path: './.env' });

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { ChatOpenAI } = require('@langchain/openai');
const { ChatAnthropic } = require('@langchain/anthropic');

// Force-load env BEFORE anything else
require('dotenv').config({ path: path.join(__dirname, '.env') });
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY?.trim();

console.log("🔐 ANTHROPIC_API_KEY:", process.env.ANTHROPIC_API_KEY);

// TEMP: Force-load API key manually
process.env.ANTHROPIC_API_KEY = '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'; // <-- insert full working key here


const { HumanMessage, AIMessage, SystemMessage } = require('@langchain/core/messages');

const configPath = path.join(__dirname, '.mcp.config.json');
const memoryPath = path.join(__dirname, 'memory/history.json');

if (!fs.existsSync(configPath) || !fs.existsSync(memoryPath)) {
  console.error('❌ Missing .mcp.config.json or memory/history.json');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath));
const history = JSON.parse(fs.readFileSync(memoryPath));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const agents = {
  'chatgpt': new ChatOpenAI({ modelName: 'gpt-4o', temperature: 0 }),
  'claude-3-sonnet': new ChatAnthropic({ modelName: 'claude-3-sonnet-20240229', temperature: 0.3 })
};

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function chatWithAgent(agentConfig, input) {
  const model = agents[agentConfig.model];
  const messages = [
    new SystemMessage(agentConfig.rolePrompt),
    ...history.map((h) =>
      h.role === 'user' ? new HumanMessage(h.content) : new AIMessage(h.content)
    ),
    new HumanMessage(input)
  ];

  const res = await model.invoke(messages);
  history.push({ role: 'assistant', content: res.content });
  fs.writeFileSync(memoryPath, JSON.stringify(history, null, 2));
  return res.content;
}

async function main() {
  console.log('🧠 MCP Conversation started.\n');
  if (history.length === 0) {
    const prompt = 'Let’s build a website together. What’s the best way to start?';
    history.push({ role: 'user', content: prompt });
  }

  while (true) {
    const builder = config.agents.builder;
    const judge = config.agents.judge;

    const builderReply = await chatWithAgent(builder, history[history.length - 1].content);
    console.log(`👷 ${builder.persona}: ${builderReply}\n`);

    await delay(500); // small pause between turns

    const judgeReply = await chatWithAgent(judge, builderReply);
    console.log(`🧑‍⚖️ ${judge.persona}: ${judgeReply}\n`);

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

main();
