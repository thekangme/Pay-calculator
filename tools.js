const TAX_BRACKETS = [
  [14000000, 0.06, 0],
  [50000000, 0.15, 1260000],
  [88000000, 0.24, 5760000],
  [150000000, 0.35, 15440000],
  [300000000, 0.38, 19940000],
  [500000000, 0.4, 25940000],
  [1000000000, 0.42, 35940000],
  [Infinity, 0.45, 65940000],
];

const INHERITANCE_TAX_BRACKETS = [
  [100000000, 0.1, 0],
  [500000000, 0.2, 10000000],
  [1000000000, 0.3, 60000000],
  [3000000000, 0.4, 160000000],
  [Infinity, 0.5, 460000000],
];

const RATES = {
  pension: 0.0475,
  health: 0.03595,
  care: 0.1314,
  employment: 0.009,
};

function num(value) {
  return Number(String(value).replace(/[^\d.-]/g, "")) || 0;
}

function won(value) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function taxByBracket(base, brackets = TAX_BRACKETS) {
  const taxable = Math.max(0, base);
  const bracket = brackets.find(([limit]) => taxable <= limit);
  return Math.max(0, taxable * bracket[1] - bracket[2]);
}

function sum(object) {
  return Object.values(object).reduce((total, value) => total + value, 0);
}

function insurance(monthlyPay) {
  const pension = monthlyPay * RATES.pension;
  const health = monthlyPay * RATES.health;
  const care = health * RATES.care;
  const employment = monthlyPay * RATES.employment;
  return { pension, health, care, employment };
}

function fields(form) {
  return [...form.querySelectorAll("[data-field]")].reduce((data, input) => {
    if (input.dataset.kind === "checkbox") {
      data[input.dataset.field] = input.checked ? "yes" : "no";
    } else {
      data[input.dataset.field] = input.dataset.kind === "text" ? input.value : num(input.value);
    }
    return data;
  }, {});
}

