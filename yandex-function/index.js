/* Кладовая — ИИ-помощник. Функция для Yandex Cloud Functions (Node.js).
   Точка входа: index.handler
   Переменные окружения:
     FOLDER_ID     — ID каталога Yandex Cloud
     SUPABASE_URL  — адрес Supabase-проекта «Кладовой»
     SUPABASE_KEY  — его Publishable key
     MODEL         — необязательно, по умолчанию yandexgpt/latest (можно yandexgpt-lite/latest — дешевле)
   У функции должен быть сервисный аккаунт с ролями ai.languageModels.user и ai.vision.user (для фото). */

const LLM_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";
const OCR_URL = "https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText";
const CORS = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Supabase-Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400"
};
const reply = (code, obj) => ({ statusCode: code, headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, CORS), body: JSON.stringify(obj) });
const str = (v, n) => String(v == null ? "" : v).slice(0, n);

module.exports.handler = async function (event, context) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return reply(405, { error: "Нужен POST-запрос" });

  // 1. Отвечаем только тем, кто вошёл в «Кладовую»
  const headers = {};
  Object.keys(event.headers || {}).forEach((k) => { headers[k.toLowerCase()] = event.headers[k]; });
  const auth = headers["x-supabase-authorization"] || headers.authorization || "";
  if (!/^Bearer\s+\S+/.test(auth)) return reply(401, { error: "Нужно войти в приложении (☁︎)" });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY || !process.env.FOLDER_ID) return reply(500, { error: "В функции не заданы переменные FOLDER_ID, SUPABASE_URL, SUPABASE_KEY" });
  try {
    const r = await fetch(process.env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", { headers: { apikey: process.env.SUPABASE_KEY, Authorization: auth } });
    if (!r.ok) return reply(401, { error: "Вход устарел — выйди и войди снова в ☁︎" });
  } catch (e) {
    return reply(502, { error: "Не удалось проверить вход: " + e.message });
  }

  // 2. Разбираем запрос
  let body;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : event.body;
    body = JSON.parse(raw || "{}");
  } catch (e) {
    return reply(400, { error: "Некорректный запрос" });
  }
  const iam0 = context && context.token && context.token.access_token;
  let messages, temperature;
  if (body.task === "photo") {
    // Фото: сначала читаем надписи (Vision OCR), потом YandexGPT разбирает, что за продукты
    const img = String(body.image || "");
    if (!img || img.length > 5000000) return reply(400, { error: "Фото не пришло или слишком большое" });
    if (!iam0) return reply(500, { error: "У функции не указан сервисный аккаунт" });
    let ocrText = "";
    try {
      const o = await fetch(OCR_URL, { method: "POST", headers: { Authorization: "Bearer " + iam0, "x-folder-id": process.env.FOLDER_ID, "Content-Type": "application/json" }, body: JSON.stringify({ mimeType: "JPEG", languageCodes: ["ru", "en"], model: "page", content: img }) });
      const oj = await o.json().catch(() => null);
      if (!o.ok) return reply(502, { error: "Распознавание текста: " + ((oj && (oj.message || (oj.error && oj.error.message))) || o.status) + (o.status === 403 ? " — добавь сервисному аккаунту роль ai.vision.user" : "") });
      ocrText = (oj && oj.result && oj.result.textAnnotation && oj.result.textAnnotation.fullText) || "";
    } catch (e) { return reply(502, { error: "Распознавание текста недоступно: " + e.message }); }
    if (!ocrText.trim()) return reply(200, { ok: true, data: { items: [] }, note: "На фото не нашлось надписей" });
    messages = photoPrompt(body, ocrText); temperature = 0.2;
  }
  else if (body.task === "product") { messages = productPrompt(body); temperature = 0.2; }
  else if (body.task === "recipe") { messages = recipePrompt(body); temperature = 0.6; }
  else return reply(400, { error: "Неизвестная задача" });

  // 3. Спрашиваем YandexGPT от имени сервисного аккаунта функции
  const iam = iam0;
  if (!iam) return reply(500, { error: "У функции не указан сервисный аккаунт" });
  const model = process.env.MODEL || "yandexgpt/latest";
  let res, j;
  try {
    res = await fetch(LLM_URL, {
      method: "POST",
      headers: { Authorization: "Bearer " + iam, "x-folder-id": process.env.FOLDER_ID, "Content-Type": "application/json" },
      body: JSON.stringify({ modelUri: "gpt://" + process.env.FOLDER_ID + "/" + model, completionOptions: { stream: false, temperature: temperature, maxTokens: "3000" }, messages: messages })
    });
    j = await res.json().catch(() => null);
  } catch (e) {
    return reply(502, { error: "YandexGPT недоступен: " + e.message });
  }
  if (!res.ok) return reply(502, { error: "YandexGPT: " + ((j && j.error && (j.error.message || j.error.details)) || (j && j.message) || res.status) });
  const text = j && j.result && j.result.alternatives && j.result.alternatives[0] && j.result.alternatives[0].message && j.result.alternatives[0].message.text;
  const data = extractJSON(text || "");
  if (!data) return reply(502, { error: "ИИ ответил не в том формате, попробуй ещё раз", raw: str(text, 400) });
  return reply(200, { ok: true, data: data, usage: j.result.usage || null });
};

