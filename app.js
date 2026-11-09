// ===== CONFIG =====
// ENDPOINT = Google Apps Script web app URL | TOKEN = shared secret (must match Code.gs)
// QK = phone storage key for audits waiting to upload | DK = phone storage key for the saved draft
const ENDPOINT =
    "https://script.google.com/macros/s/AKfycbxXOYsqSTfuj9yg1RVszJnhraako57Oa6SuOXbdZaHtY4SFB7fqA8J8YW4j4DewihDp9w/exec",
  TOKEN = "FY2627_IAbranchAudit",
  QK = "storeAuditQueue_v1",
  DK = "storeAuditDraft_v1";
// EDIT THESE LISTS to match your branches and auditors
const BRANCHES = [
  "001 - Orangewalk",
  "002 - Corozal",
  "003 - San Pedro",
  "004 - San Ignacio",
  "005 - Belmopan",
  "006 - Caye Caulker",
  "007 - Flagship",
  "008 - Ladyville",
  "009 - Signature",
  "010 - Punta Gorda",
  "011 - Independence",
  "012 - Dangriga",
  "013 - Placencia",
];
const AUDITORS = [
  "Mario Quiroz",
  "Annel Lemus",
  "Stephanie Hall",
  "Timothy Uwaje",
  "Freddy Martinez",
  "Amaury Samos",
  "Lupita Blanco",
];
const AUDITOR_THEMES = {
  "Amaury Samos": {
    brand: "#0f2548",
    brand2: "#1f3864",
    accent: "#06b6d4",
  },
  "Lupita Blanco": {
    brand: "#3b0764",
    brand2: "#6b21a8",
    accent: "#c084fc",
  },
};

// Shortcut: $('x') means document.getElementById('x')
const $ = (id) => document.getElementById(id);
// D = the whole form state (every answer). Saved to the phone after each change so nothing is lost on refresh.
let D = {};
try {
  D = JSON.parse(localStorage.getItem(DK) || "{}");
} catch (e) {}
if (!D._inv || !D._inv.length) D._inv = [{}];
if (!D._emp || !D._emp.length) D._emp = [{}];
if (!D.cashCounts) D.cashCounts = [];
// Saves D to the phone's localStorage (the draft)
const save = () => {
  try {
    localStorage.setItem(DK, JSON.stringify(D));
  } catch (e) {}
};
// Sample inventory list kept for reference (the list actually used is in loadInventory())
const SAMPLE_INVENTORY = [
  {
    sku: "125156",
    item: "WIFI 6 MESH VILO SYSTEM",
    stock: 19,
  },
  {
    sku: "750053C",
    item: "SAMSUNG S25 ULTRA 512GB CELL GSM",
    stock: 1,
  },
  {
    sku: "750074C",
    item: "TCL 55 CLASS S4 4K UHD HDR SMART TV",
    stock: 2,
  },
  {
    sku: "USIM",
    item: "USIM",
    stock: 1174,
  },
];
// Observation questions shown as a dropdown (marker #): question text -> options
const DROPDOWNS = {
  "Sr. performs random checks, twice per month on each rep": [
    "Weekly",
    "Bi-Weekly",
    "Monthly",
    "More than 2 Months Ago",
  ],
  "Sr. performs monthly checks on their own cash": [
    "Weekly",
    "Bi-Weekly",
    "Monthly",
    "More than 2 Months Ago",
  ],
  "Zone Admin visits regularly and does a physical count of cash and signs off with Senior and Zone Admin":
    ["Weekly", "Bi-Weekly", "Monthly", "More than 2 Months Ago"],
  "Deposits are complete and done on the same day (with the exception of Ladyville which is WEEKLY and Caye Caulker which is TWICE A WEEK)":
    ["Daily", "Twice a Week", "Weekly"],
  "Credit Card Machines are settled Daily (when applicable) and settlement slips are attached to the Daily Collections Report":
    ["Daily", "Twice a Week", "Weekly"],
  "Stock room is neat and organized to facilitate a smooth inventory count": [
    "Yes",
    "No",
    "No Stock room, items in vault/Office",
  ],
  "Agreements for incoming and outgoing stock are signed by receiver/dispatcher and filed":
    ["Yes", "No", "Email/E-Copy"],
  "Random inventory count checks are done and count sheets inspected": [
    "Weekly",
    "Bi-Weekly",
    "Monthly",
    "More than 2 Months Ago",
  ],
  "Stock take report for previous month provided by the 10th, no material variances":
    ["Weekly", "Bi-Weekly", "Monthly", "More than 2 Months Ago"],
  "Zone admin does quarterly full stock take and sample stock take of high-end phones and SIMs every visit":
    ["Weekly", "Bi-Weekly", "Monthly", "Quarterly", "None"],
};
// OBSERVATIONS worksheet. Each block = [group title, ...questions].
// A marker in front of the question text decides the answer type:
//   $ = number   @ = date   = = auto-calculated variance (previous line minus the one before it)
//   ? = Yes/No buttons   ! = Yes/No, comment REQUIRED when No   # = dropdown (see DROPDOWNS)   (none) = free text
const OBS = [
  [
    "Petty Cash",
    "$Petty Cash indicated by Stores ($)",
    "$Petty Cash reconciliation amount ($)",
    "=Petty Cash variance",
    "!Was the petty cash count balanced? If not, indicate whether the variance is material or immaterial",
    "?Petty Cash payments consist of payments to vendors, refund of deposits, refund of installation and change",
    "!Monthly replenishment of Petty Cash is done",
    "@Last date of Petty Cash replenishment",
    "$DigiWallet float, physical cash ($)",
    "$DigiWallet float reconciled amount ($)",
    "=DigiWallet float variance",
  ],
  [
    "Cash Handling",
    "#Sr. performs random checks, twice per month on each rep",
    "#Sr. performs monthly checks on their own cash",
    "!Only the Sr. in charge has access to the vault",
    "CSR cash floats are $100 and Cashier cash float is $200",
    "#Zone Admin visits regularly and does a physical count of cash and signs off with Senior and Zone Admin",
    "?Vouchers consist of small payments to vendors, refund deposits, refund of installation, change and other miscellaneous purchases",
    "?Vouchers from previous months are still outstanding payment or account allocation",
    "?Receipts are attached to vouchers (where applicable)",
    "?Vouchers are signed by authorizer",
    "?Vouchers are signed by receiver",
  ],
  [
    "Store Mgmt: Balancing, Oversight & Monitoring",
    "?There is a controlled adjustment process and adjustment reports are reviewed",
    "?All monitoring reports reviewed by the Zone Admin/Senior",
    "?System generated receipt is attached to manual receipts",
    "#Deposits are complete and done on the same day (with the exception of Ladyville which is WEEKLY and Caye Caulker which is TWICE A WEEK)",
    "?Deposit Slips contain the depositor Signature and are attached to the Daily Collections Report",
    "#Credit Card Machines are settled Daily (when applicable) and settlement slips are attached to the Daily Collections Report",
    "?Cash shortages are investigated and reason is stated in the Daily Collections Report",
    "?Voided Reports are signed by requestor, valid reason for voiding is stated in the report, report is signed by the BTL Rep and Signed and Dated by staff who completed the form",
    "?Manual Receipt books are kept in the vault, used only when necessary and electronic receipt is attached to the carbon copy of the receipts",
    "?Each CSR has their own specific manual receipt book assigned and is used until all receipts are depleted.",
  ],
  [
    "Vault Management",
    "Log of vault access",
    "Cash fund tracking in vault",
    "Vault code for each individual accessing the vault",
  ],
  [
    "Daily Collection Review",
    "Prior week: end of day reports and reconciliation of cash collected, including voided supports",
  ],
  [
    "Inventory Management Monitoring",
    "?Physical inventory counted agrees to inventory stock listing (100% for small locations)",
    "#Stock room is neat and organized to facilitate a smooth inventory count",
    "#Agreements for incoming and outgoing stock are signed by receiver/dispatcher and filed",
    "#Random inventory count checks are done and count sheets inspected",
    "#Stock take report for previous month provided by the 10th, no material variances",
    "#Zone admin does quarterly full stock take and sample stock take of high-end phones and SIMs every visit",
    "Adequate stock levels to meet customer demand",
    "?Stock take performed by branch: one day selected, evidence in file",
  ],
  [
    "Store Maintenance & Marketing",
    "!Store (front office) is kept clean and tidy",
    "!Marketing is up-to-date with adequate branding and advertising collateral",
    "?Staff is knowledgeable about current promotions",
    "!Proper lighting around the store",
    "!Back office is clean and tidy",
    "!Staff facilities are adequate and clean; restroom and water available",
    "?Emergency exits clearly defined and well lit, no obstruction",
    "!Ceiling tiles are clean, no mold",
    "!Air conditioners functional, no leaks that can cause a fall",
    "?Wet Floor signage available",
    "!No Smoking signs displayed near fuel tanks and in store",
  ],
  [
    "DigiWallet & DigiTV",
    "?Staff is knowledgeable about DigiWallet promotions",
    "Risk identified and/or issues faced",
    "Other comments",
  ],
];
// FINDINGS checklist. Each block = [section title, ...questions]. Answers: Yes = finding observed, No = not observed, NR = area not reviewed
const FIN = [
  [
    "SECURITY",
    "Panic Buttons: alert buttons were tested and were not working",
    "Panic Buttons: no response from the monitor room when the panic button was activated",
    "Surveillance camera does not adequately cover entire area",
    "Surveillance cameras are not monitored by zone admin or senior at the back office",
    "The branch does not have a Vault/Safe",
    "CSRs do not have an appropriate drawer lock and cash trays",
    "Staff members do not have unique alarm code",
    "The branch does not have a safe method of daily cash deposit",
    "Branch fire extinguishers are not readily visible and accessible",
    "Fire extinguishers have not been recently serviced",
    "Staff have not been trained in fire extinguisher use",
    "Staff have not been trained in robbery preparedness and other emergency protocols",
    "The compound fence is not properly maintained",
  ],
  [
    "TOWER AND MAINTENANCE",
    "Tower is NOT in good physical condition",
    "Signs of damage to antennas and equipment on tower observed",
    "Power supply is NOT adequately secured",
    "Grounding for tower is NOT in good condition",
    "Exchange location is NOT adequately maintained inside and outside compound",
    "Exchange is NOT properly secured by fencing and locked gate",
    "Last maintenance conducted (obtain from Manager)",
    "Fire extinguisher NOT observed at exchange",
    "Material at exchange is NOT secured and in good condition",
    "Store is NOT adequately maintained",
  ],
  [
    "CASH & CASH HANDLING",
    "Petty cash reconciliation was NOT completed within the month",
    "Petty cash did NOT balance (material/immaterial differences)",
    "CSR cash did NOT balance (material/immaterial differences)",
    "DigiWallet (physical/digital cash) did NOT balance (material/immaterial difference)",
    "Senior does NOT perform random checks on CSRs",
    "Senior does NOT perform monthly checks on their own cash",
    "Senior is NOT the only one who has vault access",
    "Zone Admin does NOT perform regular visits, physical count of cash and review of reports",
    "Vouchers are NOT signed by authorizer",
    "Receipts are NOT signed by receiver",
    "Deposit slips are NOT signed by the depositor or attached to the Daily Collection Report",
    "Credit card machines are NOT settled daily",
  ],
  [
    "INVENTORY",
    "Inventory count did NOT agree to the inventory stock listing",
    "Material variances were noted during the inventory count",
    "Variances have NOT been properly investigated or are still being investigated",
    "Inventory items counted are NOT in good condition",
    "Stock room is NOT kept neat and clean to facilitate location of inventory",
    "Inventory counts are NOT completed monthly",
    "Last stock take report has material differences",
    "There is NOT an adequate amount of stock to meet customer demands",
  ],
  [
    "QMS AND BRANDING",
    "QMS machine was not functioning",
    "QMS ticket number display was outdated (old logo and colors)",
  ],
];
// ===== AUDIT SECTIONS (chosen on the Info tab) =====
// Section 1 = Financial (cash & finance)    -> D.sFin
// Section 2 = Technical (inventory, security, tower, branding) -> D.sTech
// These two lists decide which Observation group / Findings section belongs to which section.
// Anything not listed here is always shown. Change "fin" <-> "tech" to move an item.
const OBS_SCOPE = {
  "Petty Cash": "fin",
  "Cash Handling": "fin",
  "Store Mgmt: Balancing, Oversight & Monitoring": "fin",
  "Vault Management": "fin",
  "Prior Week Selected": "fin",
  "DigiWallet & DigiTV": "fin",
  "Inventory Management Monitoring": "tech",
  "Store Maintenance & Marketing": "tech",
};
const FIN_SCOPE = {
  "CASH & CASH HANDLING": "fin",
  SECURITY: "tech",
  "TOWER AND MAINTENANCE": "tech",
  INVENTORY: "tech",
  "QMS AND BRANDING": "tech",
};
// true when the item's section was ticked on the Info tab
const inScope = (sec) =>
  !sec || (sec === "fin" && D.sFin) || (sec === "tech" && D.sTech);