function render(main, items) {
  document.querySelector("[data-main-result]").textContent = won(main);
  document.querySelector("[data-breakdown]").innerHTML = items
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${typeof value === "string" ? value : won(value)}</dd></div>`)
    .join("");
}

function payrollMonthly(monthlyPay, taxFree = 200000) {
  const ins = insurance(monthlyPay);
  const annualTaxable = Math.max(0, monthlyPay - taxFree) * 12;
  const estimatedDeduction = Math.min(annualTaxable * 0.32, 18000000);
  const incomeTax = taxByBracket(Math.max(0, annualTaxable - 1500000 - estimatedDeduction)) / 12;
  const localTax = incomeTax * 0.1;
  const deduction = sum(ins) + incomeTax + localTax;
  return { ins, incomeTax, localTax, deduction, net: Math.max(0, monthlyPay - deduction) };
}

const calculators = {
  severance(data) {
    const monthlyAverage = data.monthlyPay + data.annualBonus / 12 + data.annualLeavePay / 12;
    const dailyAvg = monthlyAverage / 30;
    const days = data.months * 30.4167;
    const pay = dailyAvg * 30 * (days / 365);
    render(pay, [["월 환산 평균임금", monthlyAverage], ["일 평균임금", dailyAvg], ["근속일수", days], ["예상 퇴직금", pay]]);
  },
  inheritance(data) {
    const base = Math.max(0, data.asset - data.debt - data.deduction);
    const tax = taxByBracket(base, INHERITANCE_TAX_BRACKETS);
    render(tax, [["과세표준", base], ["산출세액", tax]]);
  },
  gift(data) {
    const deductions = { spouse: 600000000, ascendant: 50000000, minorAscendant: 20000000, descendant: 50000000, relative: 10000000, other: 0 };
    const baseDeduction = deductions[data.relation] || data.deduction || 0;
    const marriageBirth = data.marriageBirth === "yes" && (data.relation === "ascendant" || data.relation === "minorAscendant") ? 100000000 : 0;
    const base = Math.max(0, data.asset - baseDeduction - marriageBirth);
    const tax = taxByBracket(base, INHERITANCE_TAX_BRACKETS);
    render(tax, [["관계별 공제", baseDeduction], ["혼인·출산 추가공제", marriageBirth], ["과세표준", base], ["산출세액", tax]]);
  },
  yearEnd(data) {
    const diff = data.paidTax - data.finalTax;
    render(Math.abs(diff), [[diff >= 0 ? "예상 환급액" : "추가 납부액", Math.abs(diff)], ["결정세액", data.finalTax], ["기납부세액", data.paidTax]]);
  },
  unemployment(data) {
    const daily = data.monthlyPay / 30;
    const lower = 10320 * 8 * 0.8;
    const benefitDay = Math.min(68100, Math.max(lower, daily * 0.6));
    render(benefitDay * data.days, [["1일 지급액", benefitDay], ["지급일수", `${data.days.toLocaleString("ko-KR")}일`], ["월 30일 환산", benefitDay * 30]]);
  },
  weeklyHoliday(data) {
    const holidayHours = Math.min(8, data.hours / 5);
    const pay = data.hourly * holidayHours;
    render(pay, [["주휴시간", `${holidayHours.toLocaleString("ko-KR")}시간`], ["시급", data.hourly], ["주휴수당", pay]]);
  },
  monthlyPay(data) {
    const result = payrollMonthly(data.monthlyPay, data.taxFree);
    render(result.net, [["국민연금", result.ins.pension], ["건강보험", result.ins.health], ["장기요양", result.ins.care], ["고용보험", result.ins.employment], ["소득세", result.incomeTax], ["지방소득세", result.localTax], ["총 공제액", result.deduction]]);
  },
  hourlyWage(data) {
    const holiday = Math.min(8, data.hours / 5);
    const week = data.hourly * (data.hours + holiday);
    render(week * 4.345, [["주급", week], ["주휴수당", data.hourly * holiday], ["월 환산", week * 4.345]]);
  },
  retirementTax(data) {
    const deduction = Math.min(data.amount, data.years * 4000000);
    const base = Math.max(0, (data.amount - deduction) / Math.max(1, data.years) * 12);
    const tax = (taxByBracket(base) / 12) * Math.max(1, data.years);
    render(tax, [["근속연수공제 추정", deduction], ["환산 과세표준", base], ["퇴직소득세 추정", tax]]);
  },
  globalTax(data) {
    const income = taxByBracket(data.taxBase);
    const local = income * 0.1;
    render(income + local, [["소득세", income], ["지방소득세", local], ["합계", income + local]]);
  },
  capitalGains(data) {
    const gain = Math.max(0, data.sale - data.buy - data.cost);
    const holding = Math.max(0, data.holdingYears);
    const living = Math.max(0, data.livingYears);
    const isHouse = data.assetType === "house";
    const oneHouse = isHouse && data.houses === 1 && data.resident === "yes";
    const longTermRate = oneHouse && holding >= 3 ? Math.min(0.8, Math.min(10, holding) * 0.04 + Math.min(10, living) * 0.04) : holding >= 3 ? Math.min(0.3, holding * 0.02) : 0;
    const longTermDeduction = gain * longTermRate;
    const base = Math.max(0, gain - longTermDeduction - 2500000);
    let income = taxByBracket(base);
    const surcharge = isHouse && data.houses >= 2 ? base * (data.houses >= 3 ? 0.3 : 0.2) : 0;
    income += surcharge;
    const local = income * 0.1;
    render(income + local, [["양도차익", gain], ["장기보유특별공제", longTermDeduction], ["과세표준", base], ["중과 추정", surcharge], ["양도소득세", income], ["지방소득세", local]]);
  },
  pension(data) {
    const employee = data.monthlyPay * RATES.pension;
    render(employee, [["근로자 부담", employee], ["사용자 부담", employee], ["총 보험료", employee * 2]]);
  },
  health(data) {
    if (data.subscriberType === "local") {
      const incomeScore = Math.max(0, data.extraIncome / 1000000) * 1.4;
      const health = Math.max(20160, (incomeScore + data.propertyScore) * 208.4);
      const care = health * RATES.care;
      render(health + care, [["소득점수 추정", incomeScore], ["건강보험", health], ["장기요양", care]]);
      return;
    }
    const health = data.monthlyPay * RATES.health + (Math.max(0, data.extraIncome - 20000000) / 12) * 0.0719;
    const care = health * RATES.care;
    render(health + care, [["건강보험", health], ["장기요양", care], ["총 부담액", health + care]]);
  },
  parental(data) {
    let total = 0;
    const months = Math.max(0, Math.min(18, data.months));
    for (let i = 1; i <= months; i += 1) {
      const cap = i <= 3 ? 2500000 : i <= 6 ? 2000000 : 1600000;
      total += Math.min(data.monthlyPay, cap);
    }
    render(total, [["휴직개월", `${months.toLocaleString("ko-KR")}개월`], ["월 통상임금", data.monthlyPay], ["예상 총 급여", total]]);
  },
  basicPension(data) {
    const criteria = data.household === "couple" ? { threshold: 3648000, base: 274010 } : { threshold: 2280000, base: 342510 };
    const baseAssets = { city: 135000000, town: 85000000, rural: 72500000 };
    const earnedEval = Math.max(0, (data.earnedIncome - 1100000) * 0.7);
    const spouseEarnedEval = data.household === "couple" ? Math.max(0, (data.spouseEarned - 1100000) * 0.7) : 0;
    const publicIncome = data.npIncome + data.otherPublicIncome + data.disabilityPension;
    const freeRentIncome = data.freeRentApply === "yes" && data.freeRentValue >= 600000000 ? data.freeRentValue * 0.0078 / 12 : 0;
    const incomeEval = earnedEval + spouseEarnedEval + data.businessIncome + data.rentalIncome + data.interestIncome + publicIncome + data.spouseOther + freeRentIncome;
    const generalAsset = data.assetBuilding + data.assetLand + data.assetDeposit + data.assetOther;
    const generalNet = Math.max(0, generalAsset - (baseAssets[data.region] || baseAssets.town));
    const financialNet = Math.max(0, data.financialAsset - 20000000);
    const debt = data.debtLoan + data.debtDeposit;
    const isLuxuryCar = data.carCC >= 4000 || data.carValue >= 30000000;
    const carAsset = isLuxuryCar ? (data.carLivelihood === "yes" ? data.carValue * 0.5 : data.carValue) : 0;
    const assetBase = Math.max(0, generalNet + financialNet - debt) + data.assetVessel + data.assetMembership + carAsset;
    const assetIncome = assetBase * (0.04 / 12);
    const recognized = incomeEval + assetIncome;
    const eligible = data.age >= 65 && recognized <= criteria.threshold;
    const nationalPensionDeduction = Math.max(0, Math.min(criteria.base * 0.5, (data.npIncome - criteria.base * 1.5) * 0.5));
    let expected = eligible ? Math.max(criteria.base * 0.1, criteria.base - nationalPensionDeduction) : 0;
    if (eligible && data.household === "couple" && data.spouseApply === "yes") {
      expected *= 0.8;
    }
    render(expected, [
      ["수급 가능성", eligible ? "가능성 있음" : "기준 초과 또는 연령 미달"],
      ["소득평가액", incomeEval],
      ["재산 소득환산액", assetIncome],
      ["일반재산 합계", generalAsset],
      ["금융재산 공제 후", financialNet],
      ["부채 차감", debt],
      ["고급자동차 반영액", carAsset],
      ["소득인정액", recognized],
      ["선정기준액", criteria.threshold],
    ]);
  },
};

const menuLinks = [
  ["./index.html#calculator", "연봉 실수령액"],
  ["./index.html#calculator", "성과급 세금"],
  ["./index.html#salary-table", "연봉표"],
  ["./severance.html", "퇴직금"],
  ["./inheritance-tax.html", "상속세"],
  ["./gift-tax.html", "증여세"],
  ["./year-end-tax.html", "연말정산"],
  ["./unemployment.html", "실업급여"],
  ["./weekly-holiday.html", "주휴수당"],
  ["./monthly-pay.html", "월급 계산기"],
  ["./hourly-wage.html", "시급 계산기"],
  ["./retirement-income-tax.html", "퇴직소득세"],
  ["./global-income-tax.html", "종합소득세"],
  ["./capital-gains-tax.html", "양도소득세"],
  ["./national-pension.html", "국민연금"],
  ["./health-insurance.html", "건강보험"],
  ["./parental-leave.html", "육아휴직급여"],
  ["./basic-pension.html", "기초연금"],
];

function insertToolMenu() {
  const main = document.querySelector("[data-calculator]");
  const hero = document.querySelector(".hero");
  if (!main || !hero || document.querySelector(".tool-menu-band")) return;

  const current = location.pathname.split("/").pop();
  const links = menuLinks
    .map(([href, label]) => `<a href="${href}"${href.endsWith(current) ? ' class="active"' : ""}>${label}</a>`)
    .join("");

  hero.insertAdjacentHTML(
    "afterend",
    `<section class="tool-menu-band" aria-label="계산기 전체 메뉴"><nav class="calculator-menu">${links}</nav></section>`
  );
}

function insertResetButton(form) {
  const submit = form.querySelector('button[type="submit"]');
  if (!submit || form.querySelector(".reset-small")) return;

  const row = document.createElement("div");
  row.className = "button-row";
  const reset = document.createElement("button");
  reset.className = "reset-small";
  reset.type = "button";
  reset.textContent = "초기화";

  submit.parentNode.insertBefore(row, submit);
  row.append(reset, submit);

  reset.addEventListener("click", () => {
    form.querySelectorAll("[data-field]").forEach((input) => {
      if (input.tagName === "SELECT") {
        input.selectedIndex = 0;
      } else if (input.type === "checkbox") {
        input.checked = input.defaultChecked;
      } else if (input.type === "number") {
        input.value = input.defaultValue || "";
      } else {
        input.value = "";
      }
    });
    calculators[type](fields(form));
  });
}

const form = document.querySelector(".tool-form");
const type = document.querySelector("[data-calculator]")?.dataset.calculator;

if (form && calculators[type]) {
  insertToolMenu();
  insertResetButton(form);

  form.querySelectorAll("[data-field]").forEach((input) => {
    if (input.inputMode === "numeric") {
      input.addEventListener("input", () => {
        const cleaned = String(input.value).replace(/[^\d]/g, "");
        input.value = cleaned ? Number(cleaned).toLocaleString("ko-KR") : "";
      });
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    calculators[type](fields(form));
  });

  calculators[type](fields(form));
}

if (!document.querySelector("footer")) {
  document.body.insertAdjacentHTML(
    "beforeend",
    '<footer><p>계산 결과는 참고용 추정치입니다. 실제 신고·지급 전에는 관계기관 또는 전문가 확인이 필요합니다.</p><p><a href="./about.html">소개</a> · <a href="./privacy.html">개인정보처리방침</a> · <a href="./contact.html">문의</a></p></footer>'
  );
}
