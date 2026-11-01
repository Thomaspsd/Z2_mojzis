const RESTAURANTS = [
  {
    name: "FiitFood",
    localUrl: "source/MENU _ FreeFood.html",
    liveUrl: "http://www.freefood.sk/menu/#fiit-food",
    parse: parseFiitFood,
  },
  {
    name: "Eat & Meet",
    localUrl: "source/Eat & Meet - Študentská reštaurácia Staré Grunty - Átriaky, Blok AD-U.html",
    liveUrl: "https://eatandmeet.sk/tyzdenne-menu",
    parse: parseEatAndMeet,
  },
  {
    name: "Berg Restaurant",
    localUrl: "source/Berg restaurant, Bratislava V _ obedvmeste.sk.html",
    liveUrl: "https://obedvmeste.sk/berg_restaurant_bratislava",
    parse: parseBerg,
  },
];

async function loadRestaurantHtml(restaurant) {
  const response = await fetch(restaurant.localUrl);
  if (!response.ok) {
    throw new Error(`Stránku sa nepodarilo načítať (HTTP ${response.status}).`);
  }
  return response.text();
}

const statusText = document.querySelector(".status-message");
const refreshButton = document.querySelector(".refresh-button");
const clearButton = document.querySelector(".clear-button");
const tabs = document.querySelector(".day-tabs");
const schedule = document.querySelector(".schedule");
const restaurantFilters = document.querySelector(".restaurant-filters");

let program = [];
let selectedDay = getTodayIndex();

function renderTabs() {
  tabs.replaceChildren();
  DAY_NAMES.forEach((day, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = day;
    button.setAttribute("aria-pressed", index === selectedDay);
    button.addEventListener("click", () => {
      selectedDay = index;
      render();
    });
    tabs.append(button);
  });
  const weekButton = document.createElement("button");
  weekButton.type = "button";
  weekButton.textContent = "Celý týždeň";
  weekButton.setAttribute("aria-pressed", selectedDay === -1);
  weekButton.addEventListener("click", () => {
    selectedDay = -1;
    render();
  });
  tabs.append(weekButton);
}

function renderDay() {
  schedule.replaceChildren();
  for (const restaurant of program) {
    const visible = restaurantFilters.querySelectorAll("input:checked");
    let showRestaurant = false;
    for (const checkbox of visible) {
      if (checkbox.value === restaurant.name) {
        showRestaurant = true;
      }
    }
    if (!showRestaurant) {
      continue;
    }

    const card = document.createElement("section");
    card.className = "restaurant-card";
    schedule.append(card);
    const heading = document.createElement("h2");
    const link = document.createElement("a");
    link.textContent = restaurant.name;
    link.href = RESTAURANTS.find((source) => source.name === restaurant.name).liveUrl;
    heading.append(link);
    card.append(heading);

    const updated = document.createElement("p");
    updated.textContent = restaurant.updatedAt
      ? `Posledná aktualizácia: ${new Date(restaurant.updatedAt).toLocaleString("sk-SK")}.`
      : "Posledná aktualizácia: neuvedená.";
    card.append(updated);

    if (restaurant.state === "loading") {
      const loading = document.createElement("p");
      loading.textContent = "Načítavam menu…";
      card.append(loading);
      continue;
    }
    if (restaurant.state === "error") {
      const error = document.createElement("p");
      error.textContent = restaurant.error;
      card.append(error);
      const retry = document.createElement("button");
      retry.className = "retry-button";
      retry.textContent = "Skúsiť znova";
      $(retry).on("click", () => {
        const source = RESTAURANTS.find((source) => source.name === restaurant.name);
        retryRestaurant(source);
      });
      card.append(retry);
      continue;
    }
    for (let index = 0; index < DAY_NAMES.length; index++) {
      // Hodnota -1 znamená zobrazenie celého týždňa.
      if (selectedDay !== -1 && index !== selectedDay) {
        continue;
      }
      const day = restaurant.days.find((day) => day.day === DAY_NAMES[index]);
      const date = document.createElement("h3");
      let dateText = "dátum neuvedený";
      if (day && day.date) {
        dateText = day.date;
      }
      date.textContent = DAY_NAMES[index] + " · " + dateText;
      card.append(date);

      if (!day || day.items.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "Na tento deň nie je zverejnené menu.";
        card.append(empty);
        continue;
      }

      const list = document.createElement("ul");
      for (const meal of day.items) {
        const item = document.createElement("li");
        item.className = meal.type.toLowerCase().includes("polievka") ? "soup" : "main-course";
        if (restaurant.name === "Eat & Meet") {
          const category = meal.type.toLowerCase();
          if (category.includes("menu")) {
            item.className = "menu-meal";
          } else if (category === "sladké") {
            item.className = "sweet";
          } else if (category === "múčne") {
            item.className = "flour-based";
          } else if (category === "vegetariánske") {
            item.className = "vegetarian";
          } else if (category === "šalát") {
            item.className = "salad";
          }
          item.className += " category-meal";
        }
        const type = document.createElement("span");
        type.className = "meal-type";
        type.textContent = meal.type;
        const title = document.createElement("span");
        title.textContent = meal.title;
        const price = document.createElement("strong");
        price.className = "meal-price";
        price.textContent = meal.price === null ? "cena neuvedená" : `${meal.price.toFixed(2)} €`;
        if (meal.secondPrice !== null) {
          price.textContent += ` / ${meal.secondPrice.toFixed(2)} € (druhá cena zo stránky)`;
        }
        item.append(type, title, price);
        if (meal.weight || meal.allergens) {
          const details = document.createElement("small");
          details.className = "meal-details";
          details.textContent = meal.weight;
          if (meal.allergens) {
            details.textContent += `${meal.weight ? " · " : ""}Alergény: ${meal.allergens}`;
          }
          item.append(details);
        }
        list.append(item);
      }
      card.append(list);
    }
  }
  if (schedule.children.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "Nie je vybraná žiadna reštaurácia.";
    schedule.append(empty);
  }
}