const O = [];
OBS.forEach((g) =>
  g.slice(1).forEach((q) => {
    const m = "$@=?#!".includes(q[0]);
    O.push({
      g: g[0],
      t: m ? q[0] : "",
      q: m ? q.slice(1) : q,
    });
  }),
);
// Finding ID: section 0, question 0 -> "1.01"
const fid = (si, qi) => si + 1 + "." + String(qi + 1).padStart(2, "0");
// Flat list of every finding: {id, q = text, sec = fin/tech}
const FL = [];
FIN.forEach((s, si) =>
  s
    .slice(1)
    .forEach((q, qi) => FL.push({ id: fid(si, qi), q, sec: FIN_SCOPE[s[0]] })),
);
// Cash denominations: LO = loose coin values | RO = [coin value, value of one roll] | CU = bill values (BZD and USD)
const LO = [0.01, 0.05, 0.1, 0.25, 0.5, 1],
  RO = [
    [0.01, 0.5],
    [0.05, 2],
    [0.1, 5],
    [0.25, 10],
    [0.5, 10],
    [1, 25],
  ],
  CU = [2, 5, 10, 20, 50, 100];
// Escapes text so it is safe to place inside HTML
const e = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
// Builds a labelled input card for answer key k
const f = (k, l, t, x) =>
  `<div class="f"><label>${l}</label><input data-k="${k}" type="${t || "text"}"${t == "number" ? 'step="any" inputmode="decimal"' : ""} ${x || ""} value="${e(D[k])}"></div>`;
// Builds one cash-count row (label + number box)
const cg = (k, l) =>
  `<div class="g"><span>${l}</span><input data-k="${k}" type="number" inputmode="numeric" placeholder="count" value="${e(D[k])}"></div>`;
// Builds a "label ... total" line; the amount is filled in by calc()
const tot = (id, l) =>
  `<div class="t"><span>${l}</span><span id="${id}">$0.00</span></div>`;
