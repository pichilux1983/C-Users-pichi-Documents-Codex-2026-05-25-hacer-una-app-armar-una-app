const STORAGE_KEY = "ahorroInteligente.users.v1";
const SUPABASE_URL = "https://dguwomfkyxwazjuvnvvi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRndXdvbWZreXh3YXpqdXZudnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3Mjg0OTAsImV4cCI6MjA5NTMwNDQ5MH0.QqHKQfosLN8xVdYV_Vt8k25LXkegTHJoFwE3WadxAfE";
const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const $ = (id) => document.getElementById(id);
const now = new Date();
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let currentAuthUserId = null;
let aiNudge = 0;

const state = {
  users: loadUsers(),
};

const defaultUserData = (username) => ({
  password: "",
  profileName: username,
  goals: [],
  months: {},
});

const els = {
  authView: $("authView"),
  appView: $("appView"),
  loginForm: $("loginForm"),
  loginUser: $("loginUser"),
  loginPass: $("loginPass"),
  loginHint: $("loginHint"),
  welcomeTitle: $("welcomeTitle"),
  logoutBtn: $("logoutBtn"),
  saveStatus: $("saveStatus"),
  monthInput: $("monthInput"),
  profileName: $("profileName"),
  goalName: $("goalName"),
  goalTarget: $("goalTarget"),
  goalEnd: $("goalEnd"),
  addGoalBtn: $("addGoalBtn"),
  overviewDate: $("overviewDate"),
  overviewSaved: $("overviewSaved"),
  overviewTarget: $("overviewTarget"),
  overviewRemaining: $("overviewRemaining"),
  overviewRequired: $("overviewRequired"),
  overviewProgressFill: $("overviewProgressFill"),
  overviewProjection: $("overviewProjection"),
  overviewGoals: $("overviewGoals"),
  incomeInput: $("incomeInput"),
  fixedInput: $("fixedInput"),
  applyFixedForwardBtn: $("applyFixedForwardBtn"),
  fixedBaseHint: $("fixedBaseHint"),
  fixedExpenseName: $("fixedExpenseName"),
  fixedExpenseAmount: $("fixedExpenseAmount"),
  addFixedExpenseBtn: $("addFixedExpenseBtn"),
  fixedExpenseList: $("fixedExpenseList"),
  extraIncomeName: $("extraIncomeName"),
  extraIncomeCategory: $("extraIncomeCategory"),
  extraIncomeAmount: $("extraIncomeAmount"),
  addExtraIncomeBtn: $("addExtraIncomeBtn"),
  extraIncomeList: $("extraIncomeList"),
  extraIncomeTotal: $("extraIncomeTotal"),
  expenseName: $("expenseName"),
  expenseCategory: $("expenseCategory"),
  expenseAmount: $("expenseAmount"),
  addExpenseBtn: $("addExpenseBtn"),
  expenseList: $("expenseList"),
  variableTotal: $("variableTotal"),
  requiredTotal: $("requiredTotal"),
  availableTotal: $("availableTotal"),
  availableAlert: $("availableAlert"),
  monthActivityNotice: $("monthActivityNotice"),
  monthStatus: $("monthStatus"),
  goalsList: $("goalsList"),
  aiTitle: $("aiTitle"),
  aiMessage: $("aiMessage"),
  aiInsights: $("aiInsights"),
  refreshAiBtn: $("refreshAiBtn"),
  monthsList: $("monthsList"),
  goalTemplate: $("goalTemplate"),
};

function loadUsers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveUsers() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.users));
  saveCloudData();
}

function selectedMonth() {
  return els.monthInput.value || monthKey(now);
}

