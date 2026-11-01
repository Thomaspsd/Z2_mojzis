function parseHtml(html) {
  return new DOMParser().parseFromString(html, "text/html");
}

function cleanText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function parsePrice(text) {
  if (!text) {
    return null;
  }
  const price = parseFloat(text.replace(",", "."));
  return Number.isNaN(price) ? null : price;
}

function textOf(element, selector) {
  const found = element.querySelector(selector);
  if (found === null) {
    return "";
  }
  return cleanText(found.textContent);
}

function parseFiitFood(doc) {
  const days = [];
  for (const section of doc.querySelectorAll("#fiit-food .daily-offer > li")) {
    const heading = textOf(section, ".day-title").split(",");
    const day = DAY_NAMES.find((name) => name.toLowerCase() === cleanText(heading[0]));
    if (!day) {
      continue;
    }
    const items = [];
    for (const meal of section.querySelectorAll(".day-offer > li")) {
      const label = textOf(meal, ".brand");
      const priceText = textOf(meal, ".price");
      let title = cleanText(meal.textContent).replace(label, "").replace(priceText, "");
      const allergens = title.match(/A:\s*([\d, ]*)/);
      if (allergens) {
        title = title.replace(allergens[0], "");
      }
      const weight = title.match(/\b\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l)(?:\s*,\s*\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l))*\b/);
      if (weight) {
        title = title.replace(weight[0], "");
      }
      title = cleanText(title);
      if (!title) {
        continue;
      }
      items.push({
        type: label === "P." ? "Polievka" : "Hlavné jedlo",
        title,
        price: parsePrice(priceText),
        secondPrice: null,
        allergens: allergens ? cleanText(allergens[1]) : "",
        weight: weight ? weight[0] : "",
      });
    }
    days.push({ day, date: cleanText(heading[1] ?? ""), items });
  }
  return days;
}

function parseEatAndMeet(doc) {
  const days = [];
  for (let index = 0; index < DAY_NAMES.length; index++) {
    const section = doc.querySelector(`#day-${index + 1}`);
    if (!section) {
      continue;
    }
    const items = [];
    for (const meal of section.querySelectorAll(".menu-body")) {
      const allergens = textOf(meal, ".desc span");
      const title = cleanText(textOf(meal, ".desc").replace(allergens, ""));
      if (!title) {
        continue;
      }
      const prices = textOf(meal, ".price").split("/");
      items.push({
        type: textOf(meal, "h4"),
        title,
        price: parsePrice(prices[0]),
        secondPrice: parsePrice(prices[1]),
        allergens: allergens.replace(/[()]/g, ""),
        weight: "",
      });
    }
    days.push({ day: DAY_NAMES[index], date: "", items });
  }
  return days;
}

function parseBerg(doc) {
  const days = [];
  for (const section of doc.querySelectorAll("#menu .daily-menu")) {
    const heading = cleanText(section.previousElementSibling?.textContent ?? "");
    const date = heading.match(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/);
    if (!date) {
      continue;
    }
    const parts = date[0].split(".");
    const dayIndex = (new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getDay() + 6) % 7;
    const items = [];
    for (const meal of section.querySelectorAll("dl")) {
      let title = textOf(meal, "dt");
      if (!title) {
        continue;
      }
      const weight = title.match(/^\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l)\b/);
      const allergens = title.match(/\(([\d,\s]+)\)\s*$/);
      if (weight) {
        title = title.replace(weight[0], "");
      }
      if (allergens) {
        title = title.replace(allergens[0], "");
      }
      items.push({
        type: weight && weight[0].includes("l") ? "Polievka" : "Hlavné jedlo",
        title: cleanText(title),
        price: parsePrice(textOf(meal, "dd")),
        secondPrice: null,
        allergens: allergens ? cleanText(allergens[1]) : "",
        weight: weight ? weight[0] : "",
      });
    }
    days.push({ day: DAY_NAMES[dayIndex], date: date[0], items });
  }
  return days;
}

const DAY_NAMES = ["Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota", "Nedeľa"];