// Draws one card per inventory item: system stock, physical count box, live variance, comment box when variance is not 0
function renderInventory() {
  const items = D.inventory || [];
  let h = "";
  items.forEach((item, i) => {
    const physical = item.physical || "";
    const variance = physical === "" ? 0 : Number(physical) - item.stock;
    h += `
      <div class="f">
          <h3>${item.item}</h3>
          <div>
              <b>SKU:</b> ${item.sku}
          </div>
          <div>
              <b>System Stock:</b> ${item.stock}
          </div>
          <br>
          <label>Count by location</label>
          <div class="parts">
            <div><small>Vault / Storage</small>
              <input type="number" min="0" inputmode="numeric" data-part="vault" data-idx="${i}" value="${item.vault ?? ""}"></div>
            <div><small>Display / Floor</small>
              <input type="number" min="0" inputmode="numeric" data-part="floor" data-idx="${i}" value="${item.floor ?? ""}"></div>
            <div><small>Sold, not in system yet</small>
              <input type="number" min="0" inputmode="numeric" data-part="sold" data-idx="${i}" value="${item.sold ?? ""}"></div>
          </div>
          <div id="tot_${i}" class="invtot">Total counted: ${physical === "" ? 0 : physical}</div>
          <div id="var_${i}" style="margin-top:8px; font-weight:bold; color:${variance === 0 ? "#2e7d32" : "#c0392b"};">
              Variance: ${variance}
          </div>
          <div id="comment_${i}"style="display:${variance !== 0 ? "block" : "none"}">
            <label style="margin-top:10px;"> Variance Comment </label>
            <textarea data-varcomment="${i}"placeholder="Reason for variance">${item.comment || ""}</textarea>
          </div>
      </div>`;
  });
  return h;
}
// Builds the Inventory Summary card (items counted, variances found, accuracy %)
function inventorySummary() {
  const items = D.inventory || [];
  const counted = items.filter(
    (i) => i.physical !== undefined && i.physical !== "",
  ).length;
  const variances = items.filter(
    (i) =>
      i.physical !== undefined &&
      i.physical !== "" &&
      Number(i.physical) !== Number(i.stock),
  ).length;
  const accuracy = counted
    ? (((counted - variances) / counted) * 100).toFixed(1)
    : "0.0";
  return `<div class="f">
        <h3>Inventory Summary</h3>
        <div>Total Items: <b>${items.length}</b></div>
        <div>Items Counted: <b id="sumCounted">${counted}</b></div>
        <div>Variances Found: <b id="sumVariance">${variances}</b></div>
        <div>Accuracy: <b id="sumAccuracy">${accuracy}%</b></div>
    </div>`;
}
// Refreshes the summary numbers without redrawing the page
function updateInventorySummary() {
  const items = D.inventory || [];
  const counted = items.filter(
    (i) => i.physical !== undefined && i.physical !== "",
  ).length;
  const variances = items.filter(
    (i) =>
      i.physical !== undefined &&
      i.physical !== "" &&
      Number(i.physical) !== Number(i.stock),
  ).length;
  const accuracy = counted
    ? (((counted - variances) / counted) * 100).toFixed(1)
    : "0.0";
  $("sumCounted").textContent = counted;
  $("sumVariance").textContent = variances;
  $("sumAccuracy").textContent = accuracy + "%";
}
// ===== SECURITY TAB (sections A-D) =====
// item: [id, type, question, optional [parentId, parentValue] = only shown when parent has that answer]
// types: y = Yes/No buttons, t = text, c = comments box
const SEC = [
  [
    "B",
    "Security Alarm, Cameras & General Security Monitoring",
    [
      [
        "B.01",
        "y",
        "Branch alarm system is actively monitored by BTL Security at headquarters?",
      ],
      ["B.02", "y", "Alarm logs are available at the branch office?"],
      [
        "B.03",
        "y",
        "Are panic buttons easily available at employee's desks (CSRs, Cashiers and Admin Office)?",
      ],
      [
        "B.04",
        "y",
        "Are panic buttons tested monthly at a minimum? [Confirm with alarm logs]",
      ],
      [
        "B.05",
        "y",
        "BTL Security monitors electronic surveillance system at headquarters?",
      ],
      [
        "B.06",
        "y",
        "Is tape or hard drive of surveillance system managed or stored at the branch?",
      ],
      [
        "B.07",
        "y",
        "If yes to B.06, is tape or hard drive storage secured?",
        ["B.06", "Yes"],
      ],
      ["B.08", "y", "Do cameras cover the entire area?"],
      ["B.09", "y", "Is there adequate lighting outside and near the doors?"],
      [
        "B.10",
        "y",
        "Cameras are monitored by the Zone Admin or Senior in the back office?",
      ],
      ["B.11", "y", "Is Armored Car Service or Drop Box utilized?"],
      [
        "B.11b",
        "c",
        "Comment: why is an Armored Car Service or Drop Box not used?",
        ["B.11", "No"],
      ],
      ["B.12", "t", "Which security service is utilized for cash deposit?"],
      ["B.13", "t", "Frequency of cash deposit?"],
      ["B.14", "t", "Where is cash kept when stored overnight?"],
      ["B.15", "c", "Other comments"],
    ],
  ],
  [
    "C",
    "Safe / Vault",
    [
      ["C.01", "y", "Does the branch have a safe/vault?"],
      [
        "C.02",
        "t",
        "If no to C.01, what secure lock-up is available?",
        ["C.01", "No"],
      ],
      [
        "C.03",
        "y",
        "Are drawers with appropriate locks available for assigned cash trays when not in use?",
      ],
      [
        "C.04",
        "y",
        "If yes to C.03, are keys unique to each cash drawer?",
        ["C.03", "Yes"],
      ],
      ["C.05", "c", "Other comments"],
    ],
  ],
  [
    "D",
    "Safety",
    [
      ["D.01", "y", "Are fire extinguishers visible and accessible?"],
      [
        "D.02",
        "t",
        "Date of last certification of fire extinguishers (year or date)",
      ],
      [
        "D.03",
        "y",
        "All staff have been trained to use the fire extinguishers.",
      ],
      [
        "D.03b",
        "c",
        "Comment: why have staff not been trained to use the fire extinguishers?",
        ["D.03", "No"],
      ],
      [
        "D.04",
        "y",
        "All staff have been trained on the robbery preparedness protocols.",
      ],
      [
        "D.04b",
        "c",
        "Comment: why have staff not been trained on the robbery preparedness protocols?",
        ["D.04", "No"],
      ],
      [
        "D.05",
        "y",
        "All staff have been trained on the emergency protocols (fire, hurricane, natural disasters, robbery preparedness, etc.).",
      ],
      [
        "D.05b",
        "c",
        "Comment: why have staff not been trained on the emergency protocols?",
        ["D.05", "No"],
      ],
      ["D.06", "c", "Other comments"],
    ],
  ],
];
const SECI = SEC.flatMap((s) => s[2]);
const secKey = (id) => "s" + id;
const secVisible = (x) => !x[3] || D[secKey(x[3][0])] === x[3][1];
const secYN = () =>
  D.sTech ? SECI.filter((x) => x[1] === "y" && secVisible(x)) : [];