function currentData() {
  return state.users[currentUser];
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function withTimeout(promise, message = "La conexión tardó demasiado. Probá de nuevo en unos segundos.", timeoutMs = 12000) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function blankMonth() {
  return {
    income: 0,
    fixed: 0,
    fixedExpenses: [],
    extraIncomes: [],
    expenses: [],
    contributions: {},
  };
}

function recurringDefaultsFor(key) {
  const data = currentData();
  const previousKey = Object.keys(data.months)
    .filter((monthKeyValue) => monthKeyValue < key && isMonthFilled(data.months[monthKeyValue]))
    .sort()
    .pop();

  if (!previousKey) return { income: 0, fixed: 0 };
  return {
    income: data.months[previousKey].income || 0,
    fixed: data.months[previousKey].fixed || 0,
  };
}

function getMonth(key = selectedMonth()) {
  const existing = currentData().months[key];
  if (existing) return existing;
  return { ...blankMonth(), ...recurringDefaultsFor(key) };
}

function ensureMonth(key = selectedMonth()) {
  const data = currentData();
  if (!data.months[key]) {
    data.months[key] = { ...blankMonth(), ...recurringDefaultsFor(key) };
  }
  return data.months[key];
}

function isMonthFilled(month) {
  const contributions = Object.values(month.contributions || {}).reduce((sum, value) => sum + value, 0);
  return Boolean(month.income || month.fixed || month.fixedExpenses?.length || month.extraIncomes?.length || month.expenses.length || contributions);
}

function hasMonthActivity(month) {
  return Boolean(
    fixedExpenseTotal(month) ||
    extraIncomeTotal(month) ||
    variableTotal(month) ||
    monthContributionTotal(month)
  );
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
}

function parseMoney(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function formatInput(input, value) {
  input.value = value ? pesos.format(value) : "";
}

function formatMoneyWhileTyping(input) {
  const value = parseMoney(input.value);
  formatInput(input, value);
}

function monthsBetweenInclusive(startKey, endDateValue) {
  if (!endDateValue) return 1;
  const [startYear, startMonth] = startKey.split("-").map(Number);
  const end = new Date(`${endDateValue}T00:00:00`);
  const diff = (end.getFullYear() - startYear) * 12 + end.getMonth() - (startMonth - 1) + 1;
  return Math.max(1, diff);
}

function goalStartMonth(goal) {
  return goal.startDate.slice(0, 7);
}

function goalEndMonth(goal) {
  return goal.endDate.slice(0, 7);
}

function goalAppliesToMonth(goal, key = selectedMonth()) {
  return key >= goalStartMonth(goal) && key <= goalEndMonth(goal);
}

function nextMonthKey(key) {
  const [year, month] = key.split("-").map(Number);
  return monthKey(new Date(year, month, 1));
}

function goalContributed(goalId) {
  const data = currentData();
  return Object.values(data.months).reduce((sum, month) => sum + (month.contributions?.[goalId] || 0), 0);
}

function goalContributedThrough(goalId, throughKey) {
  const data = currentData();
  return Object.entries(data.months).reduce((sum, [key, month]) => {
    if (key > throughKey) return sum;
    return sum + (month.contributions?.[goalId] || 0);
  }, 0);
}

function goalContributedInMonth(goalId, key = selectedMonth()) {
  return getMonth(key).contributions?.[goalId] || 0;
}

function monthContributionTotal(month) {
  return Object.values(month.contributions || {}).reduce((sum, value) => sum + value, 0);
}

function goalProgress(goal, key = selectedMonth()) {
  const saved = goalContributedThrough(goal.id, key);
  return Math.min(100, Math.round((saved / goal.target) * 100));
}

function activeOrFutureGoals(key = selectedMonth()) {
  return currentData().goals.filter((goal) => key <= goalEndMonth(goal));
}

function activeGoalsForMonth(key = selectedMonth()) {
  return currentData().goals.filter((goal) => goalAppliesToMonth(goal, key));
}

function remainingGoalMonths(goal, fromMonth = selectedMonth()) {
  const start = fromMonth < goalStartMonth(goal) ? goalStartMonth(goal) : fromMonth;
  return monthsBetweenInclusive(start, goal.endDate);
}

function remainingGoalMonthsAfterCurrent(goal, fromMonth = selectedMonth()) {
  const start = nextMonthKey(fromMonth) < goalStartMonth(goal) ? goalStartMonth(goal) : nextMonthKey(fromMonth);
  return monthsBetweenInclusive(start, goal.endDate);
}

function monthlyRequired(goal, fromMonth = selectedMonth()) {
  if (!goalAppliesToMonth(goal, fromMonth)) return 0;
  const contributionThisMonth = goalContributedInMonth(goal.id, fromMonth);
  const savedThroughMonth = goalContributedThrough(goal.id, fromMonth);
  const remaining = Math.max(0, goal.target - savedThroughMonth);
  const months = contributionThisMonth > 0
    ? remainingGoalMonthsAfterCurrent(goal, fromMonth)
    : remainingGoalMonths(goal, fromMonth);
  return remaining ? Math.ceil(remaining / months) : 0;
}

function variableTotal(month) {
  return month.expenses.reduce((sum, item) => sum + item.amount, 0);
}

function extraIncomeTotal(month) {
  return (month.extraIncomes || []).reduce((sum, item) => sum + item.amount, 0);
}

function fixedExpenseTotal(month) {
  return (month.fixedExpenses || []).reduce((sum, item) => sum + item.amount, 0);
}

function fixedTotal(month) {
  return month.fixed + fixedExpenseTotal(month);
}

function requiredTotalForMonth(key = selectedMonth()) {
  return currentData().goals
    .filter((goal) => goalAppliesToMonth(goal, key))
    .reduce((sum, goal) => sum + monthlyRequired(goal, key), 0);
}

function goalImpactForMonth(goal, key = selectedMonth()) {
  if (!goalAppliesToMonth(goal, key)) return 0;
  const contribution = goalContributedInMonth(goal.id, key);
  return contribution > 0 ? contribution : monthlyRequired(goal, key);
}

function goalImpactTotalForMonth(key = selectedMonth()) {
  return currentData().goals
    .filter((goal) => goalAppliesToMonth(goal, key))
    .reduce((sum, goal) => sum + goalImpactForMonth(goal, key), 0);
}

function availableForMonth(key = selectedMonth()) {
  const month = getMonth(key);
  return month.income + extraIncomeTotal(month) - fixedTotal(month) - variableTotal(month) - goalImpactTotalForMonth(key);
}

function bindMoneyBlur(input, onValue) {
  input.addEventListener("input", () => {
    formatMoneyWhileTyping(input);
    onValue(parseMoney(input.value));
    saveUsers();
  });
  input.addEventListener("blur", () => {
    const value = parseMoney(input.value);
    onValue(value);
    formatInput(input, value);
    saveAndRender();
  });
}

function saveAndRender() {
  saveUsers();
  render();
}

function applyFixedBaseForward() {
  const data = currentData();
  const key = selectedMonth();
  const baseMonth = ensureMonth(key);
  const futureKeys = Object.keys(data.months).filter((monthKeyValue) => monthKeyValue > key).sort();

  futureKeys.forEach((monthKeyValue) => {
    data.months[monthKeyValue].income = baseMonth.income;
    data.months[monthKeyValue].fixed = baseMonth.fixed;
    data.months[monthKeyValue].fixedExpenses = (baseMonth.fixedExpenses || []).map((expense) => ({ ...expense }));
  });

  saveUsers();
  render();
  const message = futureKeys.length
    ? `Base aplicada a ${futureKeys.length} mes${futureKeys.length === 1 ? "" : "es"} siguiente${futureKeys.length === 1 ? "" : "s"}.`
    : "No hay meses siguientes cargados todavía.";
  els.fixedBaseHint.textContent = message;
  window.clearTimeout(applyFixedBaseForward.timeoutId);
  applyFixedBaseForward.timeoutId = window.setTimeout(() => {
    els.fixedBaseHint.textContent = "";
  }, 4200);
}

async function loadCloudData(userId, email) {
  if (!supabaseClient) return;
  const { data, error } = await withTimeout(
    supabaseClient
      .from("user_app_data")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle(),
    "Supabase no respondió al cargar tus datos. Revisá conexión o si ejecutaste el SQL."
  );

  if (error) throw error;

  if (data?.data) {
    state.users[email] = data.data;
    return;
  }

  const localData = state.users[email] || defaultUserData(email);
  state.users[email] = localData;
  const { error: insertError } = await withTimeout(
    supabaseClient
      .from("user_app_data")
      .insert({ user_id: userId, data: localData }),
    "Supabase no respondió al crear tu memoria. Revisá si ejecutaste el SQL."
  );
  if (insertError) throw insertError;
}

let cloudSaveTimer = null;
let cloudSavePromise = Promise.resolve();

function setSaveStatus(message, tone = "") {
  if (!els.saveStatus) return;
  els.saveStatus.textContent = message;
  els.saveStatus.dataset.tone = tone;
}

function saveCloudData({ immediate = false } = {}) {
  if (!supabaseClient || !currentAuthUserId || !currentUser || !state.users[currentUser]) {
    setSaveStatus("Guardado local", "local");
    return Promise.resolve();
  }

  setSaveStatus("Guardando...", "saving");
  window.clearTimeout(cloudSaveTimer);
  const runSave = async () => {
    setSaveStatus("Guardando...", "saving");
    const { error } = await supabaseClient
      .from("user_app_data")
      .upsert({
        user_id: currentAuthUserId,
        data: state.users[currentUser],
      });

    if (error) throw error;
    setSaveStatus(`Guardado ${new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`, "saved");
  };

  const scheduleSave = async () => {
    cloudSaveTimer = null;
    cloudSavePromise = runSave().catch(() => {
      setSaveStatus("No se pudo guardar", "error");
    });
    await cloudSavePromise;
  };

  if (immediate) {
    return scheduleSave();
  }

  cloudSaveTimer = window.setTimeout(scheduleSave, 350);

  return cloudSavePromise;
}

async function flushCloudSave() {
  if (cloudSaveTimer) {
    window.clearTimeout(cloudSaveTimer);
    cloudSaveTimer = null;
    await saveCloudData({ immediate: true });
  }
  await cloudSavePromise;
}

async function login(username, password) {
  const normalized = normalizeEmail(username);
  if (!normalized || !password) return false;

  if (!supabaseClient) {
    els.loginHint.textContent = "No se pudo cargar Supabase. Revisá la conexión a internet.";
    return false;
  }

  els.loginHint.textContent = "Conectando...";
  try {
    const signInResult = await withTimeout(
      supabaseClient.auth.signInWithPassword({
        email: normalized,
        password,
      }),
      "Supabase no respondió al iniciar sesión. Revisá internet y probá de nuevo."
    );

    if (signInResult.data?.session?.user) {
      await finishSupabaseLogin(signInResult.data.session.user, normalized);
      return true;
    }

    const signInMessage = signInResult.error?.message || "";
    if (signInMessage.toLowerCase().includes("email not confirmed")) {
      els.loginHint.textContent = "Tu email todavía no está confirmado. Revisá tu correo y luego volvé a entrar.";
      return false;
    }

    if (signInResult.error && !signInMessage.toLowerCase().includes("invalid login credentials")) {
      els.loginHint.textContent = signInMessage || "No se pudo iniciar sesión.";
      return false;
    }

    const signUp = await withTimeout(
      supabaseClient.auth.signUp({
        email: normalized,
        password,
      }),
      "Supabase no respondió al crear la cuenta. Probá de nuevo."
    );

    if (signUp.error) {
      els.loginHint.textContent = signUp.error.message || "No se pudo crear la cuenta.";
      return false;
    }

    if (signUp.data?.session?.user) {
      await finishSupabaseLogin(signUp.data.session.user, normalized);
      return true;
    }

    if (signUp.data?.user && !signUp.data.session) {
      els.loginHint.textContent = "Cuenta creada. Si Supabase pide confirmación, revisá tu email y luego volvé a entrar.";
      return false;
    }

    const sessionResult = await withTimeout(
      supabaseClient.auth.getSession(),
      "Supabase no respondió al validar la sesión."
    );
    if (sessionResult.data?.session?.user) {
      await finishSupabaseLogin(sessionResult.data.session.user, normalized);
      return true;
    }

    els.loginHint.textContent = "No se pudo iniciar sesión. Revisá si el email necesita confirmación o si la contraseña es correcta.";
    return false;
  } catch (error) {
    els.loginHint.textContent = error.message || "No se pudo conectar con Supabase.";
    return false;
  }
}

async function finishSupabaseLogin(user, normalizedEmail) {
  currentUser = normalizedEmail;
  currentAuthUserId = user.id;
  localStorage.setItem("ahorroInteligente.currentUser", currentUser);
  await loadCloudData(currentAuthUserId, currentUser);
  saveUsers();
  els.monthInput.value = monthKey(now);
  els.authView.classList.add("hidden");
  els.appView.classList.remove("hidden");
  els.loginHint.textContent = "";
  render();
}

function render() {
  if (!currentUser) return;
  const data = currentData();
  const monthKeyValue = selectedMonth();
  const month = getMonth(monthKeyValue);
  const hadMonth = Boolean(data.months[monthKeyValue] && isMonthFilled(data.months[monthKeyValue]));

  els.welcomeTitle.textContent = `Hola, ${data.profileName || currentUser}`;
  els.profileName.value = data.profileName || "";
  formatInput(els.incomeInput, month.income);
  formatInput(els.fixedInput, month.fixed);
  const hasActivity = hasMonthActivity(month);
  els.monthStatus.textContent = hasActivity ? "Con movimientos" : hadMonth ? "Solo base fija" : "Mes nuevo";
  els.monthActivityNotice.classList.toggle("hidden", hasActivity);

  const variable = variableTotal(month);
  const extraIncome = extraIncomeTotal(month);
  const required = requiredTotalForMonth(monthKeyValue);
  const available = availableForMonth(monthKeyValue);
  els.extraIncomeTotal.textContent = pesos.format(extraIncome);
  els.variableTotal.textContent = pesos.format(variable);
  els.requiredTotal.textContent = pesos.format(required);
  els.availableTotal.textContent = pesos.format(available);
  els.availableAlert.classList.toggle("hidden", available >= 500000);
  els.availableAlert.textContent = "Alerta: quedás por debajo de $ 500.000 disponibles después de gastos y metas. Conviene revisar variables o extender plazos.";

  renderFixedExpenses(month);
  renderExtraIncomes(month);
  renderExpenses(month);
  renderOverview();
  renderGoals();
  renderAi();
  renderMonths();
}

function renderOverview() {
  const data = currentData();
  const baseKey = selectedMonth();
  const goals = activeGoalsForMonth(baseKey);
  const futureCount = data.goals.filter((goal) => baseKey < goalStartMonth(goal)).length;
  const saved = goals.reduce((sum, goal) => sum + goalContributedThrough(goal.id, baseKey), 0);
  const target = goals.reduce((sum, goal) => sum + goal.target, 0);
  const remaining = Math.max(0, target - saved);
  const required = goals.reduce((sum, goal) => sum + monthlyRequiredFromSaved(goal, baseKey, savedForGoal(goal, baseKey)), 0);
  const progress = target ? Math.min(100, Math.round((saved / target) * 100)) : 0;
  const activeCount = goals.length;

  els.overviewDate.textContent = monthLabel(baseKey);
  els.overviewSaved.textContent = pesos.format(saved);
  els.overviewTarget.textContent = pesos.format(target);
  els.overviewRemaining.textContent = pesos.format(remaining);
  els.overviewRequired.textContent = pesos.format(required);
  els.overviewProgressFill.style.width = `${progress}%`;

  if (!data.goals.length) {
    els.overviewProjection.textContent = "Creá una meta para ver el estado general, la proyección y el ahorro necesario por mes.";
  } else if (!goals.length) {
    els.overviewProjection.textContent = futureCount
      ? `No hay metas activas en ${monthLabel(baseKey)}. Las metas futuras empiezan a contar desde su mes de inicio.`
      : "Todas las metas cargadas ya terminaron según sus fechas. Podés crear una nueva o revisar el historial mensual.";
  } else {
    const status = remaining
      ? `Vas ${progress}% del camino. Con ${monthLabel(baseKey)} como corte, necesitás reservar ${pesos.format(required)} por mes en los meses restantes.`
      : "Las metas vigentes ya están cubiertas con los aportes cargados.";
    const scope = `${activeCount} meta${activeCount === 1 ? "" : "s"} activa${activeCount === 1 ? "" : "s"} este mes.`;
    els.overviewProjection.textContent = `${status} ${scope}`;
  }

  renderOverviewGoals(goals);
}

function savedForGoal(goal, key) {
  return goalContributedThrough(goal.id, key);
}

function monthlyRequiredFromSaved(goal, fromMonth, saved) {
  if (!goalAppliesToMonth(goal, fromMonth)) return 0;
  if (fromMonth > goalEndMonth(goal)) return 0;
  const remaining = Math.max(0, goal.target - saved);
  const contributionThisMonth = goalContributedInMonth(goal.id, fromMonth);
  const months = contributionThisMonth > 0
    ? remainingGoalMonthsAfterCurrent(goal, fromMonth)
    : remainingGoalMonths(goal, fromMonth);
  return remaining ? Math.ceil(remaining / months) : 0;
}

function renderOverviewGoals(goals) {
  const baseKey = selectedMonth();
  els.overviewGoals.innerHTML = "";
  if (!goals.length) {
    els.overviewGoals.innerHTML = '<div class="empty">Sin metas vigentes para resumir.</div>';
    return;
  }

  goals
    .slice()
    .sort((a, b) => goalEndMonth(a).localeCompare(goalEndMonth(b)))
    .slice(0, 4)
    .forEach((goal) => {
      const saved = savedForGoal(goal, baseKey);
      const remaining = Math.max(0, goal.target - saved);
      const progress = goal.target ? Math.min(100, Math.round((saved / goal.target) * 100)) : 0;
      const state = goalAppliesToMonth(goal, baseKey)
        ? "Activa"
        : baseKey < goalStartMonth(goal)
          ? "Futura"
          : "Finalizada";
      const item = document.createElement("div");
      item.className = "overview-goal";
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(goal.name)}</strong>
          <span>${state} · ${progress}% · falta ${pesos.format(remaining)}</span>
        </div>
        <small>${formatDate(goal.endDate)}</small>
      `;
      els.overviewGoals.appendChild(item);
    });
}

function renderFixedExpenses(month) {
  const fixedExpenses = month.fixedExpenses || [];
  els.fixedExpenseList.innerHTML = "";
  if (!fixedExpenses.length) {
    els.fixedExpenseList.innerHTML = '<div class="empty">Este mes no tiene gastos fijos detallados.</div>';
    return;
  }

  fixedExpenses.forEach((expense) => {
    const row = document.createElement("div");
    row.className = "fixed-expense-item";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(expense.name)}</strong>
        <span>${pesos.format(expense.amount)}</span>
      </div>
      <div class="row-actions">
        <button class="edit-row" type="button" title="Editar gasto fijo">✎</button>
        <button type="button" title="Eliminar gasto fijo">×</button>
      </div>
    `;
    row.querySelector(".edit-row").addEventListener("click", () => editFixedExpense(expense));
    row.querySelector(".row-actions button:last-child").addEventListener("click", () => {
      const month = ensureMonth();
      month.fixedExpenses = (month.fixedExpenses || []).filter((item) => item.id !== expense.id);
      saveAndRender();
    });
    els.fixedExpenseList.appendChild(row);
  });
}

function renderExtraIncomes(month) {
  const extraIncomes = month.extraIncomes || [];
  els.extraIncomeList.innerHTML = "";
  if (!extraIncomes.length) {
    els.extraIncomeList.innerHTML = '<div class="empty">Este mes todavía no tiene ingresos extra.</div>';
    return;
  }

  extraIncomes.forEach((income) => {
    const row = document.createElement("div");
    row.className = "income-item";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(income.name)}</strong>
        <span>${escapeHtml(income.category)} · ${pesos.format(income.amount)}</span>
      </div>
      <button type="button" title="Eliminar ingreso">×</button>
    `;
    row.querySelector("button").addEventListener("click", () => {
      const month = ensureMonth();
      month.extraIncomes = (month.extraIncomes || []).filter((item) => item.id !== income.id);
      saveAndRender();
    });
    els.extraIncomeList.appendChild(row);
  });
}

function renderExpenses(month) {
  els.expenseList.innerHTML = "";
  if (!month.expenses.length) {
    els.expenseList.innerHTML = '<div class="empty">Este mes todavía no tiene gastos variables.</div>';
    return;
  }

  month.expenses.forEach((expense) => {
    const row = document.createElement("div");
    row.className = "expense-item";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(expense.name)}</strong>
        <span>${escapeHtml(expense.category)} · ${pesos.format(expense.amount)}</span>
      </div>
      <button type="button" title="Eliminar gasto">×</button>
    `;
    row.querySelector("button").addEventListener("click", () => {
      const month = ensureMonth();
      month.expenses = month.expenses.filter((item) => item.id !== expense.id);
      saveAndRender();
    });
    els.expenseList.appendChild(row);
  });
}

