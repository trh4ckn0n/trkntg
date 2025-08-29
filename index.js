const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');
const app = express();
// ---- CONFIG AVEC VARIABLES D'ENVIRONNEMENT ----
const TOKEN = process.env.TOKEN;
const GITHUB_USER = process.env.GITHUB_USER;
const GROUP_CHAT = process.env.GROUP_CHAT;
const FACEBOOK_GROUP = process.env.FACEBOOK_GROUP;
const POLLING_INTERVAL = 5 * 60 * 1000; // 5 min
const PER_PAGE = 10;
const PORT = process.env.PORT || 3000;

// ---- INIT BOT ----
const bot = new TelegramBot(TOKEN, { polling: true });

// ---- STOCKAGE DES REPOS EXISTANTS ----
let knownRepos = new Set();

async function fetchRepos() {
  try {
    const response = await axios.get(`https://api.github.com/users/${GITHUB_USER}/repos?sort=created&per_page=100`, {
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`
      }
    });
    return response.data;
  } catch (err) {
    console.error("Erreur GitHub :", err.message);
    return [];
  }
}

// ---- INITIALISATION DES REPOS CONNUS ----
(async () => {
  const repos = await fetchRepos();
  repos.forEach(repo => knownRepos.add(repo.id));
})();

// ---- AUTO POST DES NOUVEAUX REPOS ----
const checkNewRepos = async () => {
  const repos = await fetchRepos();
  for (let repo of repos) {
    if (!knownRepos.has(repo.id)) {
      const message = `
🚀 Nouveau repo GitHub détecté !\n
• [${repo.name}](${repo.html_url}) - ⭐ ${repo.stargazers_count}
Description : ${repo.description || "Aucune description"}
Date de création : ${new Date(repo.created_at).toLocaleString()}
      `;
      bot.sendMessage(GROUP_CHAT, message, { parse_mode: 'Markdown', disable_web_page_preview: false });
      knownRepos.add(repo.id);
    }
  }
};

// ---- MESSAGE DE BIENVENUE AVEC BOUTONS ----
bot.on('new_chat_members', async (msg) => {
  const newMembers = msg.new_chat_members;
  for (let member of newMembers) {
    const name = member.first_name || "Nouveau membre";
    const welcomeMessage = `
👋 Salut ${name} ! Bienvenue sur *${msg.chat.title}* !

💻 Ici, on partage :
- Astuces hacking éthique 🔒
- Développement & scripts 💾
- Challenges et projets open-source 🚀

📌 Petit conseil : présente-toi et explore nos ressources !
    `;

    const buttons = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Repos GitHub", url: `https://github.com/${GITHUB_USER}` }],
          [{ text: "Groupe Facebook", url: FACEBOOK_GROUP }]
        ]
      },
      parse_mode: 'Markdown'
    };

    bot.sendMessage(msg.chat.id, welcomeMessage, buttons);
  }
});

// ---- COMMANDE /REPOS AVEC PAGINATION ----
bot.onText(/\/repos(?: (\d+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const page = match[1] ? parseInt(match[1]) : 1;
  const repos = await fetchRepos();
  const start = (page - 1) * PER_PAGE;
  const end = start + PER_PAGE;
  const pageRepos = repos.slice(start, end);

  if (!pageRepos.length) return bot.sendMessage(chatId, "Pas de repos sur cette page.");

  let message = `📦 Repos GitHub de *${GITHUB_USER}* (page ${page}) :\n\n`;
  pageRepos.forEach(repo => {
    message += `• [${repo.name}](${repo.html_url}) - ⭐ ${repo.stargazers_count}\n`;
  });

  const buttons = {
    reply_markup: { inline_keyboard: [] },
    parse_mode: 'Markdown',
    disable_web_page_preview: false
  };

  if (end < repos.length) {
    buttons.reply_markup.inline_keyboard.push([{ text: "➡ Page suivante", callback_data: `repos_${page + 1}` }]);
  }

  bot.sendMessage(chatId, message, buttons);
});

// ---- GESTION DES BOUTONS CALLBACK ----
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;

  if (data.startsWith("repos_")) {
    const page = parseInt(data.split("_")[1]);
    const repos = await fetchRepos();
    const start = (page - 1) * PER_PAGE;
    const end = start + PER_PAGE;
    const pageRepos = repos.slice(start, end);

    let message = `📦 Repos GitHub de *${GITHUB_USER}* (page ${page}) :\n\n`;
    pageRepos.forEach(repo => {
      message += `• [${repo.name}](${repo.html_url}) - ⭐ ${repo.stargazers_count}\n`;
    });

    const buttons = {
      reply_markup: { inline_keyboard: [] },
      parse_mode: 'Markdown',
      disable_web_page_preview: false
    };

    if (end < repos.length) {
      buttons.reply_markup.inline_keyboard.push([{ text: "➡ Page suivante", callback_data: `repos_${page + 1}` }]);
    }

    bot.editMessageText(message, { chat_id: msg.chat.id, message_id: msg.message_id, ...buttons });
  }
});

// ---- COMMANDE /HELP ----
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
💡 Commandes disponibles :
/repos [page] - Voir les repos GitHub
/help  - Afficher ce message
/info  - Infos sur le groupe et le bot
/links - some links of trhacknon's accounts
  `;
  const buttons = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Repos GitHub", url: `https://github.com/${GITHUB_USER}` }],
        [{ text: "Groupe Facebook", url: FACEBOOK_GROUP }]
      ]
    },
    parse_mode: 'Markdown'
  };
  bot.sendMessage(chatId, helpMessage, buttons);
});

// ---- COMMANDE /INFO ----
bot.onText(/\/info/, (msg) => {
  const chatId = msg.chat.id;
  const infoMessage = `
🤖 Bot créé pour automatiser :
- Messages de bienvenue avec boutons
- Notification immédiate des nouveaux repos GitHub
- Commandes interactives avec pagination
- Astuces pour nouveaux membres
  `;
  const buttons = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Repos GitHub", url: `https://github.com/${GITHUB_USER}` }],
        [{ text: "Groupe Facebook", url: FACEBOOK_GROUP }]
      ]
    },
    parse_mode: 'Markdown'
  };
  bot.sendMessage(chatId, infoMessage, buttons);
});

// ---- COMMANDE /LINKS ----
bot.onText(/\/links/, (msg) => {
  const chatId = msg.chat.id;

  const message = `
🔗 Voici tous mes liens utiles :

• Groupe Facebook : [Lien Facebook](${process.env.FACEBOOK_GROUP})
• Groupe Telegram : [Lien Telegram](https://t.me/trknpub)
• GitHub : [Mes repos GitHub](https://github.com/trh4ckn0n?tab=repositories)
• Streamlit : [Mes projets Streamlit](https://share.streamlit.io/user/trh4ckn0n)
  `;

  const buttons = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Groupe Facebook", url: process.env.FACEBOOK_GROUP }],
        [{ text: "Groupe Telegram", url: "https://t.me/trknpub" }],
        [{ text: "GitHub", url: "https://github.com/trh4ckn0n?tab=repositories" }],
        [{ text: "Streamlit", url: "https://share.streamlit.io/user/trh4ckn0n" }],
      ]
    },
    parse_mode: 'Markdown',
    disable_web_page_preview: false
  };

  bot.sendMessage(chatId, message, buttons);
});

// ---- POLLING GITHUB ----
setInterval(checkNewRepos, POLLING_INTERVAL);

console.log("🤖 Bot Telegram trh4ckn0n ultra abouti actif !");
app.get('/', (req, res) => res.send('🤖 Bot Telegram actif !'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