function applyCond() {
  document.querySelectorAll("[data-cond]").forEach((el) => {
    const [id, v] = el.dataset.cond.split("|");
    const value = id.includes(".")
      ? D[secKey(id)] // B.01, C.03, etc.
      : D[id]; // sCREC
    el.style.display = value === v ? "" : "none";
  });
}
function renderSecurity() {
  let h = '<section id="s5"><h3>A &middot; Employee Access</h3>';
  (D._emp || []).forEach((r, i) => {
    const sel = (c, l) =>
      `<div><label>${l}</label><select data-e="${i}" data-c="${c}"><option value="">Select...</option>${[
        "Yes",
        "No",
      ]
        .map((v) => `<option${r[c] === v ? " selected" : ""}>${v}</option>`)
        .join("")}</select></div>`;
    const inp = (c, l) =>
      `<div><label>${l}</label><input data-e="${i}" data-c="${c}" value="${e(r[c])}"></div>`;
    h += `<div class="f emp"><button class="x" data-delemp="${i}" aria-label="Remove employee">&times;</button>
      <div class="qid">A.${String(i + 1).padStart(2, "0")}</div>
      <div class="row2">${inp("name", "Employee")}${inp("title", "Job title")}</div>
      <div class="row2">${sel("alarm", "Has an alarm code")}${sel("unique", "Alarm code unique & confidential")}</div>
      <div class="row2">${sel("key", "Has a branch office key")}${inp("safe", "Safe access level")}</div></div>`;
  });
  h += '<button class="add" id="addEmp">+ Add employee</button>';
  SEC.forEach((s) => {
    h += `<h3>${s[0]} &middot; ${s[1]}</h3>`;
    s[2].forEach((x) => {
      const [id, t, q, c] = x,
        k = secKey(id);
      const body =
        t === "y"
          ? `<div class="yn pos" data-k="${k}">${["Yes", "No"]
              .map(
                (v) =>
                  `<button data-v="${v}" class="${D[k] == v ? v : ""}">${v}</button>`,
              )
              .join("")}</div>`
          : t === "c"
            ? `<textarea data-k="${k}">${e(D[k])}</textarea>`
            : `<input data-k="${k}" value="${e(D[k])}">`;
      h += `<div class="f"${c ? ` data-cond="${c[0]}|${c[1]}"` : ""}><label><span class="qid">${id}</span>${q}</label>${body}</div>`;
    });
  });
  return h + "</section>";
}
// Draws the two "Audit sections" checkboxes at the top of the Info tab
function scopeCard() {
  const box = (key, title, desc) =>
    `<label class="scope${D[key] ? " on" : ""}"><input type="checkbox" data-scope="${key}"${D[key] ? " checked" : ""}><span><b>${title}</b><small>${desc}</small></span></label>`;
  return (
    `<h3>Audit sections</h3><div class="f scopes">` +
    box(
      "sFin",
      "Section 1 &middot; Financial",
      "Cash count, petty cash, cash handling, vault and finance related observations & findings",
    ) +
    box(
      "sTech",
      "Section 2 &middot; Technical",
      "Inventory, security, tower & maintenance, branding and related observations & findings",
    ) +
    `<small class="hint">Tick one, or both for a full audit. Only the tabs for your selection are shown.</small></div>`
  );
}
// Shows/hides the tab buttons to match the ticked sections (and falls back to Info if the open tab is hidden)
function updateNav() {
  const any = D.sFin || D.sTech;
  const show = { 0: true, 1: any, 2: any, 3: D.sFin, 4: D.sTech, 5: D.sTech };
  document.querySelectorAll("#nav button").forEach((b) => {
    b.style.display = show[b.dataset.t] ? "" : "none";
    const S = SECTIONS[b.dataset.t]; // tick (via CSS .done) on tabs already submitted
    b.classList.toggle("done", !!(S && D.done && D.done[S.key]));
  });
  if (!show[D._t || "0"]) D._t = "0";
}
// ===== OUTSTANDING VOUCHERS LIST (Cash tab) =====
const VOUCHER_TYPES = ["Water", "Paper", "Cleaning supplies"]; // suggestions only - you can type anything
// Adds up every voucher amount (this is the "Outstanding vouchers total")
const sumVouchers = () =>
  (D.vouchers || []).reduce((a, v) => a + (parseFloat(v.amt) || 0), 0);
// Text version of the list, saved inside the Cash Notes column, e.g. "Water: 4; Paper: 5"
const voucherText = () =>
  (D.vouchers || [])
    .filter((v) => parseFloat(v.amt))
    .map((v) => `${v.type || ""}${v.ref ? " (" + v.ref + ")" : ""}: ${v.amt}`)
    .join("; ");
function voucherList() {
  if (!D.vouchers || !D.vouchers.length) D.vouchers = [{}];
  D.vch = sumVouchers(); // "vch" is what calc() adds into Total Counted
  // inp() builds one small labelled box for voucher i, field c
  const inp = (i, c, label, type, x) =>
    `<div><small class="vl">${label}</small><input type="${type || "text"}" ${x || ""} data-vi="${i}" data-vc="${c}" value="${e(D.vouchers[i][c])}"></div>`;
  // sg() builds a Yes/No button pair for voucher i, field c (signed by authorizer / receiver)
  const sg = (i, c, label) =>
    `<div><small class="vl">${label}</small><div class="yn pos" data-vi="${i}" data-vc="${c}">${["Yes", "No"].map((o) => `<button data-v="${o}" class="${D.vouchers[i][c] === o ? o : ""}">${o}</button>`).join("")}</div></div>`;
  let h = '<div class="f"><label>Outstanding vouchers / receipts</label>';
  h += `<datalist id="vtypes">${VOUCHER_TYPES.map((o) => `<option value="${o}">`).join("")}</datalist>`;
  D.vouchers.forEach((v, i) => {
    h += `<div class="vline"><button class="x" data-delv="${i}" aria-label="Remove voucher">&times;</button>
      <div class="row2">${inp(i, "amt", "Amount ($)", "number", 'step="any" inputmode="decimal"')}${inp(i, "type", "Item", "text", 'list="vtypes" placeholder="e.g. Water"')}</div>
      <div class="row2">${inp(i, "date", "Date", "date")}${inp(i, "ref", "Voucher #", "text")}</div>
      ${inp(i, "purpose", "Purpose", "text")}
      <div class="row2">${sg(i, "auth", "Signed by authorizer?")}${sg(i, "recv", "Signed by receiver?")}</div></div>`;
  });
  return (
    h +
    '<button class="add" id="addVoucher">+ Add voucher</button>' +
    tot("vtot", "Outstanding vouchers total") +
    "</div>"
  );
}
// ===== CASH COUNT SHEETS (one per cashier / DigiWallet / petty cash / vault) =====
// every field that belongs to ONE count sheet: copied when saved, cleared for the next sheet
const CASH_KEYS = [
  ...LO.map((d) => "l" + d),
  ...RO.map(([d]) => "r" + d),
  ...CU.map((d) => "c" + d),
  ...CU.map((d) => "u" + d),
  "chk",
  "visa",
  "vch",
  "auth",
  "oth",
  "cnote",
  "sCREC",
  "crecnote",
];
// true when the sheet on screen has anything typed in it (vch is ignored: it is auto-calculated)
const cashHasData = () =>
  ["cashType", "cashName", ...CASH_KEYS.filter((k) => k !== "vch")].some(
    (k) => D[k] !== undefined && D[k] !== "",
  ) || (D.vouchers || []).some((v) => parseFloat(v.amt));
// Saves the sheet on screen into D.cashCounts (everything: denominations, vouchers, reconcile) and clears it for the next one
function saveCashCount() {
  if (!D.cashType) {
    alert("Please select a count type.");
    return false;
  }
  if (!(D.cashName || "").trim()) {
    alert("Please enter a name.");
    return false;
  }
  if (!D.sCREC) {
    alert("Please answer 'Cash reconciled?' for this count.");
    return false;
  }
  if (D.sCREC === "No" && !(D.crecnote || "").trim()) {
    alert("Please explain why this count did not reconcile.");
    return false;
  }
  const c = calc();
  const snap = {
    type: D.cashType,
    name: D.cashName,
    counted: c.T,
    authorized: n("auth"),
    variance: c.V,
    total: c.T, // (names used by the Saved Cash Counts list)
    tot: c,
    vouchers: JSON.parse(JSON.stringify(D.vouchers || [])),
  };
  CASH_KEYS.forEach((k) => (snap[k] = D[k]));
  D.cashCounts.push(snap);
  clearCashForm();
  save();
  R();
  tab("3");
  return true;
}
function clearCashForm() {
  D.cashType = "";
  D.cashName = "";
  CASH_KEYS.forEach((k) => delete D[k]);
  D.vouchers = []; // voucherList() adds one blank line
}

// ===== PER-TAB SUBMISSION =====
// Every section tab is submitted on its own. Info (branch, date, auditor, managers) travels with each one.
// SECTIONS: tab number -> {key, name, need() = is this section part of the audit (ticked on Info)}
const SECTIONS = {
  3: { key: "cash", name: "Cash", need: () => D.sFin },
  4: { key: "inventory", name: "Inventory", need: () => D.sTech },
  5: { key: "security", name: "Security", need: () => D.sTech },
  1: { key: "obs", name: "Observations", need: () => D.sFin || D.sTech },
  2: { key: "findings", name: "Findings", need: () => D.sFin || D.sTech },
};
const SECTION_ORDER = ["3", "4", "5", "1", "2"]; // same order as the tab buttons
const uid = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now() + "-" + Math.random().toString(36).slice(2);
// One ID for the whole audit. Each section's rows use  <auditId>-<section>  so resubmitting a section REPLACES its rows (no duplicates).
const auditId = () => D.auditId || (D.auditId = uid());
const INFO_H = [
  "Branch",
  "Audit Date",
  "Auditors",
  "Sr. Staff",
  "Zone Admin",
  "Zone Manager",
];
const infoV = () => [
  D.branch,
  D.adate,
  D.auditor,
  D.sr || "",
  D.zadmin || "",
  D.zmgr || "",
];
const scopeText = () =>
  [D.sFin ? "Financial" : "", D.sTech ? "Technical" : ""]
    .filter(Boolean)
    .join(" + ");