function renderGoals() {
  const data = currentData();
  const activeGoals = data.goals.filter((goal) => goalAppliesToMonth(goal));
  const futureGoals = data.goals.filter((goal) => selectedMonth() < goalStartMonth(goal)).length;
  els.goalsList.innerHTML = "";
  if (!data.goals.length) {
    els.goalsList.innerHTML = '<div class="empty">Creá una meta para empezar a medir tu avance.</div>';
    return;
  }
  if (!activeGoals.length) {
    els.goalsList.innerHTML = futureGoals
      ? '<div class="empty">No hay metas activas en este mes. Las metas futuras empiezan a contar desde su mes de inicio.</div>'
      : '<div class="empty">No hay metas activas para este mes.</div>';
    return;
  }

  activeGoals.forEach((goal) => {
    const node = els.goalTemplate.content.firstElementChild.cloneNode(true);
    const progress = goalProgress(goal);
    const saved = goalContributedThrough(goal.id, selectedMonth());
    const savedThisMonth = goalContributedInMonth(goal.id);
    const required = monthlyRequired(goal);
    const divisorMonths = savedThisMonth > 0 ? remainingGoalMonthsAfterCurrent(goal) : remainingGoalMonths(goal);
    const mascot = node.querySelector(".mascot");

    node.querySelector("h3").textContent = goal.name;
    node.querySelector(".goal-dates").textContent = `Desde ${formatDate(goal.startDate)} hasta ${formatDate(goal.endDate)}`;
    node.querySelector(".progress-fill").style.width = `${progress}%`;
    node.querySelector(".progress-text").textContent = `${progress}%`;
    mascot.style.left = `${Math.min(92, progress)}%`;
    mascot.style.setProperty("--lean", `${-24 + progress * 0.34}deg`);
    node.querySelector(".duff").style.opacity = progress >= 88 ? "1" : "0";
    node.querySelector(".goal-numbers").innerHTML = `
      <span>Objetivo<br><strong>${pesos.format(goal.target)}</strong></span>
      <span>Ahorrado<br><strong>${pesos.format(saved)}</strong></span>
      <span>Falta<br><strong>${pesos.format(Math.max(0, goal.target - saved))}</strong></span>
      <span>Aporte de este mes<br><strong>${pesos.format(savedThisMonth)}</strong></span>
      <span>Meses para recalcular<br><strong>${divisorMonths}</strong></span>
      <span>Ahorro mensual objetivo<br><strong>${pesos.format(required)}</strong></span>
    `;

    const contributionInput = node.querySelector(".contribution-input");
    contributionInput.addEventListener("input", () => formatMoneyWhileTyping(contributionInput));
    node.querySelector(".add-contribution").addEventListener("click", () => {
      const amount = parseMoney(contributionInput.value);
      if (!amount) return;
      const month = ensureMonth();
      month.contributions[goal.id] = (month.contributions[goal.id] || 0) + amount;
      saveAndRender();
    });

    node.querySelector(".edit-goal").addEventListener("click", () => editGoal(goal));
    node.querySelector(".delete-goal").addEventListener("click", () => deleteGoal(goal.id));
    els.goalsList.appendChild(node);
  });
}

