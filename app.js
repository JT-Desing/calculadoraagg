const paymentMethods = {
  pseHigh: {
    label: "PSE (Mayor a $60.000)",
    kind: "pse",
    davivienda: { percent: 0.0268, fixed: 690 },
    other: { percent: 0.0329, fixed: 700 },
  },
  pseLow: {
    label: "PSE (Menor a $60.000)",
    kind: "pse",
    davivienda: { percent: 0, fixed: 2000 },
    other: { percent: 0, fixed: 2000 },
  },
  cardNational: {
    label: "Tarjeta nacional",
    kind: "card",
    davivienda: { percent: 0.0268, fixed: 690 },
    other: { percent: 0.0329, fixed: 700 },
  },
  cardInternational: {
    label: "Tarjeta internacional",
    kind: "card",
    davivienda: { percent: 0.0348, fixed: 690 },
    other: { percent: 0.0409, fixed: 700 },
  },
  cash: {
    label: "Efectivo",
    kind: "cash",
    davivienda: { percent: 0.0268, fixed: 690 },
    other: { percent: 0.0329, fixed: 700 },
  },
};

const departments = {
  "Sin ReteICA": [{ name: "No aplica / Sin municipio", rate: 0 }],
  "Bogotá D.C.": [{ name: "Bogotá D.C.", rate: 0.002 }],
  Antioquia: [
    { name: "Medellín", rate: 0.002 },
    { name: "Envigado", rate: 0.002 },
    { name: "Rionegro", rate: 0.002 },
    { name: "La Unión", rate: 0.002 },
    { name: "San Pedro", rate: 0.002 },
  ],
  Atlántico: [
    { name: "Barranquilla", rate: 0.002 },
    { name: "Soledad", rate: 0.002 },
  ],
  "Valle del Cauca": [
    { name: "Cali", rate: 0.002 },
    { name: "Palmira", rate: 0.002 },
    { name: "La Unión", rate: 0.002 },
    { name: "San Pedro", rate: 0.002 },
  ],
  Santander: [
    { name: "Bucaramanga", rate: 0.002 },
    { name: "Floridablanca", rate: 0.002 },
  ],
  Cundinamarca: [
    { name: "Chía", rate: 0.002 },
    { name: "Soacha", rate: 0.002 },
  ],
  Bolívar: [
    { name: "Cartagena", rate: 0.002 },
    { name: "Turbaco", rate: 0.002 },
  ],
};

const banks = [
  {
    id: "davivienda",
    name: "Cuenta vinculada",
    kicker: "Tarifa preferencial",
    copy: "Para comercios con cuenta Davivienda o DaviPlata vinculada.",
  },
  {
    id: "other",
    name: "Otros bancos",
    kicker: "Tarifa estándar",
    copy: "Para comercios con cuentas de otros bancos.",
  },
];

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const percent = new Intl.NumberFormat("es-CO", {
  style: "percent",
  maximumFractionDigits: 2,
});

const form = document.querySelector("#calculatorForm");
const saleAmount = document.querySelector("#saleAmount");
const taxRate = document.querySelector("#taxRate");
const paymentMethod = document.querySelector("#paymentMethod");
const departmentSelect = document.querySelector("#departmentSelect");
const cityInput = document.querySelector("#cityInput");
const citySuggestions = document.querySelector("#citySuggestions");
const paymentNotice = document.querySelector("#paymentNotice");
const baseValue = document.querySelector("#baseValue");
const taxIncluded = document.querySelector("#taxIncluded");
const reteIcaRate = document.querySelector("#reteIcaRate");
const reteIvaValue = document.querySelector("#reteIvaValue");
const bankResults = document.querySelector("#bankResults");
const rateSummary = document.querySelector("#rateSummary");
const bestOption = document.querySelector("#bestOption");
const resetButton = document.querySelector("#resetButton");

let cityIndex = [];
let selectedCity = null;

function formatMoney(value) {
  return currency.format(Math.round(value || 0));
}

function formatRate(value) {
  return percent.format(value || 0);
}

