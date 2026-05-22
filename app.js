const rates = {
  pension: 0.0475,
  health: 0.03595,
  care: 0.1314,
  employment: 0.009,
};

const brackets = [
  [14000000, 0.06, 0],
  [50000000, 0.15, 1260000],
  [88000000, 0.24, 5760000],
  [150000000, 0.35, 15440000],
  [300000000, 0.38, 19940000],
  [500000000, 0.4, 25940000],
  [1000000000, 0.42, 35940000],
  [Infinity, 0.45, 65940000],
];

const tableSalaries = [
  24000000, 28000000, 30000000, 32000000, 36000000, 40000000, 45000000, 50000000,
  55000000, 60000000, 70000000, 80000000, 90000000, 100000000, 120000000,
  140000000, 160000000, 180000000, 200000000,
];

const els = {
  form: document.querySelector("#salaryForm"),
  salaryTab: document.querySelector("#salaryTab"),
  bonusTab: document.querySelector("#bonusTab"),
  salaryPanel: document.querySelector("#salary"),
  bonusPanel: document.querySelector("#bonus"),
  annualSalary: document.querySelector("#annualSalary"),
  taxFreeMonthly: document.querySelector("#taxFreeMonthly"),
  dependents: document.querySelector("#dependents"),
  withholdingRate: document.querySelector("#withholdingRate"),
  bonusAmount: document.querySelector("#bonusAmount"),
  taxableAnnual: document.querySelector("#taxableAnnual"),
  includeBonusInsurance: document.querySelector("#includeBonusInsurance"),
  salaryTableBody: document.querySelector("#salaryTableBody"),
  heroNet: document.querySelector("#heroNet"),
  netPay: document.querySelector("#netPay"),
  resultSub: document.querySelector("#resultSub"),
  monthlyGross: document.querySelector("#monthlyGross"),
  totalDeduction: document.querySelector("#totalDeduction"),
  deductionRatio: document.querySelector("#deductionRatio"),
  pension: document.querySelector("#pension"),
  health: document.querySelector("#health"),
  care: document.querySelector("#care"),
  employment: document.querySelector("#employment"),
  incomeTax: document.querySelector("#incomeTax"),
  localTax: document.querySelector("#localTax"),
};

let activeMode = "salary";

function numberFromInput(value) {
  return Number(String(value).replace(/[^\d]/g, "")) || 0;
}

function formatWon(value) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function formatSalary(value) {
  return `${(value / 10000).toLocaleString("ko-KR")}만원`;
}