function renderAi() {
  const data = currentData();
  const month = getMonth();
  const available = availableForMonth();
  const categories = categoryTotals(month);
  const incomeCategories = extraIncomeCategoryTotals(month);
  const top = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
  const topExtraIncome = Object.entries(incomeCategories).sort((a, b) => b[1] - a[1])[0];
  const previousKey = previousMonthKey(selectedMonth());
  const previous = data.months[previousKey];
  const previousHasData = Boolean(previous && isMonthFilled(previous));
  const increases = previous ? compareCategories(categories, categoryTotals(previous)) : [];
  const extraIncome = extraIncomeTotal(month);

  const advice = availableAdvice(available);
  els.aiTitle.textContent = advice.title;
  els.aiMessage.textContent = advice.messages[(new Date(`${selectedMonth()}-01`).getMonth() + aiNudge) % advice.messages.length];

  els.aiInsights.innerHTML = "";
  addInsight("Ingreso extra", extraIncomeInsight(topExtraIncome, extraIncome, top));
  addInsight("Mayor gasto variable", top ? `${top[0]} concentra ${pesos.format(top[1])} este mes.` : "Todavía no hay gastos variables para analizar.");
  addInsight("Comparación mensual", monthlyComparisonText(previousKey, previousHasData, increases, categories));
  addInsight("Próximo paso", data.goals.length ? "Sumá aportes cuando ahorres: la barra sube y el ahorro mensual objetivo se recalcula solo en los meses activos de cada meta." : "Creá tu primera meta para que el panel empiece a proyectar cuánto ahorrar por mes.");
}