function extractJSON(t) {
  t = t.replace(/```(?:json)?/gi, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
}

function productPrompt(b) {
  const known = (Array.isArray(b.known) ? b.known : []).slice(0, 200).map((k) => str(k[0], 30) + " — " + str(k[1], 60)).join("\n");
  return [
    { role: "system", text: "Ты помощник кухонного приложения. Отвечаешь ТОЛЬКО одним JSON-объектом, без пояснений и без markdown." },
    { role: "user", text:
      "Продукт, который пользователь положил в холодильник или кладовку: «" + str(b.name, 80) + "».\n\n" +
      "Если это по сути то же самое, что один из продуктов справочника ниже (например, «куриный бульон» ≈ «Бульон», «сливки 20%» ≈ «Сливки 10%»), укажи его код в поле same. Иначе same = null.\n\n" +
      "Справочник (код — название):\n" + known + "\n\n" +
      "Верни JSON строго такого вида:\n" +
      "{\"same\": \"код или null\", \"n\": \"короткое название с большой буквы\", " +
      "\"t\": \"тара: jar | bottle | carton | pot | tub | bag | block | can | count\", " +
      "\"cell\": \"если t=count — форма штуки: round | stick | egg | tub\", \"n0\": \"сколько штук обычно в покупке, число\", " +
      "\"place\": \"где хранить: fridge | door | freezer | pantry\", \"s\": \"сколько дней хранится там, число\", " +
      "\"cat\": \"отдел магазина: veg | dairy | protein | grocery | nuts | sauce | frozen | other\", \"c\": \"цвет продукта #RRGGBB\", " +
      "\"k\": ккал, \"p\": белок, \"f\": жиры, \"cb\": углеводы — на 100 г в готовом к еде виде, числа, " +
      "\"slot\": \"роль в салате или боуле: base | greens | protein | veg | crunch | sauce | accent | null\", \"g\": типичная порция в граммах, " +
      "\"ts\": {\"salt\": 0-2, \"sour\": 0-2, \"sweet\": 0-2, \"umami\": 0-2, \"fat\": 0-2, \"crunch\": 0-2}, " +
      "\"prep\": {\"order\": 1-5 (1 — готовится дольше всего), \"text\": \"как подготовить, с G вместо граммов, или пусто\", \"device\": \"например «Аэрогриль · 190 °C · 15 мин» или пусто\", \"tip\": \"короткий совет или пусто\"}, " +
      "\"note\": \"одно короткое предложение о хранении\"}\n" +
      "Тара: jar — банка, bottle — бутылка, carton — тетрапак, pot — кастрюля, tub — контейнер, bag — пакет, block — брусок (масло, сыр, тофу, рыба), can — консервы, count — поштучно." }
  ];
}

function photoPrompt(b, text) {
  const known = (Array.isArray(b.known) ? b.known : []).slice(0, 220).map((k) => str(k[0], 30) + " — " + str(k[1], 60)).join("\n");
  return [
    { role: "system", text: "Ты помощник кухонного приложения. Отвечаешь ТОЛЬКО одним JSON-объектом, без пояснений и без markdown." },
    { role: "user", text:
      "Ниже текст, распознанный с фотографии продуктов (одна упаковка или целая полка). Текст может быть с ошибками и перемешан.\n---\n" + str(text, 6000) + "\n---\n" +
      "Найди все продукты питания. Не выдумывай то, чего нет в тексте; рекламные слова и составы не считаются продуктами. Если одинаковых упаковок несколько, укажи count. " +
      "Если на упаковке видна дата «годен до» или «употребить до» — переведи её в формат ГГГГ-ММ-ДД; если видна только дата изготовления и срок хранения — посчитай. Иначе exp = null.\n\n" +
      "Справочник (код — название), для поля same:\n" + known + "\n\n" +
      "Верни JSON: {\"items\": [{\"name\": \"короткое понятное название, например «Творог 5%» или «Молоко 2,5%»\", \"same\": \"код похожего продукта из справочника или null\", " +
      "\"count\": число упаковок, \"pk\": вес или объём одной упаковки числом или null, \"u\": \"г | мл | шт\", \"exp\": \"ГГГГ-ММ-ДД или null\", " +
      "\"t\": \"jar | bottle | carton | pot | tub | bag | block | can | count\", \"place\": \"fridge | door | freezer | pantry\", \"s\": дней хранения числом, " +
      "\"cat\": \"veg | dairy | protein | grocery | nuts | sauce | frozen | other\", \"c\": \"#RRGGBB\", \"k\": ккал, \"p\": белок, \"f\": жиры, \"cb\": углеводы на 100 г, " +
      "\"slot\": \"base | greens | protein | veg | crunch | sauce | accent | null\", \"g\": типичная порция в граммах}]}" }
  ];
}

function recipePrompt(b) {
  const stock = (Array.isArray(b.stock) ? b.stock : []).slice(0, 150).map((s) => "- " + (s[0] ? "[" + str(s[0], 30) + "] " : "") + str(s[1], 60) + " (" + ({ fresh: "свежее", soon: "съесть за 2–3 дня", urgent: "пора доесть", unknown: "срок не указан" }[s[2]] || "") + "; осталось " + str(s[3], 20) + "; " + str(s[4], 10) + ")").join("\n");
  const codes = (Array.isArray(b.codes) ? b.codes : []).slice(0, 200).map((c) => str(c[0], 30) + " — " + str(c[1], 60)).join("; ");
  const list = (a) => (Array.isArray(a) ? a : []).slice(0, 20).map((x) => str(x, 90)).join("; ") || "—";
  const ideas = b.mode === "ideas";
  return [
    { role: "system", text: "Ты шеф-повар домашней кухни и помощник по питанию. Придумываешь вкусные блюда ресторанного уровня из обычных продуктов. Пишешь по-русски, конкретно, с граммами, температурами и временем. Отвечаешь ТОЛЬКО одним JSON-объектом, без пояснений и без markdown." },
    { role: "user", text:
      "Предпочтения и ограничения (соблюдай строго):\n" + str(b.prefs, 2000) + "\n\n" +
      "Что сейчас есть дома (в квадратных скобках — код продукта):\n" + (stock || "— ничего не отмечено") + "\n\n" +
      "Соль, сахар, растительное и оливковое масло, кукурузный крахмал, вода, сушёный чеснок и обычные специи БЕЗ перца считай всегда доступными.\n" +
      (ideas ? "Можно добавить 1–3 продукта, которых нет дома, если они сильно улучшат блюдо.\n" : "Используй ТОЛЬКО то, что есть дома, и всегда доступные продукты. Ничего не докупать.\n") +
      "В первую очередь используй продукты с пометкой «пора доесть» и «съесть за 2–3 дня».\n" +
      "Недавно ела (не повторяй): " + list(b.recent) + ".\nОчень понравилось: " + list(b.loved) + ".\nНе понравилось: " + list(b.disliked) + ".\nНе предлагай снова: " + list(b.avoid) + ".\n" +
      "Пожелание: " + (str(b.wish, 300) || "нет") + ".\n\n" +
      "Сделай блюдо сбалансированным: соль, кислинка, сладость, жирность, умами и контраст текстур (мягкое + хрустящее). Для аэрогриля указывай температуру, время, нужно ли переворачивать и готовить партиями.\n\n" +
      "Коды справочника для поля d: " + codes + "\n\n" +
      "Верни JSON строго такого вида:\n" +
      "{\"name\": \"название\", \"time\": минуты числом, \"serv\": \"1 порция\", \"kcal\": ккал на порцию числом, \"p\": белок на порцию в граммах числом, " +
      "\"note\": \"1–2 предложения: почему это вкусно, какой баланс вкусов\", " +
      "\"ings\": [{\"n\": \"ингредиент\", \"q\": \"количество для человека, например 150 г или 1 ст. л.\", \"d\": \"код из справочника или null\", \"g\": граммы числом или null}], " +
      "\"steps\": [{\"text\": \"шаг\", \"device\": \"например «Аэрогриль · 190 °C · 20 мин · встряхнуть» или пусто\", \"tip\": \"короткий совет: как добиться хруста, почему так, или пусто\"}]}" }
  ];
}