function render() {
  renderTabs();
  renderDay();
}

function getTodayIndex() {
  const day = new Date().getDay();

  if (day === 0 || day === 6) {
    return 0;
  }

  return day - 1;
}

const STORAGE_KEY = "restaurant-menu";

function saveProgram(restaurants) {
  const successful = restaurants.filter((restaurant) => restaurant.state === "ok");
  // Pri neúspešnej aktualizácii zachováme dnešné úspešné dáta v cache.
  for (const restaurant of loadSavedProgram()) {
    if (!successful.some((item) => item.name === restaurant.name)) {
      successful.push(restaurant);
    }
  }
  const data = {
    version: 4,
    restaurants: successful,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadSavedProgram() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!data || data.version !== 4 || !Array.isArray(data.restaurants)) {
      return [];
    }
    return data.restaurants.filter((restaurant) => {
      const savedAt = new Date(restaurant.updatedAt);
      return restaurant.state === "ok"
        && savedAt.toDateString() === new Date().toDateString()
        && Array.isArray(restaurant.days);
    });
  } catch (error) {
    return [];
  }
}

async function loadOne(source) {
  const restaurant = program.find((restaurant) => restaurant.name === source.name);
  restaurant.state = "loading";
  restaurant.error = "";
  renderDay();
  try {
    const html = await loadRestaurantHtml(source);
    const doc = parseHtml(html);
    const days = source.parse(doc);

    const hasMeals = days.some((day) => day.items.length > 0);

    if (!hasMeals) {
      throw new Error("Na stránke sa nenašlo menu. Možno sa zmenila jej štruktúra.");
    }
    restaurant.days = days;
    restaurant.updatedAt = new Date().toISOString();
    restaurant.state = "ok";
  } catch (error) {
    restaurant.state = "error";
    if (error instanceof TypeError) {
      restaurant.error = "Zdroj menu sa nepodarilo načítať. Skontrolujte pripojenie a spustenie lokálneho servera.";
    } else {
      restaurant.error = error.message;
    }
    throw error;
  } finally {
    renderDay();
  }
}

async function retryRestaurant(source) {
  if (refreshButton.disabled) {
    return;
  }
  refreshButton.disabled = true;
  clearButton.disabled = true;
  statusText.textContent = "";
  try {
    await loadOne(source);
  } catch (error) {
    // Chyba je už zobrazená pri príslušnej reštaurácii.
  } finally {
    try {
      saveProgram(program);
    } catch (error) {
      statusText.textContent = "Menu sa nepodarilo uložiť do prehliadača.";
    }
    refreshButton.disabled = false;
    clearButton.disabled = false;
  }
}

// nacitanie menu tie co nemaju platne data z dneska
async function showProgram(forceRefresh = false) {
  if (refreshButton.disabled) {
    return;
  }
  const saved = forceRefresh ? [] : loadSavedProgram();
  const previous = program;
  program = RESTAURANTS.map((source) => {
    const stored = saved.find((restaurant) => restaurant.name === source.name);
    if (stored) {
      return stored;
    }
    const old = previous.find((restaurant) => restaurant.name === source.name);
    return {
      name: source.name,
      days: old?.days ?? [],
      updatedAt: old?.updatedAt ?? null,
      state: "loading",
      error: "",
    };
  });
  const pending = RESTAURANTS.filter((source) => {
    return program.find((restaurant) => restaurant.name === source.name).state !== "ok";
  });
  render();
  if (pending.length === 0) {
    statusText.textContent = "";
    return;
  }

  refreshButton.disabled = true;
  clearButton.disabled = true;
  statusText.textContent = "Načítavam menu…";
  try {
    const outcomes = await Promise.allSettled(pending.map(loadOne));
    const failed = outcomes.filter((outcome) => outcome.status === "rejected").length;
    statusText.textContent = failed
      ? "Niektoré menu sa nepodarilo načítať. Podrobnosti sú pri reštaurácii."
      : `Menu aktualizované ${new Date().toLocaleString("sk-SK")}.`;
    try {
      saveProgram(program);
    } catch (error) {
      statusText.textContent += " Menu sa nepodarilo uložiť do prehliadača.";
    }
  } finally {
    refreshButton.disabled = false;
    clearButton.disabled = false;
  }
}

$(refreshButton).on("click", () => showProgram(true));

$(clearButton).on("click", () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    statusText.textContent = "Uložené dáta sú vymazané.";
  } catch (error) {
    statusText.textContent = "Uložené dáta sa nepodarilo vymazať.";
  }
});

for (const restaurant of RESTAURANTS) {
  const label = document.createElement("label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = restaurant.name;
  checkbox.checked = true;
  $(checkbox).on("change", () => render());
  label.append(checkbox, restaurant.name);
  restaurantFilters.append(label);
}

showProgram();