function availableAdvice(available) {
  if (available < 400000) {
    return {
      title: "Ajuste necesario",
      messages: [
        `Este mes quedás con ${pesos.format(available)} disponible. No es para asustarse, pero sí para ajustar un poco y cuidar la meta de cerca.`,
        `Disponible bajo: ${pesos.format(available)}. Bajá un cambio en gastos variables este mes; cada decisión chica te vuelve a ordenar.`,
        `Hay que ponerse un poco firme: con ${pesos.format(available)} disponible, conviene priorizar lo importante y dejar los gustos para otro tramo.`,
      ],
    };
  }

  if (available < 500000) {
    return {
      title: "Atención suave",
      messages: [
        `Vas encaminado, pero con ${pesos.format(available)} disponible todavía conviene mirar de cerca los gastos chicos.`,
        `Estás cerca de una zona más cómoda. Si cuidás las variables este mes, la meta sigue avanzando sin tanta presión.`,
        `No viene mal un poco de orden extra: el disponible está justo, pero todavía se puede sostener el plan.`,
      ],
    };
  }

  if (available < 600000) {
    return {
      title: "Buen margen",
      messages: [
        `Con ${pesos.format(available)} disponible podés respirar un poco. Relajá, pero sin soltar el foco de la meta.`,
        `Este mes viene bien. Permitite algo chico si querés, y mantené el aporte de ahorro como prioridad.`,
        `Hay margen para moverte con más tranquilidad. La clave es disfrutar sin desordenar el objetivo.`,
      ],
    };
  }

  if (available < 700000) {
    return {
      title: "Mes cómodo",
      messages: [
        `Con ${pesos.format(available)} disponible podés darte un gusto tranquilo. Buen momento para disfrutar sin perder el ritmo.`,
        `El mes está bien parado. Si aparece un gusto razonable, puede entrar; la meta sigue siendo el norte.`,
        `Tenés aire. Aprovechá para sostener el ahorro y permitirte algo que no te saque del plan.`,
      ],
    };
  }

  return {
    title: "Muy buen margen",
    messages: [
      `Con ${pesos.format(available)} disponible estás holgado. Excelente, pero no dejes de poner el foco en la meta.`,
      `Muy buen mes: hay aire para disfrutar y también para acelerar el ahorro si querés llegar más tranquilo.`,
      `Estás en una zona cómoda. Podés relajarte un poco, pero el verdadero lujo es seguir acercándote a tu objetivo.`,
    ],
  };
}