function rateText(rate) {
  if (rate.percent === 0) {
    return `$${rate.fixed.toLocaleString("es-CO")}`;
  }

  return `${formatRate(rate.percent)} + $${rate.fixed.toLocaleString("es-CO")}`;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildCityIndex() {
  cityIndex = Object.entries(departments).flatMap(([department, cities]) =>
    cities.map((city) => ({
      ...city,
      department,
      key: `${department}::${city.name}`,
      normalizedName: normalizeText(city.name),
      normalizedDepartment: normalizeText(department),
    })),
  );
}

function populateDepartments() {
  departmentSelect.innerHTML = Object.keys(departments)
    .map((department) => `<option value="${department}">${department}</option>`)
    .join("");
  buildCityIndex();
  departmentSelect.value = "Bogotá D.C.";
  selectCity(cityIndex.find((city) => city.department === "Bogotá D.C.") || cityIndex[0], false);
}

function selectCity(city, shouldCalculate = true) {
  if (!city) {
    selectedCity = cityIndex[0];
  } else {
    selectedCity = city;
  }

  departmentSelect.value = selectedCity.department;
  cityInput.value = selectedCity.name;
  closeCitySuggestions();

  if (shouldCalculate) {
    calculate();
  }
}

function getSelectedCity() {
  return selectedCity || cityIndex[0];
}

function closeCitySuggestions() {
  citySuggestions.classList.remove("is-open");
  citySuggestions.innerHTML = "";
  cityInput.setAttribute("aria-expanded", "false");
}

function renderCitySuggestions(matches, message = "") {
  if (message) {
    citySuggestions.innerHTML = `<div class="city-empty">${message}</div>`;
  } else {
    citySuggestions.innerHTML = matches
      .map(
        (city) => `
          <button class="city-option" type="button" data-key="${city.key}" role="option">
            <strong>${city.name}</strong>
            <span>${city.department}</span>
          </button>
        `,
      )
      .join("");
  }

  citySuggestions.classList.add("is-open");
  cityInput.setAttribute("aria-expanded", "true");
}

function getCityMatches(query) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return cityIndex.filter((city) => city.department === departmentSelect.value).slice(0, 8);
  }

  return cityIndex
    .filter(
      (city) =>
        city.normalizedName.includes(normalizedQuery) ||
        `${city.normalizedName} ${city.normalizedDepartment}`.includes(normalizedQuery),
    )
    .slice(0, 10);
}

function handleCityInput() {
  const query = cityInput.value;
  const normalizedQuery = normalizeText(query);
  const matches = getCityMatches(query);
  const exactMatches = cityIndex.filter((city) => city.normalizedName === normalizedQuery);

  if (!normalizedQuery) {
    renderCitySuggestions(matches);
    return;
  }

  if (exactMatches.length === 1) {
    selectCity(exactMatches[0]);
    return;
  }

  if (exactMatches.length > 1) {
    renderCitySuggestions(exactMatches);
    return;
  }

  if (matches.length) {
    renderCitySuggestions(matches);
    return;
  }

  renderCitySuggestions([], "No encontramos esa ciudad. Revisa la escritura o selecciona un departamento.");
}

function getBaseAndTax(total, tax) {
  if (!tax) {
    return { base: total, includedTax: 0 };
  }

  const base = total / (1 + tax);
  return { base, includedTax: total - base };
}

function calculateBank(bankId, context) {
  const method = paymentMethods[context.method];
  const rate = method[bankId];
  const commission = context.total * rate.percent + rate.fixed;
  const commissionVat = commission * 0.19;
  const reteRenta = context.base * 0.015;
  const reteIca = context.base * context.city.rate;
  const reteIva = context.includedTax * 0.19;
  const totalDiscounts = commission + commissionVat + reteRenta + reteIca + reteIva;
  const receives = context.total - totalDiscounts;
  const netPercent = context.total > 0 ? Math.max(0, Math.min(100, (receives / context.total) * 100)) : 0;

  return {
    rate,
    commission,
    commissionVat,
    reteRenta,
    reteIca,
    reteIva,
    totalDiscounts,
    receives,
    netPercent,
  };
}

