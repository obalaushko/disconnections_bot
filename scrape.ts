import axios from "axios";
import * as cheerio from "cheerio";

export interface Result {
  date: string;
  firstQueueTimes: string[];
  updatedTime: string | null;
  nextDate: string;
  nextQueueTimes: string[];
}

export async function scrapeTable(): Promise<Result | null> {
  try {
    const { data } = await axios.get("https://www.roe.vsei.ua/disconnections", {
      timeout: 60000,
    });
    const $ = cheerio.load(data);

    const table = $("table");
    const firstRow = table.find("tr").eq(3);
    const date: string = firstRow.find("td").eq(0).text().trim();
    const nextRow = table.find("tr").eq(4); // Наступний рядок

    const cleanTimeString = (time: string): string => {
      return time
        .replace(/[^\d.:,-]/g, "")
        .replace(/,\s*$/, "")
        .trim();
    };

    const getQueueTimes = (
      row: cheerio.Cheerio<cheerio.Element>,
      queueNumber: number
    ): string[] => {
      const queueCellIndex = queueNumber;
      const queueTimesHtml = row.find("td").eq(queueCellIndex).html();
      if (!queueTimesHtml) {
        return [];
      }
      return queueTimesHtml
        .split("<p>")
        .map((item) => cleanTimeString(item.replace(/<\/?p>/g, "").trim()))
        .filter((item) => item.length > 0);
    };

    const firstQueueTimes: string[] = getQueueTimes(firstRow, 1);
    const nextDate: string = nextRow.find("td").eq(0).text().trim();
    const nextQueueTimes: string[] = nextRow
      .find("td")
      .eq(1)
      .text()
      .includes("Очікується")
      ? ["Очікується"]
      : getQueueTimes(nextRow, 1);

    const updatedText = $("body")
      .text()
      .match(/Оновлено: \d{2}.\d{2}.\d{4} \d{2}:\d{2}/);
    const updatedTime: string | null = updatedText
      ? updatedText[0].replace("Оновлено: ", "")
      : null;

    return {
      date,
      firstQueueTimes,
      nextDate,
      nextQueueTimes,
      updatedTime,
    };
  } catch (error) {
    console.error("Error:", error.message);
    return null;
  }
}