function extraIncomeInsight(topExtraIncome, total, topExpense) {
  if (!total) return "No registraste ingresos extra este mes.";
  const source = topExtraIncome ? `${topExtraIncome[0]} aportó ${pesos.format(topExtraIncome[1])}` : `Entraron ${pesos.format(total)}`;
  if (!topExpense) return `${source}. Conviene decidir cuánto de eso va a metas antes de que se diluya.`;
  return `${source}. El mayor gasto variable fue ${topExpense[0]} con ${pesos.format(topExpense[1])}.`;
}

function monthlyComparisonText(previousKey, previousHasData, increases, categories) {
  if (!previousHasData) return `No hay datos cargados en ${monthLabel(previousKey)} para comparar.`;
  if (increases.length) return increases[0];
  if (!Object.keys(categories).length) {
    return `Hay datos en ${monthLabel(previousKey)}. Cuando cargues gastos variables de este mes, la IA podrá comparar cambios.`;
  }
  return `No se detectan aumentos frente a ${monthLabel(previousKey)}. Bien ahí: los gastos variables vienen contenidos.`;
}

function addInsight(title, text) {
  const item = document.createElement("div");
  item.className = "insight-item";
  item.innerHTML = `<strong>${title}</strong><span>${text}</span>`;
  els.aiInsights.appendChild(item);
}