function renderBank(bank, result, isBest) {
  const bankLogos =
    bank.id === "davivienda"
      ? `<div class="bank-logo-row" aria-label="Logos Davivienda y DaviPlata">
          <div class="bank-logo davivienda-logo">
            <img
              src="https://blog.epayco.com/wp-content/uploads/2026/05/davivienda_mobile.svg"
              alt="Davivienda"
              loading="lazy"
            />
          </div>
          <span class="logo-separator">o</span>
          <div class="bank-logo daviplata-logo">
            <img
              src="https://blog.epayco.com/wp-content/uploads/2026/05/DaviPlata-Mobile.svg"
              alt="DaviPlata"
              loading="lazy"
            />
          </div>
        </div>`
      : "";
  const titleBlock =
    bank.id === "other"
      ? `<h3>${bank.name}</h3><span class="bank-kicker">${bank.kicker}</span>`
      : `<span class="bank-kicker">${bank.kicker}</span><h3>${bank.name}</h3>`;

  return `
    <article class="bank-result ${isBest ? "is-best" : ""}">
      <div class="bank-head">
        <div class="bank-title">
          ${titleBlock}
          <p>${bank.copy}</p>
        </div>
        <div class="bank-head-footer">
          ${bank.id === "davivienda" ? bankLogos : ""}
          <span class="best-badge">Mejor abono</span>
        </div>
      </div>
      <div class="receive-block">
        <span>Tú recibes</span>
        <strong>${formatMoney(result.receives)}</strong>
        <div class="net-meter" aria-label="Porcentaje neto recibido">
          <span style="width: ${result.netPercent}%"></span>
        </div>
      </div>
      <div class="breakdown">
        <div class="breakdown-row"><span>Comisión (${rateText(result.rate)})</span><strong>${formatMoney(result.commission)}</strong></div>
        <div class="breakdown-row"><span>IVA comisión (19%)</span><strong>${formatMoney(result.commissionVat)}</strong></div>
        <div class="breakdown-row"><span>ReteRenta (1.5%)</span><strong>${formatMoney(result.reteRenta)}</strong></div>
        <div class="breakdown-row"><span>ReteICA</span><strong>${formatMoney(result.reteIca)}</strong></div>
        <div class="breakdown-row"><span>ReteIVA (19% sobre IVA venta)</span><strong>${formatMoney(result.reteIva)}</strong></div>
        <div class="breakdown-row total"><span>Total descuentos</span><strong>${formatMoney(result.totalDiscounts)}</strong></div>
      </div>
    </article>
  `;
}

function updateNotice(total, methodId) {
  let text = "";

  if (methodId === "pseHigh" && total > 0 && total < 60000) {
    text = 'Has seleccionado PSE mayor a $60.000 para un valor menor. Revisa la opción "PSE menor a $60.000".';
  }

  if (methodId === "pseLow" && total >= 60000) {
    text = 'PSE menor a $60.000 está pensado para ventas inferiores a ese monto. Revisa la opción "PSE mayor a $60.000".';
  }

  paymentNotice.textContent = text;
  paymentNotice.classList.toggle("is-visible", Boolean(text));
}

function updateRateSummary(method) {
  rateSummary.textContent = `${rateText(method.davivienda)} / ${rateText(method.other)}`;
}

function calculate() {
  const total = Math.max(0, Number(saleAmount.value || 0));
  const tax = Number(taxRate.value);
  const methodId = paymentMethod.value;
  const method = paymentMethods[methodId];
  const city = getSelectedCity();
  const { base, includedTax } = getBaseAndTax(total, tax);
  const context = { total, tax, method: methodId, city, base, includedTax };
  const results = {
    davivienda: calculateBank("davivienda", context),
    other: calculateBank("other", context),
  };

  const bestBank = results.davivienda.receives >= results.other.receives ? "davivienda" : "other";
  const diff = Math.abs(results.davivienda.receives - results.other.receives);

  baseValue.textContent = formatMoney(base);
  taxIncluded.textContent = formatMoney(includedTax);
  reteIcaRate.textContent = formatRate(city.rate);
  reteIvaValue.textContent = formatMoney(includedTax * 0.19);
  bestOption.textContent =
    diff > 0
      ? `${bestBank === "davivienda" ? "Davivienda" : "Otros bancos"} mejora tu abono en ${formatMoney(diff)}.`
      : "Ambas opciones entregan el mismo abono estimado.";

  bankResults.innerHTML = banks
    .map((bank) => renderBank(bank, results[bank.id], bank.id === bestBank))
    .join("");

  updateRateSummary(method);
  updateNotice(total, methodId);
}

document.querySelectorAll(".quick-amounts button").forEach((button) => {
  button.addEventListener("click", () => {
    saleAmount.value = button.dataset.amount;
    calculate();
  });
});

form.addEventListener("input", calculate);
form.addEventListener("change", calculate);

departmentSelect.addEventListener("change", () => {
  const city = cityIndex.find((item) => item.department === departmentSelect.value);
  selectCity(city);
});

cityInput.addEventListener("input", handleCityInput);

cityInput.addEventListener("focus", () => {
  renderCitySuggestions(getCityMatches(cityInput.value));
});

citySuggestions.addEventListener("click", (event) => {
  const option = event.target.closest(".city-option");

  if (!option) {
    return;
  }

  const city = cityIndex.find((item) => item.key === option.dataset.key);
  selectCity(city);
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".autocomplete-field")) {
    closeCitySuggestions();
  }
});

resetButton.addEventListener("click", () => {
  saleAmount.value = 0;
  taxRate.value = "0";
  paymentMethod.value = "pseHigh";
  departmentSelect.value = "Sin ReteICA";
  selectCity(cityIndex.find((city) => city.department === "Sin ReteICA"), false);
  calculate();
  saleAmount.focus();
});

populateDepartments();
calculate();