// Checks the Info tab. Returns false (after telling the auditor) if something is missing.
function infoOk() {
  if (!D.sFin && !D.sTech) {
    alert(
      "Please tick Section 1 (Financial) and/or Section 2 (Technical) on the Info tab.",
    );
    tab("0");
    return false;
  }
  for (const k of ["branch", "adate", "auditor"])
    if (!(D[k] || "").trim()) {
      alert("Please complete Branch, Audit date and Auditor on the Info tab.");
      tab("0");
      return false;
    }
  return true;
}
// BUILD.<section>(sid, at) = validates ONE section and returns the Google Sheet tabs it writes (or null if something is missing)
const BUILD = {
  cash(sid, at) {
    if (cashHasData() && !saveCashCount()) return null; // the sheet on screen is saved automatically
    const cs = D.cashCounts || [];
    if (!cs.length) {
      alert("Please save at least one cash count first.");
      return null;
    }
    const crows = cs.map((x) => {
      const T = x.tot || {};
      return [
        sid,
        D.branch,
        D.adate,
        x.name,
        x.type,
        T.L ?? "",
        T.Rl ?? "",
        T.C ?? "",
        T.U ?? "",
        parseFloat(x.chk) || 0,
        parseFloat(x.visa) || 0,
        parseFloat(x.vch) || 0,
        T.T ?? x.total,
        parseFloat(x.auth) || 0,
        T.S ?? "",
        parseFloat(x.oth) || 0,
        T.V ?? x.variance,
        x.sCREC || "",
        x.sCREC === "No" ? x.crecnote || "" : "",
        x.cnote || "",
      ];
    });
    const vrows = [];
    cs.forEach((x) =>
      (x.vouchers || [])
        .filter((v) => parseFloat(v.amt) || v.type || v.purpose)
        .forEach((v) =>
          vrows.push([
            sid,
            D.branch,
            D.adate,
            v.date || "",
            v.type || "",
            v.ref || "",
            v.purpose || "",
            parseFloat(v.amt) || 0,
            v.auth || "",
            v.recv || "",
            `${x.name} (${x.type})`,
          ]),
        ),
    );
    return {
      "Cash Counts": {
        headers: [
          "Submission ID",
          "Branch",
          "Audit Date",
          "Name",
          "Type",
          "Loose Coin",
          "Rolled Coin",
          "Currency",
          "USD (BZD)",
          "Checks",
          "Visa",
          "Vouchers",
          "Total Counted",
          "Authorized Amount",
          "Short/(Over)",
          "Other Verified",
          "Variance",
          "Reconciled",
          "Reconcile Comment",
          "Notes",
        ],
        rows: crows,
      },
      Vouchers: {
        headers: [
          "Submission ID",
          "Branch",
          "Audit Date",
          "Voucher Date",
          "Item",
          "Voucher #",
          "Purpose",
          "Amount",
          "Signed by Authorizer",
          "Signed by Receiver",
          "Count Sheet",
        ],
        rows: vrows,
      },
    };
  },
  inventory(sid, at) {
    const items = (D.inventory || []).filter(
      (r) => r.physical !== undefined && r.physical !== "",
    );
    if (!items.length) {
      alert("Please count at least one inventory item before submitting.");
      return null;
    }
    return {
      "Inventory Lines": {
        headers: [
          "Submission ID",
          "Branch",
          "Audit Date",
          "Inventory Code",
          "Inventory Name",
          "Storage Area",
          "Stock",
          "Physical Count",
          "Variance",
          "Comment",
          "Condition",
          "Location",
          "Vault/Storage Count",
          "Display/Floor Count",
          "Sold (not yet in system)",
        ],
        rows: items.map((r) => [
          sid,
          D.branch,
          D.adate,
          r.sku || "",
          r.item || "",
          "",
          Number(r.stock) || 0,
          Number(r.physical) || 0,
          (Number(r.physical) || 0) - (Number(r.stock) || 0),
          r.comment || "",
          "",
          "",
          Number(r.vault) || 0,
          Number(r.floor) || 0,
          Number(r.sold) || 0,
        ]),
      },
    };
  },
  security(sid, at) {
    const miss = secYN()
      .filter((x) => !D[secKey(x[0])])
      .map((x) => x[0]);
    if (miss.length) {
      alert(
        "Please answer all Security checks (Yes / No).\n\n" +
          miss.length +
          " missing: " +
          miss.join(", "),
      );
      return null;
    }
    return {
      "Security Checks": {
        headers: [
          "Submission ID",
          "Submitted At",
          "Branch",
          "Audit Date",
          "Auditor",
          ...SECI.map((x) => x[0] + " " + x[2].slice(0, 45)),
        ],
        rows: [
          [
            sid,
            at,
            D.branch,
            D.adate,
            D.auditor,
            ...SECI.map((x) => (secVisible(x) ? D[secKey(x[0])] || "" : "")),
          ],
        ],
      },
      "Employee Access": {
        headers: [
          "Submission ID",
          "Branch",
          "Audit Date",
          "Employee",
          "Job Title",
          "Has Alarm Code",
          "Alarm Code Unique & Confidential",
          "Has Branch Office Key",
          "Safe Access Level",
        ],
        rows: (D._emp || [])
          .filter((r) => r.name)
          .map((r) => [
            sid,
            D.branch,
            D.adate,
            r.name || "",
            r.title || "",
            r.alarm || "",
            r.unique || "",
            r.key || "",
            r.safe || "",
          ]),
      },
    };
  },
  obs(sid, at) {
    const bad = O.filter(
      (o, i) =>
        inScope(OBS_SCOPE[o.g]) &&
        o.t === "!" &&
        D["o" + i] === "No" &&
        !(D["o" + i + "_comment"] || "").trim(),
    );
    if (bad.length) {
      alert(
        "Please provide comments for all No responses.\n\n" +
          bad.length +
          " missing.",
      );
      return null;
    }
    // answer (+ its comment, which the old submit never sent)
    const val = (o, i) => {
      if (!inScope(OBS_SCOPE[o.g]) || D["o" + i] === undefined) return "";
      const cm = (D["o" + i + "_comment"] || "").trim();
      return cm ? D["o" + i] + " | " + cm : D["o" + i];
    };
    return {
      Observations: {
        headers: [
          "Submission ID",
          "Submitted At",
          ...INFO_H,
          ...O.map((o) => o.q),
        ],
        rows: [[sid, at, ...infoV(), ...O.map(val)]],
      },
    };
  },
  findings(sid, at) {
    const miss = FL.filter((x) => inScope(x.sec) && !D["f" + x.id]).map(
      (x) => x.id,
    );
    if (miss.length) {
      alert(
        "Please answer all findings (Yes / No / NR).\n\n" +
          miss.length +
          " missing: " +
          miss.join(", "),
      );
      return null;
    }
    return {
      Findings: {
        headers: [
          "Submission ID",
          "Submitted At",
          ...INFO_H,
          ...FL.map((x) => x.id + " " + x.q.slice(0, 45)),
        ],
        rows: [
          [
            sid,
            at,
            ...infoV(),
            ...FL.map((x) => (inScope(x.sec) ? D["f" + x.id] || "" : "")),
          ],
        ],
      },
    };
  },
};
// SUBMIT THE TAB YOU ARE ON: validates it, adds it to the upload queue and marks it done. Other tabs are untouched.
function submitTab() {
  const S = SECTIONS[D._t || "0"];
  if (!S) {
    alert(
      "Open a section tab (Cash, Inventory, Security, Observations or Findings) to submit it.",
    );
    return;
  }
  if (!infoOk()) return;
  const at = new Date().toISOString(),
    sid = auditId() + "-" + S.key;
  const tabs = BUILD[S.key](sid, at);
  if (!tabs) return;
  const rec = {
    token: TOKEN,
    submissionId: sid,
    section: S.key,
    tabs: {
      // one row per submitted section: the full Info + which section + when
      "Audit Log": {
        headers: [
          "Submission ID",
          "Audit ID",
          "Section",
          "Submitted At",
          ...INFO_H,
          "Audit Scope",
        ],
        rows: [[sid, auditId(), S.name, at, ...infoV(), scopeText()]],
      },
      ...tabs,
    },
  };
  setQ(
    getQ()
      .filter((r) => r.submissionId !== sid)
      .concat(rec),
  ); // resubmitting replaces the waiting copy
  (D.done = D.done || {})[S.key] = { sid, at, sent: false };
  save();
  updateNav();
  updateStatus();
  updateSubmitBtn();
  flush(true);
}
// "Save for later" button: everything is already saved on the phone after each change; this just confirms it
function saveLater() {
  save();
  const todo = SECTION_ORDER.filter(
    (t) => SECTIONS[t].need() && !(D.done || {})[SECTIONS[t].key],
  ).map((t) => SECTIONS[t].name);
  alert(
    "Saved on this device. Nothing is lost if you close the app.\n\n" +
      (todo.length
        ? "Still to submit: " + todo.join(", ")
        : "All sections submitted."),
  );
}
// Bottom-right button: "Submit Cash", "Resubmit Inventory" ... hidden on the Info tab
function updateSubmitBtn() {
  const b = $("submitBtn");
  if (!b) return;
  const S = SECTIONS[D._t || "0"];
  b.style.display = S ? "" : "none";
  if (S)
    b.textContent = ((D.done || {})[S.key] ? "Resubmit " : "Submit ") + S.name;
}
// Section status list on the Info tab
function statusInner() {
  const rows = SECTION_ORDER.filter((t) => SECTIONS[t].need()).map((t) => {
    const S = SECTIONS[t],
      d = (D.done || {})[S.key];
    const when = d
      ? new Date(d.at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
    return `<div class="st"><span>${S.name}</span><span class="${d ? (d.sent ? "ok" : "wait") : "todo"}">${d ? (d.sent ? "&#10003; Uploaded " : "&#9203; Waiting to upload ") + when : "Not submitted"}</span></div>`;
  });
  return rows.join("") || "Tick a section above to begin.";
}
const statusCard = () =>
  `<h3>Section status</h3><div class="f" id="statusWrap">${statusInner()}</div>`;
function updateStatus() {
  const el = $("statusWrap");
  if (el) el.innerHTML = statusInner();
}
// R() = RENDER. Rebuilds every tab from D (Info, Observations, Findings, Cash, Inventory, Security). Sections not ticked are skipped.
function R() {
  //structure of the Info tab
  let h =
    '<section id="s0">' +
    "<h3>Info</h3>" +
    `<div class="f"><label>Branch</label>
      <select data-k="branch">
      <option value="">Select branch...</option>
      ${BRANCHES.map(
        (b) =>
          `<option value="${b}" ${D.branch == b ? "selected" : ""}>${b}</option>`,
      ).join("")}
      </select>
    </div>` +
    f("adate", "Audit date", "date") +
    `<div class="f">
        <label>Auditor</label>
          <select data-k="auditor">
              <option value="">Select auditor...</option>
              ${AUDITORS.map(
                (a) =>
                  `<option value="${a}" ${D.auditor === a ? "selected" : ""}>${a}</option>`,
              ).join("")}
          </select>
    </div>` +
    f("zmgr", "Store Manager in charge") +
    scopeCard() +
    statusCard() +
    '<button class="add" id="newAuditBtn">Start new audit (clear everything)</button>' +
    '</section><section id="s1">';
  //Observation Tab Section Structure
  let g = "";
  O.forEach((o, i) => {
    if (!inScope(OBS_SCOPE[o.g])) return; // skip groups outside the chosen sections
    if (o.g != g) {
      g = o.g;
      h += `<h3>${g}</h3>`;
    }
    const k = "o" + i;
    h +=
      o.t == "="
        ? `<div class="f"><label>${o.q}</label><b id="v${i}">0.00</b></div>`
        : `<div class="f"><label>${o.q}</label>` +
          (o.t == "!"
            ? `<div>
                <div class="yn" data-k="${k}">
                    ${["Yes", "No"]
                      .map(
                        (v) =>
                          `<button data-v="${v}"
                            class="${D[k] == v ? v : ""}">
                            ${v}
                        </button>`,
                      )
                      .join("")}
                </div>
                <textarea
                      class="no-comment"
                      data-comment="${k}"
                      placeholder="Required when No is selected"
                      style="display:${D[k] === "No" ? "block" : "none"}"
                >${e(D[k + "_comment"] || "")}</textarea>
            </div>`
            : o.t == "?"
              ? `<div class="yn" data-k="${k}">
                  ${["Yes", "No"]
                    .map(
                      (v) =>
                        `<button data-v="${v}"
                          class="${D[k] == v ? v : ""}">
                          ${v}
                      </button>`,
                    )
                    .join("")}
              </div>`
              : o.t == "#"
                ? `<select data-k="${k}">
                  <option value="">Select...</option>
                  ${(DROPDOWNS[o.q] || [])
                    .map(
                      (v) =>
                        `<option value="${v}"
                          ${D[k] == v ? "selected" : ""}>
                          ${v}
                      </option>`,
                    )
                    .join("")}
              </select>`
                : o.t
                  ? `<input
                  data-k="${k}"
                  type="${o.t == "$" ? "number" : "date"}"
                  ${o.t == "$" ? 'step="any" inputmode="decimal"' : ""}
                  value="${e(D[k])}">`
                  : `<textarea data-k="${k}">${e(D[k])}</textarea>`) +
          "</div>";
  });
  //Finding Tab structure
  h +=
    '</section><section id="s2"><div class="f"><b>Yes</b> = finding observed &nbsp; <b>No</b> = not observed &nbsp; <b>NR</b> = area not reviewed</div>';
  FIN.forEach((s, si) => {
    if (!inScope(FIN_SCOPE[s[0]])) return; // skip findings sections outside the chosen sections
    h += `<h3>${si + 1}.00 ${s[0]}</h3>`;
    s.slice(1).forEach((q, qi) => {
      const k = "f" + fid(si, qi);
      h +=
        `<div class="f"><label>${fid(si, qi)} ${q}</label><div class="yn" data-k="${k}">` +
        ["Yes", "No", "NR"]
          .map(
            (v) =>
              `<button data-v="${v}" class="${D[k] == v ? v : ""}">${v}</button>`,
          )
          .join("") +
        "</div></div>";
    });
  });
  //Cash Tab section structure
  h += `
    </section>
    <section id="s3">
        <div class="f">
          <h3>Cash Count Information</h3>
          <label>Count Type</label>
          <select data-k="cashType">
              <option value="">Select...</option>
              <option value="Cashier"> Cashier </option>
              <option value="DigiWallet"> DigiWallet </option>
              <option value="Petty Cash"> Petty Cash </option>
              <option value="Vault"> Vault </option>
          </select>
          <label>Name</label>
          <input data-k="cashName" placeholder="Cashier name, Vault name, etc." value="${e(D.cashName)}">
          <label>Authorized Amount ($)</label>
          <input data-k="auth" type="number" step="any" inputmode="decimal" value="${e(D.auth)}">
        </div>
        <div class="cash-grid">
            <div class="cash-col">
            <div class="f">
                <h3>Loose coin (count)</h3>
                ${LO.map((d) => cg("l" + d, "$" + d.toFixed(2))).join("")}
                ${tot("tL", "Total loose coin")}
            </div>
            <div class="f">
                <h3>Rolled coin (number of rolls)</h3>
                ${RO.map(([d, v]) => cg("r" + d, `$${d.toFixed(2)} coin ($${v.toFixed(2)} roll)`)).join("")}
                ${tot("tR", "Total rolled coin")}
            </div>
            <div class="f">
                <h3>Other</h3>
                ${f("chk", "Checks total ($)", "number")}
                ${f("visa", "Visa amount ($)", "number")}
                ${f("oth", "Other amount verified, e.g. CSR floats ($)", "number")}
                ${voucherList()}
            </div>
        </div>
        <div class="cash-col">
            <div class="f">
                <h3>BZD currency (count)</h3>
                ${CU.map((d) => cg("c" + d, "$" + d)).join("")}
                ${tot("tC", "Total currency")}
            </div>
            <div class="f">
                <h3>USD (count, converted at 2.00)</h3>
                ${CU.map((d) => cg("u" + d, "US$" + d)).join("")}
                ${tot("tU", "Total USD in BZD")}
            </div>
            <div class="f cash-summary">
              <h3>Cash Summary</h3>
              ${tot("tT", "Total counted & verified")}
              ${tot("tS", "Cash short/(over) vs authorized")}
              ${tot("tV", "Variance after other verified")}
              <div class="reconcile-box">
                <label>Cash reconciled?</label>
                <div class="yn pos" data-k="sCREC">
                    ${["Yes", "No"].map((v) => `<button data-v="${v}" class="${D.sCREC == v ? v : ""}">${v}</button>`).join("")}
                </div>
              </div>
              <div class="reconcile-note"
                data-cond="sCREC|No"
                style="display:none">
                <label>Reason the cash did not reconcile</label>
                <textarea data-k="crecnote" placeholder="Explain the variance, shortage, overage, missing voucher, etc.">${e(D.crecnote)}</textarea>
              </div>
              </div>
                <button
                    class="cash-save"
                    id="saveCashCount">
                    Save Cash Count
                </button>
                <div class="f">
                  <h3>Saved Cash Counts</h3>
                  ${(D.cashCounts || []).map((c, i) => `<div>${i + 1}. ${c.type}-${c.name}($${c.total.toFixed(2)})</div>`).join("")}
                </div> 
              </div>
            </div>
    </section>`;
  //Inventory Tab Section Structure
  h += `
    <section id="s4">
        <button class="add" id="loadInventory">
          Load Inventory
        </button>
        <h3>Inventory Count</h3>
          <div class="f">
              <label>Branch</label>
              <div>${D.branch || "-"}</div>
              <label>Items Loaded</label>
              <div>
                  ${(D.inventory || []).length}
              </div>
          </div>
         <div class="inv-grid">${renderInventory()}</div>
        ${inventorySummary()}
    </section>`;
  //Security Tab Section Structure
  h += D.sTech ? renderSecurity() : ""; // Security tab only exists for Section 2 (Technical)
  $("main").innerHTML = h;
  calc();
  applyCond();
  updateNav();
  tab(D._t || "0");
}
// Shows tab t (0 Info, 1 Observations, 2 Findings, 3 Cash, 4 Inventory, 5 Security) and highlights its button
function tab(t) {
  D._t = t;
  document
    .querySelectorAll("section")
    .forEach((s) => s.classList.toggle("on", s.id == "s" + t));
  document
    .querySelectorAll("#nav button")
    .forEach((b) => b.classList.toggle("on", b.dataset.t == t));
  if (t !== "4") {
    scrollTo(0, 0);
  }
  updateSubmitBtn();
}
// n("key") = number typed in a field (0 if blank) | $$ formats a number as money
const n = (k) => parseFloat(D[k]) || 0,
  $$ = (x) => (x < 0 ? "-$" : "$") + Math.abs(x).toFixed(2);
// Cash maths: totals each denomination group, total counted, short/(over) vs authorized, final variance. Also fills the "=" variance lines.
function calc() {
  const L = LO.reduce((a, d) => a + n("l" + d) * d, 0),
    Rl = RO.reduce((a, [d, v]) => a + n("r" + d) * v, 0),
    C = CU.reduce((a, d) => a + n("c" + d) * d, 0),
    U = CU.reduce((a, d) => a + n("u" + d) * d * 2, 0);
  const T = L + Rl + C + U + n("chk") + n("visa") + n("vch"),
    S = T - n("auth"),
    V = S + n("oth");
  O.forEach((o, i) => {
    if (o.t == "=") {
      D["o" + i] = +(n("o" + (i - 1)) - n("o" + (i - 2))).toFixed(2);
      const el = $("v" + i);
      if (el) el.textContent = D["o" + i].toFixed(2);
    }
  });
  const set = (id, v) => {
    const el = $(id);
    if (el) el.textContent = $$(v);
  };
  set("tL", L);
  set("tR", Rl);
  set("tC", C);
  set("tU", U);
  set("tT", T);
  set("tS", S);
  set("tV", V);
  return { L, Rl, C, U, T, S, V };
}
// (older manual inventory rows) per-row variance
function iv(i) {
  const r = D._inv[i],
    el = $("iv" + i);
  if (el)
    el.textContent = +(
      (parseFloat(r.cnt) || 0) - (parseFloat(r.stock) || 0)
    ).toFixed(2);
}
// INPUT LISTENER: every typed/selected value is saved into D, based on the field's data- attribute
// (data-k normal answer | data-scope section checkbox | data-e employee | data-physical inventory count | data-varcomment inventory comment)
document.addEventListener("input", (ev) => {
  const t = ev.target;
  if (t.dataset.k) {
    D[t.dataset.k] = t.value;
    calc();
    if (t.dataset.k === "auditor") {
      applyTheme();
    }
  } else if (t.dataset.scope != null) {
    D[t.dataset.scope] = t.checked; // ticking a section redraws the form
    save();
    R();
    updateProgress();
    return;
  } else if (t.dataset.vi != null) {
    D.vouchers[t.dataset.vi][t.dataset.vc] = t.value;
    D.vch = sumVouchers();
    const vt = $("vtot");
    if (vt) vt.textContent = $$(D.vch);
    save();
    calc();
    return;
  } else if (t.dataset.e != null) {
    D._emp[t.dataset.e][t.dataset.c] = t.value;
  } else if (t.dataset.i != null) {
    D._inv[t.dataset.i][t.dataset.c] = t.value;
    iv(+t.dataset.i);
  } else if (t.dataset.part != null) {
    // One of the three location boxes changed: add them up into "physical"
    const i = Number(t.dataset.idx);
    const it = D.inventory[i];
    it[t.dataset.part] = t.value;
    const parts = ["vault", "floor", "sold"];
    const any = parts.some((p) => it[p] !== undefined && it[p] !== "");
    it.physical = any
      ? parts.reduce((a, p) => a + (Number(it[p]) || 0), 0)
      : "";
    const total = it.physical === "" ? 0 : it.physical;
    const variance = total - Number(it.stock);
    $("tot_" + i).textContent = "Total counted: " + total;
    const v = $("var_" + i);
    if (v) {
      v.textContent = "Variance: " + variance;
      v.style.color = variance === 0 ? "#2e7d32" : "#c0392b";
    }
    const comment = $("comment_" + i);
    if (comment) comment.style.display = variance !== 0 ? "block" : "none";
    save();
    updateInventorySummary();
    return;
  } else if (t.dataset.physical != null) {
    const i = Number(t.dataset.physical);
    D.inventory[i].physical = t.value;
    const stock = Number(D.inventory[i].stock);
    const physical = Number(t.value) || 0;
    const variance = physical - stock;
    const v = $("var_" + i);
    if (v) {
      v.textContent = "Variance: " + variance;
      v.style.color = variance === 0 ? "#2e7d32" : "#c0392b";
    }
    const comment = $("comment_" + i);
    if (comment) {
      comment.style.display = variance !== 0 ? "block" : "none";
    }
    save();
    updateInventorySummary();
    return;
  } else if (t.dataset.varcomment != null) {
    const i = Number(t.dataset.varcomment);
    D.inventory[i].comment = t.value;
  } else if (t.dataset.comment) {
    D[t.dataset.comment + "_comment"] = t.value;
  }
  save();
  updateProgress();
});
// CLICK LISTENER: tab buttons, Yes/No buttons, add/remove employee, Load Inventory
document.addEventListener("click", (ev) => {
  const t = ev.target;
  // Navigation tabs
  if (t.closest("#nav button")) {
    return tab(t.closest("#nav button").dataset.t);
  }
  // Yes/No/NR buttons
  const b = t.closest(".yn button");
  if (b && b.parentNode.dataset.vi != null) {
    // Voucher "signed by authorizer / receiver" Yes/No buttons
    const g = b.parentNode,
      vo = D.vouchers[g.dataset.vi];
    vo[g.dataset.vc] = vo[g.dataset.vc] === b.dataset.v ? "" : b.dataset.v;
    g.querySelectorAll("button").forEach(
      (x) =>
        (x.className = vo[g.dataset.vc] === x.dataset.v ? x.dataset.v : ""),
    );
    save();
    return;
  }
  if (b) {
    const k = b.parentNode.dataset.k;
    const v = b.dataset.v;
    D[k] = D[k] == v ? "" : v;
    b.parentNode.querySelectorAll("button").forEach((x) => {
      x.className = D[k] == x.dataset.v ? x.dataset.v : "";
    });
    save();
    // Show/hide comment box for ! questions
    const commentBox = document.querySelector(`textarea[data-comment="${k}"]`);
    if (commentBox) {
      commentBox.style.display = D[k] === "No" ? "block" : "none";
    }
    applyCond();
    updateProgress();
    return;
  }
  // Add / remove voucher (Cash tab)
  if (t.id == "addVoucher") {
    const y = scrollY;
    D.vouchers.push({});
    save();
    R();
    scrollTo(0, y);
    return;
  }
  if (t.dataset.delv != null) {
    const y = scrollY;
    D.vouchers.splice(+t.dataset.delv, 1);
    D.vch = sumVouchers();
    save();
    R();
    scrollTo(0, y);
    return;
  }
  // Add / remove employee (Security tab)
  if (t.id == "addEmp") {
    if (D._emp.length < 10) {
      const y = scrollY;
      D._emp.push({});
      save();
      R();
      scrollTo(0, y);
    }
    return;
  }
  if (t.dataset.delemp != null) {
    if (confirm("Remove this employee?")) {
      const y = scrollY;
      D._emp.splice(+t.dataset.delemp, 1);
      if (!D._emp.length) D._emp = [{}];
      save();
      R();
      scrollTo(0, y);
    }
    return;
  }
  if (t.id === "newAuditBtn") {
    newAudit();
    return;
  }
  if (t.id === "saveCashCount") {
    saveCashCount();
    return;
  }
  // Add inventory row
  if (t.id == "loadInventory") {
    loadInventory();
    return;
  }
  // Delete inventory row
  // if (t.dataset.del != null && confirm("Remove this item?")) {
  //   D._inv.splice(+t.dataset.del, 1);
  //   if (!D._inv.length) D._inv = [{}];
  //   save();
  //   R();
  //   tab("4");
  //   return;
  // }
});
// "Clear form" button: wipes D after confirmation
function newAudit() {
  const todo = SECTION_ORDER.filter(
    (t) => SECTIONS[t].need() && !(D.done || {})[SECTIONS[t].key],
  ).map((t) => SECTIONS[t].name);
  let msg = "Start a new audit and clear this form?";
  if (todo.length)
    msg =
      "NOT submitted yet: " +
      todo.join(", ") +
      ".\n\nClearing will lose them. Clear anyway?";
  else if (getQ().length)
    msg +=
      "\n\n" +
      getQ().length +
      " section(s) are still waiting to upload. They stay queued and will send when you have signal.";
  if (!confirm(msg)) return;
  D = { _inv: [{}], _emp: [{}], cashCounts: [] };
  save();
  R();
}
// Upload queue (getQ / setQ): audits waiting to be sent are kept in the phone so they survive being offline
const getQ = () => {
    try {
      return JSON.parse(localStorage.getItem(QK) || "[]");
    } catch (e) {
      return [];
    }
  },
  setQ = (a) => {
    try {
      localStorage.setItem(QK, JSON.stringify(a));
    } catch (e) {}
  };
// Progress bar = answered findings + security Yes/No checks in the chosen sections
function updateProgress() {
  // const fl = FL.filter((x) => inScope(x.sec)); // findings in the chosen sections
  // const sec = secYN(); // security Yes/No questions (Technical only)
  // const total = fl.length + sec.length;
  // const answered =
  //   fl.filter((x) => D["f" + x.id]).length +
  //   sec.filter((x) => D[secKey(x[0])]).length;
  // $("progressBar").style.width = (total ? (answered / total) * 100 : 0) + "%";
  // $("progressText").textContent = total
  //   ? answered + " of " + total + " checks completed"
  //   : "Select Section 1 and/or Section 2 on the Info tab";
}
// NOTE: doGet is Google Apps Script code (it belongs in Code.gs). It does nothing in the browser.
function doGet(e) {
  const action = e.parameter.action;
  if (action === "inventory") {
    const branch = e.parameter.branch;
    const sh = SpreadsheetApp.getActive().getSheetByName("Inventory Master");
    const data = sh.getDataRange().getValues();
    const rows = data
      .slice(1)
      .filter((r) => r[0] === branch)
      .map((r) => ({
        sku: r[1],
        item: r[2],
        stock: r[3],
      }));
    return ContentService.createTextOutput(JSON.stringify(rows)).setMimeType(
      ContentService.MimeType.JSON,
    );
  }
}
function applyTheme() {
  const theme = AUDITOR_THEMES[D.auditor];
  if (!theme) return;
  document.documentElement.style.setProperty("--brand", theme.brand);
  document.documentElement.style.setProperty("--brand2", theme.brand2);
  document.documentElement.style.setProperty("--accent", theme.accent);
}

// "Load Inventory" button: fills D.inventory with the items to count (edit the list here)
async function loadInventory() {
  if (!D.branch) {
    alert("Please select a branch first.");
    return;
  }
  try {
    const r = await fetch(
      ENDPOINT +
        "?action=inventory" +
        "&branch=" +
        encodeURIComponent(D.branch),
    );
    const data = await r.json();
    if (!data.length) {
      alert("No inventory was found for this branch.");
      return;
    }
    D.inventory = data;
    save();
    R();
    tab("4");
  } catch (err) {
    console.error(err);
    alert("Unable to load inventory.");
  }
}

// FLUSH: sends queued audits to Google. Failures stay queued and retry when the phone is online again.
async function flush(fresh) {
  const q = getQ();
  if (!q.length) return;
  let left = [];
  const ok = []; // names of the sections that uploaded this time
  if (navigator.onLine)
    for (const r of q) {
      try {
        const x = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(r),
        });
        const j = await x.json();
        if (!j.ok) left.push(r);
        else {
          ok.push(r.tabs["Audit Log"].rows[0][2]);
          // mark that section as uploaded (only if it has not been resubmitted since)
          if (
            r.section &&
            D.done &&
            D.done[r.section] &&
            D.done[r.section].sid === r.submissionId
          )
            D.done[r.section].sent = true;
        }
      } catch (err) {
        left.push(r);
      }
    }
  else left = q;
  setQ(left);
  save();
  updateStatus();
  if (left.length)
    alert(
      left.length +
        " section(s) waiting to upload.\n\nThey will send automatically when you have signal. Keep the app on this device until it confirms the upload.",
    );
  else
    alert(
      "Uploaded to the master sheet" +
        (ok.length ? ": " + ok.join(", ") : "") +
        ".",
    );
}
// Retry uploads automatically when signal returns
addEventListener("online", () => flush());
// Registers the service worker (lets the app open offline)
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("service-worker.js");
// Start-up: draw the form and the progress bar
R();
applyTheme();
updateProgress();
flush();