function renderMonths() {
  const keys = Object.keys(currentData().months).filter((key) => isMonthFilled(currentData().months[key])).sort();
  els.monthsList.innerHTML = "";
  if (!keys.length) {
    els.monthsList.innerHTML = '<div class="empty">Los meses aparecerán cuando cargues datos.</div>';
    return;
  }

  keys.forEach((key) => {
    const available = availableForMonth(key);
    const saved = monthContributionTotal(currentData().months[key]);
    const row = document.createElement("button");
    row.className = available < 0 ? "month-item negative" : "month-item";
    row.type = "button";
    row.innerHTML = `
      <div>
        <strong>${monthLabel(key)}</strong>
        <small>Ahorrado/aportado: ${pesos.format(saved)}</small>
      </div>
      <span>${pesos.format(available)} disponible</span>
    `;
    row.addEventListener("click", () => {
      els.monthInput.value = key;
      render();
    });
    els.monthsList.appendChild(row);
  });
}

function categoryTotals(month) {
  return month.expenses.reduce((totals, expense) => {
    totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
    return totals;
  }, {});
}

function extraIncomeCategoryTotals(month) {
  return (month.extraIncomes || []).reduce((totals, income) => {
    totals[income.category] = (totals[income.category] || 0) + income.amount;
    return totals;
  }, {});
}

function compareCategories(current, previous) {
  return Object.keys(current)
    .map((category) => {
      const diff = current[category] - (previous[category] || 0);
      return { category, diff };
    })
    .filter((item) => item.diff > 0)
    .sort((a, b) => b.diff - a.diff)
    .map((item) => `${item.category} subió ${pesos.format(item.diff)} contra ${monthLabel(previousMonthKey(selectedMonth()))}.`);
}

function previousMonthKey(key) {
  const [year, month] = key.split("-").map(Number);
  return monthKey(new Date(year, month - 2, 1));
}

function formatDate(value) {
  if (!value) return "sin fecha";
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-AR");
}

