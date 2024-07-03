import { scrapeTable, Result } from "./scrape";
import cron from "node-cron";

const TELEGRAM_BOT_TOKEN = Bun.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = Bun.env.TELEGRAM_CHAT_ID;

let messageId: number | null = null;
let lastMessage: string | null = null;

async function sendTelegramMessage(message: string): Promise<void> {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    });

    if (response.ok) {
      const data = await response.json();
      messageId = data.result.message_id;
      lastMessage = message;
    } else {
      console.error("Failed to send message:", await response.text());
    }
  } catch (error) {
    console.error("Error [sendTelegramMessage]:", error);
  }
}

async function editTelegramMessage(message: string): Promise<void> {
  try {
    if (messageId === null) return;

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        message_id: messageId,
        text: message,
        parse_mode: "HTML",
      }),
    });

    if (response.ok) {
      lastMessage = message;
    } else {
      const errorData = await response.json();
      console.error("Failed to edit message:", errorData);

      // (MESSAGE_EDIT_TIME_EXPIRED)
      if (errorData.error_code === 400) {
        await sendTelegramMessage(message);
      }
    }
  } catch (error) {
    console.error("Error [editTelegramMessage]:", error);
  }
}

const formatTime = (date: Date): string => {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};

function formatMessage(data: Result): string {
  return `<u>${
    data.date
  }</u> очікуються відключення електропостачання:\n<b>${data.firstQueueTimes.join(
    ", "
  )}</b>\n\n<u>${
    data.nextDate
  }</u> очікуються відключення електропостачання:\n<b>${data.nextQueueTimes.join(
    ", "
  )}</b>\n\n<i>Оновлено: ${data.updatedTime} (${formatTime(new Date())})</i>`;
}

async function checkAndUpdate(): Promise<void> {
  try {
    const data = await scrapeTable();
    if (data) {
      const message = formatMessage(data);
      if (lastMessage === message) {
        console.log("Message has not changed, not sending update.");
        return;
      }
      if (messageId === null) {
        await sendTelegramMessage(message);
      } else {
        await editTelegramMessage(message);
      }
    } else {
      console.log("Retrying in 5 minutes...");
      setTimeout(checkAndUpdate, 5 * 60 * 1000); // Повторна спроба через 5 хвилин
    }
  } catch (error) {
    console.error("Error scraping the table:", error);
    console.log("Retrying in 5 minutes...");
    setTimeout(checkAndUpdate, 5 * 60 * 1000); // Повторна спроба через 5 хвилин
  }
}

cron.schedule("*/30 * * * *", checkAndUpdate); // Запуск кожні 30 хвилин

checkAndUpdate(); // Виклик при запуску