function formatManwon(value) {
  const manwon = Math.round(value / 10000);
  return `${manwon.toLocaleString("ko-KR")}만원`;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatInput(event) {
  const input = event.target;
  input.value = numberFromInput(input.value).toLocaleString("ko-KR");
}

function annualIncomeTax(taxableIncome, dependents) {
  const personalDeduction = Math.max(1, dependents) * 1500000;
  const estimatedDeduction = Math.min(taxableIncome * 0.32, 18000000);
  const taxBase = Math.max(0, taxableIncome - personalDeduction - estimatedDeduction);
  const bracket = brackets.find(([limit]) => taxBase <= limit);
  return Math.max(0, taxBase * bracket[1] - bracket[2]);
}

function calcInsurance(base) {
  const pension = base * rates.pension;
  const health = base * rates.health;
  const care = health * rates.care;
  const employment = base * rates.employment;
  return { pension, health, care, employment };
}

function sumValues(values) {
  return Object.values(values).reduce((total, value) => total + value, 0);
}

function calcMonthlySalary(annualSalary, taxFreeMonthly = 200000, dependents = 1, withholdingRate = 1) {
  const monthlyGross = annualSalary / 12;
  const taxableMonthly = Math.max(0, monthlyGross - taxFreeMonthly);
  const taxableAnnual = taxableMonthly * 12;
  const insurance = calcInsurance(monthlyGross);
  const insuranceTotal = sumValues(insurance);
  const incomeTax = (annualIncomeTax(taxableAnnual, dependents) / 12) * withholdingRate;
  const localTax = incomeTax * 0.1;
  const deductionTotal = insuranceTotal + incomeTax + localTax;
  const net = Math.max(0, monthlyGross - deductionTotal);

  return {
    gross: monthlyGross,
    insurance,
    insuranceTotal,
    incomeTax,
    localTax,
    deductionTotal,
    net,
  };
}

function render(result) {
  const deductionTotal = result.insuranceTotal + result.incomeTax + result.localTax;
  const net = Math.max(0, result.gross - deductionTotal);

  if (els.heroNet) {
    els.heroNet.textContent = activeMode === "salary" ? formatWon(net) : formatWon(result.bonusNet || net);
  }
  els.netPay.textContent = activeMode === "salary" ? formatWon(net) : formatWon(result.bonusNet || net);
  els.resultSub.textContent = activeMode === "salary" ? "월 급여 기준" : "성과급 1회 지급 기준";
  els.monthlyGross.textContent = formatWon(result.gross);
  els.totalDeduction.textContent = formatWon(deductionTotal);
  els.deductionRatio.textContent = formatPercent(result.gross ? deductionTotal / result.gross : 0);
  els.pension.textContent = formatWon(result.insurance.pension);
  els.health.textContent = formatWon(result.insurance.health);
  els.care.textContent = formatWon(result.insurance.care);
  els.employment.textContent = formatWon(result.insurance.employment);
  els.incomeTax.textContent = formatWon(result.incomeTax);
  els.localTax.textContent = formatWon(result.localTax);
}

function calculateSalary() {
  const annualSalary = numberFromInput(els.annualSalary.value);
  const taxFreeMonthly = numberFromInput(els.taxFreeMonthly.value);
  const dependents = Number(els.dependents.value) || 1;
  const withholdingRate = Number(els.withholdingRate.value) || 1;

  render(calcMonthlySalary(annualSalary, taxFreeMonthly, dependents, withholdingRate));
}

function calculateBonus() {
  const bonus = numberFromInput(els.bonusAmount.value);
  const taxableAnnual = numberFromInput(els.taxableAnnual.value);
  const dependents = Number(els.dependents.value) || 1;
  const beforeTax = annualIncomeTax(Math.max(0, taxableAnnual - bonus), dependents);
  const afterTax = annualIncomeTax(taxableAnnual, dependents);
  const incomeTax = Math.max(0, afterTax - beforeTax);
  const localTax = incomeTax * 0.1;
  const insurance = els.includeBonusInsurance.checked ? calcInsurance(bonus) : { pension: 0, health: 0, care: 0, employment: 0 };
  const insuranceTotal = sumValues(insurance);

  render({
    gross: bonus,
    insurance,
    insuranceTotal,
    incomeTax,
    localTax,
    bonusNet: Math.max(0, bonus - insuranceTotal - incomeTax - localTax),
  });
}

function calculate() {
  if (activeMode === "salary") {
    calculateSalary();
    return;
  }
  calculateBonus();
}

function renderSalaryTable() {
  if (!els.salaryTableBody) return;

  els.salaryTableBody.innerHTML = tableSalaries
    .map((salary) => {
      const result = calcMonthlySalary(salary);
      const taxTotal = result.incomeTax + result.localTax;

      return `
        <tr>
          <th scope="row">${formatSalary(salary)}</th>
          <td>${formatWon(result.net)}</td>
          <td>${formatWon(result.gross)}</td>
          <td>${formatWon(result.insuranceTotal + taxTotal)}</td>
          <td>${formatWon(result.insurance.pension)}</td>
          <td>${formatWon(result.insurance.health)}</td>
          <td>${formatWon(result.insurance.care)}</td>
          <td>${formatWon(result.insurance.employment)}</td>
          <td>${formatWon(result.incomeTax)}</td>
          <td>${formatWon(result.localTax)}</td>
        </tr>
      `;
    })
    .join("");
}

function setMode(mode) {
  activeMode = mode;
  const isSalary = mode === "salary";
  els.salaryTab.classList.toggle("active", isSalary);
  els.bonusTab.classList.toggle("active", !isSalary);
  els.salaryTab.setAttribute("aria-selected", String(isSalary));
  els.bonusTab.setAttribute("aria-selected", String(!isSalary));
  els.salaryPanel.hidden = !isSalary;
  els.bonusPanel.hidden = isSalary;
  els.salaryPanel.classList.toggle("active", isSalary);
  els.bonusPanel.classList.toggle("active", !isSalary);
  calculate();
}

function insertMainResetButton() {
  const submit = els.form.querySelector('button[type="submit"]');
  if (!submit || els.form.querySelector(".reset-small")) return;

  const row = document.createElement("div");
  row.className = "button-row";
  const reset = document.createElement("button");
  reset.className = "reset-small";
  reset.type = "button";
  reset.textContent = "초기화";

  submit.parentNode.insertBefore(row, submit);
  row.append(reset, submit);

  reset.addEventListener("click", () => {
    els.annualSalary.value = "50,000,000";
    els.taxFreeMonthly.value = "200,000";
    els.dependents.value = "1";
    els.withholdingRate.value = "1";
    els.bonusAmount.value = "10,000,000";
    els.taxableAnnual.value = "58,000,000";
    els.includeBonusInsurance.checked = true;
    calculate();
  });
}

[els.annualSalary, els.taxFreeMonthly, els.bonusAmount, els.taxableAnnual].forEach((input) => {
  input.addEventListener("input", formatInput);
  input.addEventListener("change", calculate);
});

[els.dependents, els.withholdingRate, els.includeBonusInsurance].forEach((input) => {
  input.addEventListener("change", calculate);
});

els.salaryTab.addEventListener("click", () => setMode("salary"));
els.bonusTab.addEventListener("click", () => setMode("bonus"));
els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculate();
});

document.querySelectorAll("[data-mode]").forEach((link) => {
  link.addEventListener("click", () => {
    setMode(link.dataset.mode);
  });
});

renderSalaryTable();
insertMainResetButton();
calculate();