function editGoal(goal) {
  const name = prompt("Nombre de la meta", goal.name);
  if (name === null) return;
  const target = prompt("Monto objetivo", pesos.format(goal.target));
  if (target === null) return;
  const endDate = prompt("Fecha final (AAAA-MM-DD)", goal.endDate);
  if (endDate === null) return;

  goal.name = name.trim() || goal.name;
  goal.target = parseMoney(target) || goal.target;
  goal.endDate = endDate || goal.endDate;
  saveAndRender();
}

function editFixedExpense(expense) {
  const name = prompt("Nombre del gasto fijo", expense.name);
  if (name === null) return;
  const amount = prompt("Monto del gasto fijo", pesos.format(expense.amount));
  if (amount === null) return;

  expense.name = name.trim() || expense.name;
  expense.amount = parseMoney(amount) || expense.amount;
  saveAndRender();
}

function deleteGoal(goalId) {
  if (!confirm("¿Eliminar esta meta y sus aportes?")) return;
  const data = currentData();
  data.goals = data.goals.filter((goal) => goal.id !== goalId);
  Object.values(data.months).forEach((month) => {
    delete month.contributions[goalId];
  });
  saveAndRender();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await login(els.loginUser.value, els.loginPass.value);
  } catch (error) {
    els.loginHint.textContent = error.message || "No se pudo iniciar sesión.";
  }
});

els.logoutBtn.addEventListener("click", async () => {
  await flushCloudSave();
  if (supabaseClient) await supabaseClient.auth.signOut();
  currentUser = null;
  currentAuthUserId = null;
  localStorage.removeItem("ahorroInteligente.currentUser");
  els.appView.classList.add("hidden");
  els.authView.classList.remove("hidden");
});

els.monthInput.addEventListener("change", render);

els.profileName.addEventListener("blur", () => {
  currentData().profileName = els.profileName.value.trim() || currentUser;
  saveAndRender();
});

bindMoneyBlur(els.incomeInput, (value) => {
  ensureMonth().income = value;
});

bindMoneyBlur(els.fixedInput, (value) => {
  ensureMonth().fixed = value;
});

els.applyFixedForwardBtn.addEventListener("click", applyFixedBaseForward);

els.addFixedExpenseBtn.addEventListener("click", () => {
  const amount = parseMoney(els.fixedExpenseAmount.value);
  const name = els.fixedExpenseName.value.trim();
  if (!name || !amount) return;
  const month = ensureMonth();
  month.fixedExpenses = month.fixedExpenses || [];
  month.fixedExpenses.push({
    id: crypto.randomUUID(),
    name,
    amount,
  });
  els.fixedExpenseName.value = "";
  els.fixedExpenseAmount.value = "";
  saveAndRender();
});

els.addExtraIncomeBtn.addEventListener("click", () => {
  const amount = parseMoney(els.extraIncomeAmount.value);
  const name = els.extraIncomeName.value.trim();
  if (!name || !amount) return;
  const month = ensureMonth();
  month.extraIncomes = month.extraIncomes || [];
  month.extraIncomes.push({
    id: crypto.randomUUID(),
    name,
    category: els.extraIncomeCategory.value,
    amount,
  });
  els.extraIncomeName.value = "";
  els.extraIncomeAmount.value = "";
  saveAndRender();
});

els.addExpenseBtn.addEventListener("click", () => {
  const amount = parseMoney(els.expenseAmount.value);
  const name = els.expenseName.value.trim();
  if (!name || !amount) return;
  ensureMonth().expenses.push({
    id: crypto.randomUUID(),
    name,
    category: els.expenseCategory.value,
    amount,
  });
  els.expenseName.value = "";
  els.expenseAmount.value = "";
  saveAndRender();
});

els.addGoalBtn.addEventListener("click", () => {
  const name = els.goalName.value.trim();
  const target = parseMoney(els.goalTarget.value);
  const endDate = els.goalEnd.value;
  if (!name || !target || !endDate) return;

  currentData().goals.push({
    id: crypto.randomUUID(),
    name,
    target,
    startDate: `${selectedMonth()}-01`,
    endDate,
  });

  els.goalName.value = "";
  els.goalTarget.value = "";
  els.goalEnd.value = "";
  saveAndRender();
});

els.refreshAiBtn.addEventListener("click", () => {
  aiNudge += 1;
  renderAi();
});

[els.goalTarget, els.fixedExpenseAmount, els.extraIncomeAmount, els.expenseAmount].forEach((input) => {
  input.addEventListener("input", () => formatMoneyWhileTyping(input));
  input.addEventListener("blur", () => formatInput(input, parseMoney(input.value)));
});

async function initializeAuth() {
  els.monthInput.value = monthKey(now);
  if (!supabaseClient) return;

  const { data } = await supabaseClient.auth.getSession();
  const session = data.session;
  if (!session?.user?.email) return;

  currentUser = normalizeEmail(session.user.email);
  currentAuthUserId = session.user.id;
  localStorage.setItem("ahorroInteligente.currentUser", currentUser);
  try {
    await loadCloudData(currentAuthUserId, currentUser);
    saveUsers();
    els.authView.classList.add("hidden");
    els.appView.classList.remove("hidden");
    render();
  } catch (error) {
    els.loginHint.textContent = error.message || "No se pudieron cargar los datos.";
  }
}

initializeAuth();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
