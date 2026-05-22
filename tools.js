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

const TRANSFER_TAX_BRACKETS = TAX_BRACKETS;

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

function taxByBracket(base) {
  const taxable = Math.max(0, base);
  const bracket = TAX_BRACKETS.find(([limit]) => taxable <= limit);
  return Math.max(0, taxable * bracket[1] - bracket[2]);
}

function taxByCustomBracket(base, brackets) {
  const taxable = Math.max(0, base);
  const bracket = brackets.find(([limit]) => taxable <= limit);
  return Math.max(0, taxable * bracket[1] - bracket[2]);
}

function insurance(monthlyPay) {
  const pension = monthlyPay * RATES.pension;
  const health = monthlyPay * RATES.health;
  const care = health * RATES.care;
  const employment = monthlyPay * RATES.employment;
  return { pension, health, care, employment };
}

function sum(object) {
  return Object.values(object).reduce((total, value) => total + value, 0);
}

function fields(form) {
  return [...form.querySelectorAll("[data-field]")].reduce((data, input) => {
    data[input.dataset.field] = input.dataset.kind === "text" ? input.value : num(input.value);
    return data;
  }, {});
}

function render(main, items) {
  document.querySelector("[data-main-result]").textContent = won(main);
  document.querySelector("[data-breakdown]").innerHTML = items
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${won(value)}</dd></div>`)
    .join("");
}

function payrollMonthly(monthlyPay, taxFree = 200000) {
  const ins = insurance(monthlyPay);
  const annualTaxable = Math.max(0, monthlyPay - taxFree) * 12;
  const incomeTax = taxByBracket(Math.max(0, annualTaxable - 1500000 - Math.min(annualTaxable * 0.32, 18000000))) / 12;
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
    const tax = taxByCustomBracket(base, INHERITANCE_TAX_BRACKETS);
    render(tax, [["과세표준", base], ["산출세액", tax], ["지방세", 0]]);
  },
  gift(data) {
    const deductions = {
      spouse: 600000000,
      ascendant: 50000000,
      minorAscendant: 20000000,
      descendant: 50000000,
      relative: 10000000,
      other: 0,
    };
    const baseDeduction = deductions[data.relation] || 0;
    const marriageBirth = data.marriageBirth === "yes" && (data.relation === "ascendant" || data.relation === "minorAscendant") ? 100000000 : 0;
    const deduction = baseDeduction + marriageBirth;
    const base = Math.max(0, data.asset - deduction);
    const tax = taxByCustomBracket(base, INHERITANCE_TAX_BRACKETS);
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
    render(benefitDay * data.days, [["1일 지급액", benefitDay], ["지급일수", data.days], ["월 30일 환산", benefitDay * 30]]);
  },
  weeklyHoliday(data) {
    const holidayHours = Math.min(8, data.hours / 5);
    const pay = data.hourly * holidayHours;
    render(pay, [["주휴시간", holidayHours], ["시급", data.hourly], ["주휴수당", pay]]);
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
    const tax = taxByBracket(base) / 12 * Math.max(1, data.years);
    render(tax, [["근속연수공제 추정", deduction], ["환산 과세표준", base], ["퇴직소득세 추정", tax]]);
  },
  globalTax(data) {
    const income = taxByBracket(data.taxBase);
    const local = income * 0.1;
    render(income + local, [["소득세", income], ["지방소득세", local], ["합계", income + local]]);
  },
  capitalGains(data) {
    const gain = Math.max(0, data.sale - data.buy - data.cost);
    const isHouse = data.assetType === "house";
    const holding = Math.max(0, data.holdingYears);
    const living = Math.max(0, data.livingYears);
    let longTermRate = 0;
    if (data.resident === "yes" && isHouse && data.houses === 1 && holding >= 3) {
      longTermRate = Math.min(0.8, Math.min(10, holding) * 0.04 + Math.min(10, living) * 0.04);
    } else if (holding >= 3) {
      longTermRate = Math.min(0.3, holding * 0.02);
    }
    const longTermDeduction = gain * longTermRate;
    const base = Math.max(0, gain - longTermDeduction - 2500000);
    let income = taxByCustomBracket(base, TRANSFER_TAX_BRACKETS);
    let surcharge = 0;
    if (isHouse && data.houses >= 2) surcharge += base * 0.2;
    if (isHouse && data.houses >= 3) surcharge += base * 0.1;
    if (data.resident === "no") surcharge += base * 0.1;
    if (data.permitZone === "yes") surcharge += 0;
    income += surcharge;
    const local = income * 0.1;
    render(income + local, [["양도차익", gain], ["장기보유특별공제", longTermDeduction], ["과세표준", base], ["중과 가산 추정", surcharge], ["양도소득세", income], ["지방소득세", local]]);
  },
  pension(data) {
    const employee = data.monthlyPay * RATES.pension;
    render(employee, [["근로자 부담", employee], ["사용자 부담", employee], ["총 보험료", employee * 2]]);
  },
  health(data) {
    if (data.subscriberType === "local") {
      const incomeScore = Math.max(0, data.extraIncome / 1000000) * 1.4;
      const totalScore = incomeScore + data.propertyScore;
      const health = Math.max(20160, totalScore * 208.4);
      const care = health * RATES.care;
      render(health + care, [["소득점수 추정", incomeScore], ["재산점수", data.propertyScore], ["건강보험", health], ["장기요양", care], ["최저보험료 반영", 20160]]);
      return;
    }
    const baseHealth = data.monthlyPay * RATES.health;
    const extraMonthly = Math.max(0, data.extraIncome - 20000000) / 12;
    const extraHealth = extraMonthly * 0.0719;
    const health = baseHealth + extraHealth;
    const care = health * RATES.care;
    render(health + care, [["보수월액 건강보험", baseHealth], ["보수 외 소득월액", extraHealth], ["장기요양", care], ["총 부담액", health + care]]);
  },
  parental(data) {
    let total = 0;
    const months = Math.max(0, Math.min(18, data.months));
    for (let i = 1; i <= months; i += 1) {
      const cap = i <= 3 ? 2500000 : i <= 6 ? 2000000 : 1600000;
      total += Math.min(data.monthlyPay, cap);
    }
    render(total, [["휴직개월", months], ["월 통상임금", data.monthlyPay], ["예상 총 급여", total]]);
  },
};

const menuLinks = [
  ["../index.html#calculator", "연봉"],
  ["../index.html#calculator", "성과급"],
  ["../index.html#salary-table", "연봉표"],
  ["./severance.html", "퇴직금"],
  ["./inheritance-tax.html", "상속세"],
  ["./gift-tax.html", "증여세"],
  ["./year-end-tax.html", "연말정산"],
  ["./unemployment.html", "실업급여"],
  ["./weekly-holiday.html", "주휴수당"],
  ["./monthly-pay.html", "월급"],
  ["./hourly-wage.html", "시급"],
  ["./retirement-income-tax.html", "퇴직소득세"],
  ["./global-income-tax.html", "종합소득세"],
  ["./capital-gains-tax.html", "양도소득세"],
  ["./national-pension.html", "국민연금"],
  ["./health-insurance.html", "건강보험"],
  ["./parental-leave.html", "육아휴직"],
];

const methodNotes = {
  severance: {
    title: "퇴직금 계산방식",
    body: "월 기본급·수당에 연간 상여금과 연차수당을 12개월로 나눈 금액을 더해 월 환산 평균임금을 구합니다. 이후 일 평균임금 × 30일 × 근속일수 ÷ 365로 예상 퇴직금을 계산합니다.",
  },
  inheritance: {
    title: "상속세 세율 계산방법",
    body: `<p>상속재산에서 채무와 상속공제를 차감해 과세표준을 구한 뒤 10~50% 누진세율과 누진공제를 적용합니다.</p>
      <div class="table-wrap"><table class="info-table"><thead><tr><th>구분</th><th>공제·상속 순위</th><th>메모</th></tr></thead><tbody>
      <tr><td>배우자</td><td>배우자상속공제 적용</td><td>실제 상속분, 최소·최대 한도 검토 필요</td></tr>
      <tr><td>직계비속</td><td>1순위</td><td>자녀·손자녀, 자녀공제 등 인적공제 검토</td></tr>
      <tr><td>직계존속</td><td>2순위</td><td>부모·조부모, 직계비속이 없을 때 상속인</td></tr>
      <tr><td>형제자매</td><td>3순위</td><td>직계존비속이 없을 때 상속인</td></tr>
      <tr><td>4촌 이내 방계혈족</td><td>4순위</td><td>삼촌·고모·이모·사촌 등</td></tr>
      </tbody></table></div>
      <div class="table-wrap"><table class="info-table"><thead><tr><th>과세표준</th><th>세율</th><th>누진공제</th></tr></thead><tbody>
      <tr><td>1억원 이하</td><td>10%</td><td>0원</td></tr><tr><td>5억원 이하</td><td>20%</td><td>1,000만원</td></tr><tr><td>10억원 이하</td><td>30%</td><td>6,000만원</td></tr><tr><td>30억원 이하</td><td>40%</td><td>1억6,000만원</td></tr><tr><td>30억원 초과</td><td>50%</td><td>4억6,000만원</td></tr>
      </tbody></table></div>`,
  },
  gift: {
    title: "증여세 세율 계산방법",
    body: `<p>증여금액에서 관계별 증여재산공제를 뺀 뒤 10~50% 누진세율을 적용합니다. 공제는 10년 합산 기준입니다.</p>
      <div class="table-wrap"><table class="info-table"><thead><tr><th>관계</th><th>기본 공제</th><th>혼인·출산 공제</th></tr></thead><tbody>
      <tr><td>배우자</td><td>6억원</td><td>해당 없음</td></tr><tr><td>직계존속 → 성년 자녀</td><td>5,000만원</td><td>요건 충족 시 추가 1억원, 합계 최대 1.5억원</td></tr><tr><td>직계존속 → 미성년자</td><td>2,000만원</td><td>요건 충족 시 추가 1억원</td></tr><tr><td>직계비속</td><td>5,000만원</td><td>해당 없음</td></tr><tr><td>기타친족</td><td>1,000만원</td><td>해당 없음</td></tr>
      </tbody></table></div>
      <div class="table-wrap"><table class="info-table"><thead><tr><th>과세표준</th><th>세율</th><th>누진공제</th></tr></thead><tbody>
      <tr><td>1억원 이하</td><td>10%</td><td>0원</td></tr><tr><td>5억원 이하</td><td>20%</td><td>1,000만원</td></tr><tr><td>10억원 이하</td><td>30%</td><td>6,000만원</td></tr><tr><td>30억원 이하</td><td>40%</td><td>1억6,000만원</td></tr><tr><td>30억원 초과</td><td>50%</td><td>4억6,000만원</td></tr>
      </tbody></table></div>`,
  },
  yearEnd: {
    title: "연말정산 계산방식",
    body: "결정세액과 기납부세액을 비교해 환급 또는 추가납부 예상액을 계산합니다. 신용카드, 보험료, 의료비, 교육비 등 세액공제 항목은 별도 반영이 필요합니다.",
  },
  unemployment: {
    title: "실업급여 계산방식",
    body: "퇴직 전 평균임금의 60%를 1일 구직급여액으로 보고, 법정 상한액과 최저임금 기반 하한액을 적용한 뒤 지급일수를 곱합니다.",
  },
  weeklyHoliday: {
    title: "주휴수당 계산방식",
    body: "2026년 최저시급은 10,320원입니다. 주 15시간 이상 근무 등 요건을 전제로, 1주 소정근로시간을 기준으로 주휴시간을 산정하고 시급을 곱합니다. 주 40시간 이상은 통상 8시간분을 적용합니다.",
  },
  monthlyPay: {
    title: "월급 실수령액 계산방식",
    body: "월급에서 국민연금, 건강보험, 장기요양보험, 고용보험과 소득세·지방소득세를 차감합니다. 비과세액은 소득세 계산 대상에서 제외합니다.",
  },
  hourlyWage: {
    title: "시급 계산방식",
    body: "2026년 최저시급은 10,320원입니다. 시급에 주 근무시간과 주휴시간을 더해 주급을 계산하고, 월 평균 주수 4.345를 곱해 월 환산액을 계산합니다.",
  },
  retirementTax: {
    title: "퇴직소득세 계산방식",
    body: "퇴직소득세는 근속연수공제와 환산급여 방식이 적용됩니다. 이 페이지는 근속연수에 따른 공제와 누진세율을 활용한 간이 추정 방식입니다.",
  },
  globalTax: {
    title: "종합소득세 세율 계산방법",
    body: `<p>과세표준에 6~45% 누진세율과 누진공제를 적용하고, 산출 소득세의 10%를 지방소득세로 더합니다.</p>
      <div class="table-wrap"><table class="info-table"><thead><tr><th>과세표준</th><th>세율</th><th>누진공제</th></tr></thead><tbody>
      <tr><td>1,400만원 이하</td><td>6%</td><td>0원</td></tr><tr><td>5,000만원 이하</td><td>15%</td><td>126만원</td></tr><tr><td>8,800만원 이하</td><td>24%</td><td>576만원</td></tr><tr><td>1억5,000만원 이하</td><td>35%</td><td>1,544만원</td></tr><tr><td>3억원 이하</td><td>38%</td><td>1,994만원</td></tr><tr><td>5억원 이하</td><td>40%</td><td>2,594만원</td></tr><tr><td>10억원 이하</td><td>42%</td><td>3,594만원</td></tr><tr><td>10억원 초과</td><td>45%</td><td>6,594만원</td></tr>
      </tbody></table></div>`,
  },
  capitalGains: {
    title: "양도소득세 세율 계산방법",
    body: `<p>양도차익에서 장기보유특별공제와 기본공제를 차감한 뒤 누진세율을 적용합니다. 주택 수, 비거주자, 토지거래허가구역, 단기보유 여부는 비과세·중과 판단에 영향을 줍니다.</p>
      <div class="table-wrap"><table class="info-table"><thead><tr><th>항목</th><th>반영 방식</th></tr></thead><tbody>
      <tr><td>주택 수</td><td>2주택 이상은 중과 추정액을 별도 표시</td></tr><tr><td>비거주자</td><td>비과세·장기보유공제 제한 가능성을 보수적으로 반영</td></tr><tr><td>장기보유특별공제</td><td>1주택 거주자는 보유·거주기간을 합산해 최대 80%, 일반 자산은 최대 30% 추정</td></tr><tr><td>토지거래허가구역</td><td>실거주·허가 요건 검토가 필요하므로 유의 항목으로 표시</td></tr>
      </tbody></table></div>`,
  },
  pension: {
    title: "국민연금 계산방식",
    body: "월 기준소득에 근로자 부담률 4.75%를 곱해 근로자 부담액을 계산합니다. 실제 부과는 기준소득월액 상·하한의 영향을 받습니다.",
  },
  health: {
    title: "건강보험 계산방식",
    body: `<p>직장가입자는 월 보수에 근로자 부담률 3.595%를 적용하고, 건강보험료에 장기요양보험료율 13.14%를 곱합니다. 보수 외 연소득 2,000만원 초과분은 소득월액 보험료 추정액으로 표시합니다.</p>
      <div class="table-wrap"><table class="info-table"><thead><tr><th>구분</th><th>계산 기준</th></tr></thead><tbody>
      <tr><td>직장가입자 건강보험</td><td>월 보수 × 3.595%</td></tr><tr><td>장기요양보험</td><td>건강보험료 × 13.14%</td></tr><tr><td>보수 외 소득월액</td><td>연 2,000만원 초과분 ÷ 12 × 7.19%</td></tr><tr><td>지역가입자 최저보험료</td><td>간이 계산에서 월 20,160원 하한 표시</td></tr>
      </tbody></table></div>`,
  },
  parental: {
    title: "육아휴직급여 계산방식",
    body: "월 통상임금을 기준으로 개월별 상한액을 적용해 합산합니다. 부모 동시 사용, 사후지급금, 제도 변경 여부에 따라 실제 지급액은 달라질 수 있습니다.",
  },
};

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
    `<section class="menu-band tool-menu-band" aria-label="전체 계산기 메뉴"><nav class="calculator-menu">${links}</nav></section>`
  );
}

function insertMethodNote(type) {
  const main = document.querySelector("[data-calculator]");
  const note = methodNotes[type];
  if (!main || !note || document.querySelector(".method-box")) return;

  main.insertAdjacentHTML(
    "beforeend",
    `<article class="article-box method-box"><h2>${note.title}</h2>${note.body.startsWith("<") ? note.body : `<p>${note.body}</p>`}</article>`
  );
}

const form = document.querySelector(".tool-form");
const type = document.querySelector("[data-calculator]")?.dataset.calculator;

if (form && calculators[type]) {
  insertToolMenu();
  insertMethodNote(type);

  form.querySelectorAll("[data-field]").forEach((input) => {
    if (input.inputMode === "numeric") {
      input.addEventListener("input", () => {
        input.value = num(input.value).toLocaleString("ko-KR");
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
    '<footer><p>계산 결과는 참고용 추정치입니다. 실제 신고·지급 전에는 관계기관 또는 전문가 확인이 필요합니다.</p><p><a href="../about.html">소개</a> · <a href="../privacy.html">개인정보처리방침</a> · <a href="../contact.html">문의</a></p></footer>'
  );
}
