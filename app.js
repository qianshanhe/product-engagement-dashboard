/* ============================================================
   Product Engagement Dashboard — synthetic demo data + logic
   Case study: Intuit Staff Technical Data Analyst, Business Ops Analytics
   Dependency-free vanilla JS. All data below is synthetic (FY26 Q4 demo).
   ============================================================ */

(function () {
  "use strict";

  /* ---------------- constants ---------------- */

  const PRODUCTS = [
    { id: "accounting", name: "QuickBooks Accounting", short: "QBO Accounting" },
    { id: "expert", name: "QuickBooks Intuit Expert", short: "Intuit Expert" },
    { id: "payments", name: "QuickBooks Payments", short: "Payments" },
    { id: "billpay", name: "QuickBooks Bill Pay", short: "Bill Pay" },
  ];
  const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

  // Free-text questions can name a product that isn't the tab currently open
  // (e.g. typing "billpay falloff" while looking at Intuit Expert). Without
  // this, the chat silently answers for whichever tab happens to be active --
  // it never actually reads the product name out of the question -- which
  // breaks the "AI only speaks to what's reconciled on screen" premise.
  // Aliases are checked most-specific-first; multi-word product tokens are
  // listed ahead of the bare one-word fallback for each product.
  const PRODUCT_ALIASES = {
    billpay: ["bill pay", "billpay"],
    payments: ["quickbooks payments", "qb payments", "payments"],
    expert: ["intuit expert", "qb expert", "expert"],
    accounting: ["quickbooks accounting", "qb accounting", "accounting"],
  };

  function detectMentionedProduct(question) {
    const q = " " + String(question).toLowerCase().replace(/[^a-z0-9]+/g, " ") + " ";
    const hits = Object.keys(PRODUCT_ALIASES).filter((pid) =>
      PRODUCT_ALIASES[pid].some((alias) => q.includes(" " + alias + " "))
    );
    // Only act when exactly one product is named -- an ambiguous or unnamed
    // question falls back to answering for whatever tab is currently open.
    return hits.length === 1 ? hits[0] : null;
  }

  // 2026-07-19: the portfolio-level counterpart to detectMentionedProduct --
  // recognizes when a question is already explicitly scoped to the blended
  // view (or is inherently cross-product, e.g. "which product..."), so
  // askAndRender's scope-clarification check (below) doesn't ask "portfolio
  // or a specific product?" when the question already answers that itself.
  const PORTFOLIO_SCOPE_RE =
    /\bportfolio\b|\bblended\b|\bcombined\b|\boverall\b|\ball products\b|\bcompany.?wide\b|\bwhich product\b|\beach product\b|\bacross (the )?product|\bacross the portfolio\b|\bevery product\b/;
  function detectPortfolioMention(question) {
    return PORTFOLIO_SCOPE_RE.test(String(question).toLowerCase());
  }

  // Resolving a reply to the "portfolio or which product?" clarifying
  // question (2026-07-19): deliberately strict (a clear product name or an
  // explicit portfolio word), not a best-effort guess -- see
  // scopeClarificationResponse() and askAndRender() for how an unresolved
  // reply is handled (re-ask once, then fall back to the open tab).
  function resolveScopeReply(text) {
    const mentioned = detectMentionedProduct(text);
    if (mentioned) return mentioned;
    if (detectPortfolioMention(text)) return "portfolio";
    return null;
  }

  // 2026-07-19: per mismatch-resolution decisions M1/M16 against the metrics-
  // definition PDFs, "Active Engaged Customers" is no longer a standalone KPI
  // card (neither source PDF defines a raw headcount metric; both are 100%
  // rate-based) and Deepening becomes the 4th card. Active-engaged customers
  // is still computed internally -- it backs the portfolio blend weighting
  // and the falloff funnel's top-of-funnel count -- it's just not its own tile.
  const KPIS = [
    { id: "activation_rate", name: "Activation Rate", unit: "pct", targeted: true },
    { id: "core_job_completion", name: "Core Job Completion", unit: "pct", targeted: true },
    { id: "habit_formation", name: "Habit Formation", unit: "pct", targeted: true },
    { id: "deepening_rate", name: "Deepening Rate", unit: "pct", targeted: true },
  ];

  // Stage-level framing, straight from the source PDF's own "Executive
  // Focus" one-liners for each portfolio metric -- applies across all four
  // products, gives each KPI column a one-word essence tag plus the sentence
  // a leader needs to know why the metric exists.
  const METRIC_REGISTRY = {
    activation_rate: {
      // 2026-07-20: "Velocity" (Doc1's original one-word tag) reads as a
      // speed metric, but this KPI measures whether a new customer starts
      // using the product at all after onboarding, not how fast -- swapped
      // to "Conversion" for the card's short tag. The longer `focus`
      // sentence below is left as the source PDF's governed language.
      essence: "Conversion",
      focus: "Measures ecosystem velocity in converting new sign-ups into active, value-realizing customers within 14 days.",
    },
    core_job_completion: {
      essence: "Reliability",
      focus: "A pure reliability index measuring operational efficiency — the share of customers who start a core workflow and finish it without friction.",
    },
    habit_formation: {
      essence: "Stickiness",
      focus: "The stickiness index assessing how effectively the product embeds into a business's recurring weekly or monthly routine.",
    },
    deepening_rate: {
      essence: "Expansion",
      focus: "The cross-sell penetration metric indicating structural stickiness driven by multi-product adoption.",
    },
  };

  // Governed, per-product metric formulas -- filled in against the source
  // metrics-definition PDFs per the M-numbered mismatch-resolution list.
  // source: "pdf" = adopted the certified PDF formula; "internal" = kept the
  // originally-built definition instead (M2/M3); "gap" = explicitly not yet
  // reconciled to a governed formula (M7). Deepening figures are stated
  // assumptions everywhere -- Intuit does not disclose per-product cross-sell
  // attach rates publicly.
  const METRIC_FORMULAS = {
    accounting: {
      activation_rate: {
        name: "Bank Feed Connection Rate",
        source: "internal",
        numerator: "Customers who complete their first bank-feed connection within 14 days",
        denominator: "New customers onboarded in the same cohort period",
        owner: "QBO Accounting Analytics",
        note: "Kept as originally built rather than the source PDF's First-Invoice Success Rate. (M2)",
      },
      core_job_completion: {
        name: "Close-Books Completion Rate",
        source: "internal",
        numerator: "Customers who complete the close-books workflow",
        denominator: "Customers who attempted the close-books workflow in the period",
        owner: "QBO Accounting Analytics",
        note: "Kept as originally built rather than the source PDF's Reconciliation Completion Rate. (M3)",
      },
      habit_formation: {
        name: "Core Accounting Habit Rate",
        source: "pdf",
        numerator: "Subscribers performing ≥2 core accounting functions in the period",
        denominator: "Total active subscribers in the cohort",
        owner: "QBO Accounting Analytics",
        note: "(M4)",
      },
      deepening_rate: {
        name: "Ecosystem Attach Velocity",
        source: "pdf",
        numerator: "Base accounting subscribers adopting ≥1 add-on service (Payments/Payroll/Bill Pay) within 90 days",
        denominator: "Total new accounting subscribers in the cohort",
        owner: "QBO Accounting Analytics",
        note: "Assumption -- not disclosed by Intuit at the per-product level.",
      },
    },
    expert: {
      activation_rate: {
        name: "First Consultation Match Rate",
        source: "gap",
        numerator: "Expert-assisted subscribers completing their first live session within 14 days",
        denominator: "Total new expert-assisted subscribers in the same cohort period",
        owner: "Expert Analytics",
        note: "Open item: not yet reconciled to the funnel's First Appointment Scheduled step — currently an independent synthetic curve. (M7)",
      },
      core_job_completion: {
        name: "Books Clean-Up Sign-Off Rate",
        source: "pdf",
        numerator: "Monthly expert engagements concluding with an approved 'Books Closed' status",
        denominator: "Total active monthly expert engagements",
        owner: "Expert Analytics",
        note: "(M5)",
      },
      habit_formation: {
        name: "Primary Expert Engagement Rate (P1)",
        source: "pdf",
        numerator: "Subscribers utilizing their priority P1 monthly expert touchpoint or review",
        denominator: "Total active expert subscribers in the cohort",
        owner: "Expert Analytics",
        note: "(M6)",
      },
      deepening_rate: {
        name: "Expert Cohort Cross-Product Rate",
        source: "pdf",
        numerator: "Active Intuit Expert subscribers who adopt ≥1 other software product",
        denominator: "Total active Intuit Expert subscribers",
        owner: "Expert Analytics",
        note: "Assumption -- not disclosed by Intuit at the per-product level.",
      },
    },
    payments: {
      activation_rate: {
        name: "First-Payment Activation Rate",
        source: "pdf",
        numerator: "New sign-ups who receive their first successful payment within 14 days of sign-up",
        denominator: "Total new sign-ups in the same cohort period",
        owner: "Payments Analytics",
      },
      core_job_completion: {
        name: "Invoice Success Rate",
        source: "pdf",
        numerator: "Unique customers with at least one successfully paid invoice",
        denominator: "Total active invoicing customers in the same period",
        owner: "Payments Analytics",
        note: "(M8)",
      },
      habit_formation: {
        name: "Active Merchant Habit Rate",
        source: "pdf",
        numerator: "Unique customers processing ≥1 transaction per week or month",
        denominator: "Total customers in the cohort timeframe",
        owner: "Payments Analytics",
        note: "(M9)",
      },
      deepening_rate: {
        name: "Money Cohort Cross-Product Rate",
        source: "pdf",
        numerator: "Active Payments/Money customers who adopt ≥1 other product",
        denominator: "Total active Payments/Money customers",
        owner: "Payments Analytics",
        note: "Assumption -- not disclosed by Intuit at the per-product level.",
      },
    },
    billpay: {
      activation_rate: {
        name: "Vendor Setup & First Pay Rate",
        source: "pdf",
        numerator: "New accounts linking a bank account & scheduling their first vendor payment within 14 days",
        denominator: "Total new Bill Pay sign-ups in the same cohort period",
        owner: "Bill Pay Analytics",
        note: "(M10)",
      },
      core_job_completion: {
        name: "On-Time Bill Settlement Rate",
        source: "pdf",
        numerator: "Uploaded bills successfully paid on/before their due date without settlement failures",
        denominator: "Total workflows/bills processed in the period",
        owner: "Bill Pay Analytics",
        note: "(M11)",
      },
      habit_formation: {
        name: "High-Frequency Bill Pay Rate",
        source: "pdf",
        numerator: "Unique customers scheduling ≥2 bills per week (or ≥8 bills per month)",
        denominator: "Total active Bill Pay customers in the cohort",
        owner: "Bill Pay Analytics",
        note: "(M12)",
      },
      deepening_rate: {
        name: "Bill Pay Multi-Product / Recurring Rate",
        source: "pdf",
        numerator: "Bill Pay users who set up automated recurring bills OR adopt ≥1 other ecosystem product",
        denominator: "Total active Bill Pay users",
        owner: "Bill Pay Analytics",
        note: "Assumption -- not disclosed by Intuit at the per-product level.",
      },
    },
  };

  const SOURCE_LABEL = { pdf: "PDF-certified definition", internal: "Internal definition (kept as originally built)", gap: "Open item — not yet reconciled to a governed formula" };

  const WORKFLOW_LABEL = {
    accounting: "Connect bank → categorize transactions → close books",
    expert: "Request expert help → share context → resolve issue",
    payments: "Send invoice → accept payment → reconcile cash",
    billpay: "Add vendor → schedule bill → confirm payment",
  };

  const FRICTION_LABEL = {
    accounting: "Bank feed connection",
    expert: "First appointment scheduled",
    payments: "First paid invoice",
    billpay: "Vendor verification",
  };

  // Product palette intentionally avoids the brand blue (nav/structure), the
  // semantic green (on-target), and the semantic crimson (risk) hues so a
  // product's line color is never mistaken for a status signal.
  const COLORS = {
    accounting: "#6D5DD3",
    expert: "#1E9E9E",
    payments: "#D18B2C",
    billpay: "#B0559C",
    bar: "#0C5FE0",
    line: "#0C5FE0",
    risk: "#B3413A",
    good: "#1F8A4C",
    watch: "#C98A2B",
    neutral: "#8A94A3",
  };

  /* ---------------- date / week helpers ---------------- */

  function genWeeks(n, lastMondayStr) {
    const last = new Date(lastMondayStr + "T00:00:00");
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(last);
      d.setDate(d.getDate() - 7 * i);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }

  const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // 2026-07-20 axis-label format change (per direct request): week-grain
  // labels are "M/D/YY" (e.g. "7/19/26" -- month/day NOT zero-padded, 2-digit
  // year) and month-grain labels are "MM/YY" (e.g. "06/26" -- month IS
  // zero-padded here, unlike the week format -- matches the two example
  // strings given exactly, not a single shared date format). Both feed
  // toGrain()'s chart axis labels; fmtWeekLabel also feeds the chat's trend-
  // answer date span and fmtMonthLabel also feeds the KPI card's own month
  // tag, so both surfaces pick up the same format for consistency.
  function fmtWeekLabel(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
  }
  function fmtMonthKey(dateStr) {
    return dateStr.slice(0, 7);
  }
  function fmtMonthLabel(monthKey) {
    const [y, m] = monthKey.split("-");
    return `${m}/${y.slice(2)}`;
  }

  // Anchor the demo to "today" (whenever this file is actually opened) rather
  // than a hardcoded date, so the dashboard always shows the most recently
  // completed Mon–Sun week and never looks stale.
  function mostRecentCompletedWeekMonday(d) {
    const daysSinceSunday = d.getDay(); // 0=Sun..6=Sat
    const lastSunday = new Date(d);
    lastSunday.setDate(d.getDate() - daysSinceSunday);
    lastSunday.setHours(0, 0, 0, 0);
    const monday = new Date(lastSunday);
    monday.setDate(lastSunday.getDate() - 6);
    return { monday, lastSunday };
  }
  function fmtFullDate(d) {
    return `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  const { monday: LAST_MONDAY, lastSunday: LAST_SUNDAY } = mostRecentCompletedWeekMonday(new Date());
  const WEEKS = genWeeks(12, LAST_MONDAY.toISOString().slice(0, 10));
  const REFRESH_TS = `${fmtFullDate(LAST_SUNDAY)} · 6:02 AM PT`;

  // "Custom range" is bounded to the months the generated 12-week window
  // actually covers -- the synthetic series only exists for that window (see
  // windowedWeeks below), so the From/To pickers only ever offer real,
  // selectable months rather than years the dashboard has no data for.
  const AVAILABLE_MONTHS = Array.from(new Set(WEEKS.map(fmtMonthKey))).sort();
  const AVAILABLE_YEARS = Array.from(new Set(AVAILABLE_MONTHS.map((m) => m.slice(0, 4)))).sort();
  const AVAILABLE_MONTH_NUMS = Array.from(new Set(AVAILABLE_MONTHS.map((m) => parseInt(m.slice(5, 7), 10)))).sort((a, b) => a - b);

  /* ---------------- synthetic series generation ---------------- */

  // Deterministic pseudo-random noise (2026-07-20, per direct feedback: the
  // pure trend+sine curve was too smooth to show real MoM/QoQ business
  // fluctuation). Deliberately NOT Math.random() -- a seeded generator keeps
  // every reload byte-identical, which matters both for the live demo (the
  // Executive Summary/chat numbers shouldn't change every time the page is
  // opened) and for test-run.js (assertions need reproducible values). Seeded
  // per product+metric (see buildData below) so different series don't share
  // an identical noise pattern just because they happen to share a CONFIG
  // phase value.
  function hashSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    return h >>> 0;
  }
  function seededRandom(seed) {
    let t = seed >>> 0;
    return function () {
      t = (t + 0x6d2b79f5) | 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  // One noise value per week, scaled to `amplitude`. Blends 65% fresh
  // randomness with 35% of the prior week's value (a light AR(1) blend) so
  // consecutive weeks wobble up and down organically -- like real week-to-
  // week business noise -- rather than jittering independently every week
  // like static.
  function noiseSeries(n, seed, amplitude) {
    const rand = seededRandom(seed);
    const out = [];
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const raw = rand() * 2 - 1;
      const v = raw * amplitude * 0.65 + prev * 0.35;
      out.push(v);
      prev = v;
    }
    return out;
  }

  function seriesFor(base, trend, amp, phase, n, seedStr) {
    // Noise amplitude ties partly to |trend|, not just amp: a series with a
    // steep underlying slope (e.g. Bill Pay's declining Habit Formation,
    // trend -0.68pt/wk) needs proportionally more noise than a flat one to
    // actually show a local up-tick against that slope -- amp alone (the
    // seasonal wave's size) wasn't enough to ever reverse a steep trend, so
    // every steep-trend series still rendered as a smooth monotonic line.
    const amplitude = amp * 0.8 + Math.abs(trend) * 1.5;
    const noise = seedStr ? noiseSeries(n, hashSeed(seedStr), amplitude) : null;
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(base + trend * i + amp * Math.sin((i + phase) / 3.2) + (noise ? noise[i] : 0));
    }
    return out;
  }
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  // Calibration notes (2026-07-18 recalibration against Intuit's actual FY2025
  // Form 10-K and FY2026 Q3 Form 10-Q):
  //
  // 1) active_engaged.base is now set to match each product's top-of-funnel
  //    FALLOFF_BASE entered count (was previously off by ~30-36% for Expert,
  //    Payments, and Bill Pay -- the KPI tile and the workflow funnel table
  //    were describing the same weekly cohort with two different numbers,
  //    which breaks the "dashboard and AI always reconcile" premise).
  // 2) active_engaged.trend is grounded in disclosed growth rates: Online
  //    Ecosystem paying customers grew a modest +5% YoY in FY25 (10-K) --
  //    used for Accounting/Expert -- while Payments/Bill Pay ("money"
  //    offerings) grew faster per the Q3 FY26 10-Q commentary on payments
  //    customer growth and volume/customer growth, so those use ~9%/yr.
  //    (Revenue grew much faster than either -- +14% ARPC in FY25 -- but that's
  //    price/mix, not customer count, so it isn't used as a volume driver here.)
  // 3) Rate KPI base/trend values were re-solved so activation_rate >=
  //    core_job_completion >= habit_formation holds in every week for every
  //    product (previously violated for Expert, Payments, and Bill Pay --
  //    only Accounting had this right). Bill Pay's core_job_completion trend
  //    was also flipped from rising to falling: vendor-verification friction
  //    that drags down habit formation should drag down core job completion
  //    too, since habit formation is repeated core completion.
  const CONFIG = {
    accounting: {
      // Rescaled 2026-07-19: QBO Accounting active-engaged base set to ~7M,
      // matching QBO's 7M+ total paying-subscriber base (FY25 10-K). Trend/
      // amplitude scaled by the same ~33.3x factor vs. the original 210K
      // calibration so the underlying growth rate and week-to-week noise
      // ratio are unchanged.
      active_engaged: { base: 7000000, trend: 7200, amp: 126000, phase: 0 },
      activation_rate: { base: 79.5, trend: 0.377, amp: 1.3, phase: 1, target: 83 },
      core_job_completion: { base: 67.36, trend: 0.411, amp: 1.1, phase: 2, target: 70.2 },
      habit_formation: { base: 37.84, trend: 0.327, amp: 1.0, phase: 0.5, target: 41.4 },
      // Deepening = Ecosystem Attach Velocity (base accounting subscribers
      // adopting >=1 add-on within 90 days). Not disclosed by Intuit publicly
      // at the per-product level -- this is a stated assumption, not a
      // calibrated figure like active_engaged above.
      deepening_rate: { base: 17.5, trend: 0.14, amp: 1.0, phase: 0.5, target: 21.5 },
    },
    expert: {
      active_engaged: { base: 40000, trend: 41.2, amp: 720, phase: 0.3 },
      activation_rate: { base: 86.46, trend: 0.29, amp: 1.2, phase: 1.2, target: 85 },
      core_job_completion: { base: 56.75, trend: 0.342, amp: 1.0, phase: 0.8, target: 59.2 },
      habit_formation: { base: 25.55, trend: 0.286, amp: 1.0, phase: 1.5, target: 28.4 },
      // Deepening = Expert Cohort Cross-Product Rate. Set high relative to
      // the other three products: expert-assisted bookkeeping is typically
      // sold as an add-on to an existing QBO subscription, so most Expert
      // customers already hold >=1 other product by definition. Assumption,
      // not a disclosed figure.
      deepening_rate: { base: 73, trend: 0.18, amp: 1.0, phase: 1.0, target: 77.5 },
    },
    payments: {
      // Rescaled 2026-07-19: Payments active-engaged base set to ~1M per
      // user-confirmed context. Trend/amplitude scaled by the same ~8.33x
      // factor vs. the prior 120K calibration so the growth rate is unchanged.
      active_engaged: { base: 1000000, trend: 1826, amp: 18000, phase: 0.6 },
      activation_rate: { base: 88.76, trend: 0.235, amp: 1.1, phase: 0.4, target: 90 },
      core_job_completion: { base: 60.66, trend: 0.361, amp: 1.1, phase: 1.0, target: 62.2 },
      habit_formation: { base: 30.94, trend: 0.219, amp: 1.0, phase: 0.2, target: 32.4 },
      // Deepening = Money Cohort Cross-Product Rate. Assumption, not disclosed.
      deepening_rate: { base: 41, trend: 0.2, amp: 1.1, phase: 0.3, target: 45.5 },
    },
    billpay: {
      active_engaged: { base: 58000, trend: 105.9, amp: 1044, phase: 0.9 },
      activation_rate: { base: 89.68, trend: 0.155, amp: 1.0, phase: 0.7, target: 88 },
      core_job_completion: { base: 67.53, trend: -0.8, amp: 1.1, phase: 1.4, target: 63.2 },
      habit_formation: { base: 35.89, trend: -0.676, amp: 1.2, phase: 0.3, target: 33.4 },
      // Deepening = Bill Pay Multi-Product/Recurring Rate (recurring bills OR
      // >=1 other product -- an OR condition, so set higher than a pure
      // cross-sell-only metric would be). Assumption, not disclosed.
      deepening_rate: { base: 57, trend: 0.16, amp: 1.2, phase: 0.6, target: 61.5 },
    },
  };

  // 2026-07-20 target recalibration: too many KPI cards were showing a
  // "watch"/"risk" gap even when the metric itself was healthy, because the
  // original per-product targets (set during the M1-M16 PDF reconciliation)
  // were pegged a bit aggressively above where the synthetic trend actually
  // lands. Rather than pick four new numbers from scratch, this applies one
  // flat pts reduction to every product's target for the three metrics that
  // were flagging too often -- Core Job Completion -2.8, Habit Formation
  // -1.6, Deepening Rate -0.5 -- and leaves Activation Rate untouched (it
  // was already reading fine). Because every product is filtered under the
  // same global filter state (so `rateMult` is identical across products
  // for a given filter selection), subtracting the same flat constant from
  // every product's raw target shifts the portfolio's active_engaged-
  // weighted blended target by that exact same constant -- so this was
  // sized to land the portfolio tab's blended targets at 83.9 / 69.1 / 40.2
  // / 25, matching what was asked for, while keeping every product's own
  // target a fixed, real number (not a portfolio-only override that would
  // no longer reconcile with the per-product figures).

  // ITPY (vs. Prior Year) for the four rate KPI cards. The 12-week trend in
  // CONFIG above was only ever calibrated to look reasonable across that
  // short window -- extending it a full year back was tested and rejected
  // (2026-07-20): it implies double-digit point swings and, for Bill Pay
  // Core Job Completion, a mathematically impossible >100% starting value.
  // Instead this is a separate, deliberately modest, explicitly-assumed
  // annual point change per product/metric -- NOT derived from the 12-week
  // trend -- kept directionally consistent with each metric's own trend sign
  // (e.g. Bill Pay's declining core-job/habit trend gets a negative
  // assumption here too) but capped to a plausible year-over-year range for
  // a mature product. Not a disclosed figure.
  const YOY_ASSUMPTION = {
    accounting: { activation_rate: 2.5, core_job_completion: 2.0, habit_formation: 1.5, deepening_rate: 1.5 },
    expert: { activation_rate: 1.5, core_job_completion: 1.5, habit_formation: 1.0, deepening_rate: 2.0 },
    payments: { activation_rate: 2.0, core_job_completion: 1.5, habit_formation: 1.5, deepening_rate: 2.0 },
    billpay: { activation_rate: 1.0, core_job_completion: -1.5, habit_formation: -1.0, deepening_rate: 1.5 },
  };

  // Absolute-volume assumptions (2026-07-20): a CEO wants raw counts
  // alongside the rate KPIs above. Two of the four requested views need no
  // new assumption -- they're derived directly from data already in the
  // model: "Deepened (2+ Products)" is active_engaged x deepening_rate, and
  // (2026-07-19 correction) "Complete Core Task" is active_engaged x
  // core_job_completion_rate -- the actual count of customers who finished
  // their core workflow, not the count who merely attempted it (that
  // "attempted" framing double-counted the same population Active Engaged
  // Customers already reports, since the workflow-falloff table's
  // top-of-funnel "entered" count was reconciled to equal
  // active_engaged.base in the 2026-07-18 recalibration -- it added no new
  // information paired next to Core Job Completion rate the way the other
  // three volume charts each pair a genuinely different count with their
  // rate). The other two still need a new, modest, explicitly-flagged
  // assumption each, since nothing in the model tracks gross new-signup
  // volume or individual customer tenure history:
  //   - NEW_COHORT_RATE: gross new signups per week, as a share of
  //     active_engaged (higher than active_engaged's own net growth rate,
  //     since gross signups also replace churned customers). Not disclosed.
  //   - THREE_MONTH_ACTIVE_SHARE: the share of the active_engaged base with
  //     3+ months of continuous activity. Not disclosed.
  const NEW_COHORT_RATE = { accounting: 0.011, expert: 0.014, payments: 0.013, billpay: 0.016 };
  const THREE_MONTH_ACTIVE_SHARE = { accounting: 0.72, expert: 0.65, payments: 0.68, billpay: 0.6 };

  // 2026-07-20 wording correction: these bar charts are the actual customer
  // counts -- the base operational data (sign-ups, activations, falloffs) --
  // not an estimate calculated off of a rate. The correct read is the other
  // way around: a count is measured first, and the paired rate chart is
  // what gets *calculated* by dividing a count by a total (rate = count /
  // total). Where a count still depends on a documented, not-yet-disclosed
  // volume assumption (new-signup share, 3-month-tenure share), that's
  // called out plainly, but it's described as a count using an assumption,
  // not as an "estimated" number in its own right.
  const VOLUME_METRICS = [
    {
      id: "newlyActivated",
      label: "Number of Customer Newly Activated",
      axisLabel: "Customers",
      definition: "Count of customers newly activated this period -- the actual customer count behind Activation Rate (Activation Rate = this count / total new customers). Total new customers uses a documented gross-signup-share assumption, not yet a disclosed figure.",
    },
    {
      id: "completedCoreTask",
      label: "Number of Customer Complete Core Task",
      axisLabel: "Customers",
      definition: "Count of customers who completed their core workflow this period -- the actual customer count behind Core Job Completion rate (Core Job Completion = this count / customers who attempted the core workflow, i.e. Active Engaged Customers).",
    },
    {
      id: "threeMonthActive",
      label: "Number of Customer Active over 3 Months",
      axisLabel: "Customers",
      definition: "Count of customers active for 3+ consecutive months, using a documented 3-month-tenure-share assumption (not yet a disclosed figure) to split out this cohort from the total active base.",
    },
    {
      id: "deepenedCustomers",
      label: "Number of Customer with over 2 Products",
      axisLabel: "Customers",
      definition: "Count of customers using 2 or more products this period -- the actual customer count behind Deepening Rate (Deepening Rate = this count / total active customers).",
    },
  ];

  function buildData() {
    const productData = {};
    const targets = {};
    PRODUCTS.forEach((p) => {
      productData[p.id] = {};
      targets[p.id] = {};
      // active_engaged is computed for every product even though it's not in
      // KPIS (not a KPI card anymore, per M1/M16) -- it's still needed as the
      // portfolio blend weight and to reconcile against the falloff funnel.
      const ae = CONFIG[p.id].active_engaged;
      productData[p.id].active_engaged = seriesFor(ae.base, ae.trend, ae.amp, ae.phase, WEEKS.length, `${p.id}:active_engaged`).map((v) =>
        Math.max(0, v)
      );
      KPIS.forEach((k) => {
        const c = CONFIG[p.id][k.id];
        productData[p.id][k.id] = seriesFor(c.base, c.trend, c.amp, c.phase, WEEKS.length, `${p.id}:${k.id}`).map((v) =>
          k.unit === "pct" ? clamp(v, 1, 99) : Math.max(0, v)
        );
        if (c.target != null) targets[p.id][k.id] = c.target;
      });
    });
    return { productData, targets };
  }
  const DATA = buildData();

  /* ---------------- falloff / workflow step data ---------------- */

  const FALLOFF_BASE = {
    accounting: [
      // Scaled with active_engaged.base above (same ~33.3x factor, abandon
      // rates held constant) so the funnel's top-of-funnel count still equals
      // the KPI tile's count for the same weekly cohort.
      { step: "Connect bank feed", entered: 7000000, completed: 5768000 },
      { step: "Categorize transactions", entered: 5768000, completed: 4967000 },
      { step: "Close books", entered: 4967000, completed: 4268000 },
    ],
    expert: [
      { step: "Request expert help", entered: 40000, completed: 34000 },
      { step: "First appointment scheduled", entered: 34000, completed: 22000 },
      { step: "Share context", entered: 22000, completed: 20000 },
      { step: "Resolve issue", entered: 20000, completed: 18500 },
    ],
    payments: [
      // Scaled with active_engaged.base above (same ~8.33x factor) so the
      // funnel's top-of-funnel count still equals the KPI tile's count.
      { step: "Send invoice", entered: 1000000, completed: 867000 },
      { step: "Accept first paid invoice", entered: 718000, completed: 578000 },
      { step: "Reconcile cash", entered: 578000, completed: 483000 },
    ],
    billpay: [
      { step: "Add vendor", entered: 58000, completed: 51000 },
      { step: "Vendor verification", entered: 42500, completed: 28900 },
      { step: "Schedule bill", entered: 28900, completed: 25500 },
      { step: "Confirm payment", entered: 25500, completed: 23800 },
    ],
  };

  // Qualitative "why customers fall off here" notes, sourced from a
  // user-provided reference doc ("QuickBooks Ecosystem: Top Product
  // Fallouts & Friction Points", logged in docs/knowledge-base.md). These
  // are narrative reasons, not certified/synthetic data -- they carry no
  // rate or count of their own and never feed FALLOFF_BASE, the KPI
  // cards, or the AI chat's cited numbers. The step each note is attached
  // to is this project's own judgment-call mapping (the source doc
  // organizes by product, not by funnel step), meant to give a reader
  // "here's a plausible reason why" alongside the governed quantitative
  // ranking -- never as a substitute for it. Steps with no doc-sourced
  // reason simply get no icon, rather than inventing one.
  const FALLOFF_REASON_NOTES = {
    accounting: {
      "Categorize transactions":
        "Reported cause: transactions pile up in the 'For Review' queue over months until the backlog causes users to abandon the tab; separately, blind bulk-approve / auto-rules can misclassify loan payments or personal distributions as business expenses.",
      "Close books":
        "Reported cause: a cleared bank-feed queue gets mistaken for accurate books, so month-end reconciliation gets skipped and duplicate or missing transactions go undetected.",
    },
    expert: {
      "Share context":
        "Reported cause: users expect the expert to find physical receipts, invoices, or loan agreements without being asked, so month-end close stalls when files aren't uploaded to the document hub.",
      "Resolve issue":
        "Reported cause: ambiguous transactions sit in an 'Ask My Client' queue that users routinely ignore, blocking tax-ready statements; unsanctioned third-party app connections (e.g. Shopify, Square) can also break the chart of accounts and force manual clean-up before an issue can close.",
    },
    payments: {
      "Accept first paid invoice":
        "Reported cause: standard rolling 30-day volume caps get hit mid-month by growing businesses, causing subsequent card charges to reject until a manual limit-increase request.",
      "Reconcile cash":
        "Reported cause: an unusually large transaction can trigger an automatic risk/fraud payout freeze, and separately, weekend/holiday/clearing delays on 'Instant Deposit' settlement get mistaken for a systemic glitch, prompting duplicate tickets.",
    },
    billpay: {
      "Vendor verification":
        "Reported cause: users enter a vendor's 'Doing Business As' name instead of their legal bank-account name, so the receiving institution auto-rejects or voids the transfer.",
      "Schedule bill": "Reported cause: an emergency same-day vendor payment gets blocked because Bill Pay requires a minimum one-business-day processing window.",
      "Confirm payment": "Reported cause: large payments or bulk contractor payroll crossing the $25,000 single-transaction cap get blocked without an explanation of the limit.",
    },
  };
  function falloffReasonNote(productId, step) {
    const forProduct = FALLOFF_REASON_NOTES[productId];
    return (forProduct && forProduct[step]) || null;
  }

  // Falloff-trend assumption (2026-07-20): the driver section only ever
  // showed one current-period snapshot per step, so leadership couldn't tell
  // whether a friction point was getting better or worse over time.
  // FALLOFF_BASE has no week-indexed history to draw on (it's a single
  // entered/completed pair per step), so rather than invent an unrelated
  // number, this weekly drift is *derived* from each product's own
  // already-calibrated core_job_completion trend
  // (CONFIG[id].core_job_completion.trend, pts/week of rising completion) --
  // a rising completion rate implies a falling abandon rate and vice versa,
  // so the sign is flipped. Scaled down (x0.12) because a funnel step's
  // abandon rate sits closer to its own floor/ceiling than the top-line
  // completion metric does. Applied uniformly across a product's funnel
  // steps (no per-step split -- there's no signal in the source data to
  // differentiate one step's trend from another's). Flagged here as a new,
  // small, explicitly-not-disclosed assumption, same discipline as
  // YOY_ASSUMPTION above.
  const FALLOFF_WEEKLY_DRIFT = {};
  PRODUCTS.forEach((p) => {
    FALLOFF_WEEKLY_DRIFT[p.id] = -CONFIG[p.id].core_job_completion.trend * 0.12;
  });

  // Full (unwindowed, 12-week) abandon-rate trend per funnel step, in pct
  // points (0-100) to match how buildRateTargetSVG expects its line series.
  // The most recent week is anchored to exactly the same value
  // computeFalloff() would report for the same rateMult, so the trend chart
  // and the ranked driver list never disagree on "today's" number -- only
  // the walk back through prior weeks is synthetic.
  function computeFalloffWeekly(productId, rateMult) {
    const drift = FALLOFF_WEEKLY_DRIFT[productId];
    return FALLOFF_BASE[productId].map((s, stepIdx) => {
      const baseAbandonRate = 1 - s.completed / s.entered;
      const currentAdj = clamp(baseAbandonRate / clamp(rateMult, 0.4, 1.8), 0.02, 0.85) * 100;
      // 2026-07-20: swapped the fixed-amplitude deterministic sine wobble for
      // the same seeded noise used for the KPI trend lines -- the old 0.5-pt
      // sine could land near-monotonic across a 12-week window depending on
      // stepIdx's phase offset (no guaranteed reversal), and didn't scale
      // with drift the way seriesFor's noise now scales with trend. Seeded
      // per product+step so each funnel step wobbles independently.
      const wobbleSeries = noiseSeries(WEEKS.length, hashSeed(`${productId}:falloff:${stepIdx}`), 0.8 + Math.abs(drift) * 3);
      const series = WEEKS.map((w, i) => {
        const weeksAgo = WEEKS.length - 1 - i;
        // No wobble at weeksAgo === 0: the most recent point must equal
        // currentAdj exactly, so the trend line's last point never drifts
        // from the ranked list's "today" number.
        const wobble = weeksAgo === 0 ? 0 : wobbleSeries[i];
        return clamp(currentAdj - drift * weeksAgo + wobble, 2, 90);
      });
      return { step: s.step, series };
    });
  }

  // Absolute-count companion to the falloff rate views: how many customers
  // actually fell off (summed across every funnel step for this product),
  // not just what share. `entered` is static per the current filter state
  // (the same convention the rest of this section already uses for funnel
  // volume), so this just re-weights the same weekly abandon-rate series
  // computeFalloffWeekly() produces.
  function falloffVolumeWeekly(productId, share, rateMult) {
    const steps = computeFalloff(productId, share, rateMult);
    const weeklyAll = computeFalloffWeekly(productId, rateMult);
    return WEEKS.map((w, i) => steps.reduce((sum, s, si) => sum + s.entered * (weeklyAll[si].series[i] / 100), 0));
  }

  // Clones filters with a single dimension pinned to one value, for the
  // "Split by" feature (Portfolio and, per 2026-07-19, QBO Accounting): any
  // of the four segmentation filters can be pinned this way when
  // recomputing a per-segment line/stack/ranking column.
  function filtersPinned(filters, dimKey, value) {
    return Object.assign({}, filters, { [dimKey]: [value] });
  }

  // The three falloff-section helpers below all generalize an existing,
  // already-governed computation (computeFalloff / computeFalloffWeekly /
  // falloffVolumeWeekly, fed by combineAllDims's real segment share/rate-lift
  // formula) to accept an arbitrary filters override, rather than only the
  // outer tab's current filters -- so the falloff charts and ranking can be
  // recomputed once per segment value (pinning that one dimension, combining
  // the rest normally) the same way the KPI charts already are. This is not
  // new/invented data: FALLOFF_BASE's step counts are unchanged, only the
  // same share/rateMult adjustment every other segment-aware number in this
  // model already applies is being pinned to one value at a time instead of
  // blended across the current selection.

  // Pooled, ranked funnel steps across a set of products under a given
  // filters override. Reused for the Combined "top 4 across the portfolio"
  // ranking (today's behavior, product pooled) and, when Split by is a
  // segmentation dimension, once per segment value's own column -- a step
  // belongs to a product, not a segment, so a segment-value column still
  // needs to pool across products, just with that value pinned.
  function pooledFalloffSteps(included, filters, bd) {
    const dims2 = combineAllDims(filters);
    const lfmDrv = lastFullMonthIndices();
    return included
      .flatMap((pid) => {
        const steps = computeFalloff(pid, dims2.share * bd.share, dims2.rateMult * bd.rateMult);
        const weeklyAll = computeFalloffWeekly(pid, dims2.rateMult * bd.rateMult);
        return steps.map((s, i) => {
          const weeklyFull = weeklyAll[i].series;
          const vsWeek = weeklyFull[weeklyFull.length - 1] - weeklyFull[weeklyFull.length - 2];
          const vsMonth = lfmDrv.priorIdx != null ? weeklyFull[lfmDrv.curIdx] - weeklyFull[lfmDrv.priorIdx] : null;
          return {
            step: s.step,
            product: PRODUCT_BY_ID[pid].short,
            productId: pid,
            abandonRate: s.abandonRate,
            abandoned: s.abandoned,
            entered: s.entered,
            vsWeek,
            vsMonth,
            significance: sigTier(s.abandonRate),
          };
        });
      })
      .sort((a, b) => b.abandonRate - a.abandonRate);
  }

  // Single blended "portfolio falloff" trend line (full WEEKS window):
  // each included product's own single worst-friction step, weighted by
  // that step's funnel volume into one number -- same method
  // computePortfolioTab's default combinedTrend already uses, generalized
  // to an arbitrary filters override so it can be recomputed once per
  // segment value instead of only the tab's actual current selection.
  function combinedFalloffTrendFor(included, filters, bd) {
    const dims2 = combineAllDims(filters);
    const perProductWorst = included.map((pid) => {
      const steps = computeFalloff(pid, dims2.share * bd.share, dims2.rateMult * bd.rateMult);
      const worst = steps.reduce((a, b) => (b.abandonRate > a.abandonRate ? b : a));
      const worstIdx = steps.indexOf(worst);
      const weeklyFull = computeFalloffWeekly(pid, dims2.rateMult * bd.rateMult)[worstIdx].series;
      return { trend: weeklyFull, entered: worst.entered };
    });
    return WEEKS.map((w, i) => {
      let num = 0,
        den = 0;
      perProductWorst.forEach((d) => {
        num += d.trend[i] * d.entered;
        den += d.entered;
      });
      return den ? num / den : 0;
    });
  }

  // One product's own overall/blended falloff rate (2026-07-20 fix): the
  // Separated + Split by Product view of the Workflow Falloff Trend chart
  // was plotting each product's SINGLE worst-friction step (label "Product
  // -- Step"), not a product-level rate -- inconsistent with every other
  // Split by option, which blends into one overall number per line (Combined
  // blends each product's worst step across products; a segment-dimension
  // split blends across products with that segment pinned). Product split
  // should blend the other way: across that ONE product's own funnel steps,
  // weighted by each step's own entered volume -- same "weighted average of
  // abandon rates" convention as combinedTrend/combinedFalloffTrendFor
  // above, just changing which axis is being blended.
  function productFalloffTrendFor(pid, filters, bd) {
    const dims2 = combineAllDims(filters);
    const steps = computeFalloff(pid, dims2.share * bd.share, dims2.rateMult * bd.rateMult);
    const weeklyAll = computeFalloffWeekly(pid, dims2.rateMult * bd.rateMult);
    return WEEKS.map((w, i) => {
      let num = 0,
        den = 0;
      steps.forEach((s, si) => {
        num += weeklyAll[si].series[i] * s.entered;
        den += s.entered;
      });
      return den ? num / den : 0;
    });
  }

  // Summed absolute falloff-count series across a set of products under a
  // given filters override -- same "sum raw counts, don't blend" convention
  // the other absolute-count charts use, generalized the same way as the
  // two helpers above.
  function falloffVolumeFor(included, filters, bd) {
    const dims2 = combineAllDims(filters);
    return WEEKS.map((w, i) => included.reduce((s, pid) => s + falloffVolumeWeekly(pid, dims2.share * bd.share, dims2.rateMult * bd.rateMult)[i], 0));
  }

  // Product-tab equivalents of the three Portfolio segment-split helpers
  // above, for a single product's own Split by (2026-07-19, QBO Accounting).
  // Same idea -- pin one dimension, recompute the existing governed
  // share/rateMult adjustment -- but product tabs fold in their Bundle
  // Products effect differently than Portfolio's Bundle Depth, so these
  // reuse productSeriesForFilters's own totalShare/totalRateMult (which
  // already accounts for that) instead of a separate `bd` multiplier.

  // This product's own funnel steps, ranked by abandon rate, under a given
  // filters override -- the Split-by-segment equivalent of the ranked
  // .falloff-list already shown by default, just recomputed once per
  // segment value with that dimension pinned.
  function falloffStepsForProduct(productId, filters) {
    const base = productSeriesForFilters(productId, filters);
    const lfmDrv = lastFullMonthIndices();
    const weeklyAll = computeFalloffWeekly(productId, base.totalRateMult);
    return computeFalloff(productId, base.totalShare, base.totalRateMult).map((s, i) => {
      const weeklyFull = weeklyAll[i].series;
      const vsWeek = weeklyFull[weeklyFull.length - 1] - weeklyFull[weeklyFull.length - 2];
      const vsMonth = lfmDrv.priorIdx != null ? weeklyFull[lfmDrv.curIdx] - weeklyFull[lfmDrv.priorIdx] : null;
      return { step: s.step, abandonRate: s.abandonRate, abandoned: s.abandoned, entered: s.entered, vsWeek, vsMonth, significance: sigTier(s.abandonRate) };
    });
  }

  // This product's single worst-friction step's abandon-rate trend (full
  // WEEKS window), under a given filters override -- the Split-by-segment
  // equivalent of Portfolio's combinedFalloffTrendFor, minus the
  // cross-product weighting (nothing to weight against with one product).
  function worstStepTrendForProduct(productId, filters) {
    const base = productSeriesForFilters(productId, filters);
    const steps = computeFalloff(productId, base.totalShare, base.totalRateMult);
    const worst = steps.reduce((a, b) => (b.abandonRate > a.abandonRate ? b : a));
    const worstIdx = steps.indexOf(worst);
    return computeFalloffWeekly(productId, base.totalRateMult)[worstIdx].series;
  }

  // This product's total falloff-count series (summed across its own
  // funnel steps), under a given filters override.
  function falloffVolumeForProduct(productId, filters) {
    const base = productSeriesForFilters(productId, filters);
    return falloffVolumeWeekly(productId, base.totalShare, base.totalRateMult);
  }

  // Significance tier for a single funnel step's abandon rate (judgment
  // call, not a disclosed threshold): used both for the cross-product
  // "worst driver per product" ranking and the per-product step breakdown
  // below it, so the same step is never called "High" in one place and
  // "Medium" in the other.
  function sigTier(abandonRate) {
    return abandonRate >= 0.3 ? "High" : abandonRate >= 0.15 ? "Medium" : "Low";
  }

  // Shared falloff-ranking-card formatting -- used by Portfolio's driver
  // columns and (2026-07-19) the Accounting tab's falloff ranking, so both
  // read the same significance color and wk/mo delta text the same way.
  const SIG_CLASS = { High: "risk", Medium: "watch", Low: "good" };
  function fmtDeltaPts(v) {
    return v == null ? "n/a" : `${v >= 0 ? "+" : ""}${v.toFixed(1)} pts`;
  }

  /* ---------------- filter dimensions (segment share + rate lift) ---------------- */

  const FILTER_DIMS = {
    companySize: {
      label: "Company Size",
      options: [
        { v: "Solopreneur", share: 0.38, rateMult: 0.9 },
        { v: "Small Business", share: 0.47, rateMult: 1.05 },
        { v: "Mid-Market", share: 0.15, rateMult: 1.18 },
      ],
    },
    tenure: {
      // M14: switched to the source PDF's tenure cohort buckets (0-30 days /
      // 31-90 days / 1 Year+) in place of the original 4-bucket New/Ramping/
      // Established/Mature scheme.
      label: "Tenure",
      options: [
        { v: "0-30 days", share: 0.18, rateMult: 0.75 },
        { v: "31-90 days", share: 0.24, rateMult: 0.92 },
        { v: "1 Year+", share: 0.58, rateMult: 1.15 },
      ],
    },
    industry: {
      label: "Industry",
      options: [
        { v: "Construction", share: 0.24, rateMult: 1.02 },
        { v: "Professional Services", share: 0.31, rateMult: 1.08 },
        { v: "Real Estate", share: 0.18, rateMult: 0.96 },
        { v: "Other Services", share: 0.2, rateMult: 0.94 },
        { v: "Other", share: 0.07, rateMult: 0.9 },
      ],
    },
    country: {
      label: "Country",
      options: [
        { v: "United States", share: 0.92, rateMult: 1.02 },
        { v: "Other", share: 0.08, rateMult: 0.85 },
      ],
    },
  };

  // Per-product-only filter dimensions (2026-07-20, per direct request): a
  // Plan/Service Offering filter scoped to exactly one product tab, unlike
  // FILTER_DIMS above (Company Size/Tenure/Industry/Country), which apply
  // identically across all four products. Deliberately kept in a SEPARATE
  // object, not merged into FILTER_DIMS -- several places generically do
  // `Object.keys(FILTER_DIMS).forEach(...)` for the Executive Summary's
  // segment-lens candidates (segmentDriverPortfolio/Product,
  // aecSegmentDriverPortfolio); merging these in would make e.g. "QBO Plan"
  // a pinnable candidate while computing Bill Pay's or Portfolio's segment
  // lens, which is nonsensical -- a plan/service tier only exists for its
  // own product. Keyed by tabId so `PRODUCT_FILTER_DIMS[tabId]` is the
  // lookup used everywhere a product tab needs "does this tab have its own
  // extra dimension, and what is it."
  //
  // Share/rateMult figures are illustrative modeling assumptions (no public
  // Intuit disclosure breaks out engagement by plan/service tier), chosen
  // to be directionally sensible -- higher/more full-service tiers skew
  // toward smaller, more-invested customer bases with higher engagement --
  // not calibrated against a real figure the way Company Size/Tenure were.
  // Real-world plan names sourced from quickbooks.intuit.com (QBO tiers,
  // Bill Pay Basic/Premium/Elite) and Intuit's QuickBooks Live Expert
  // Assisted / Full-Service Bookkeeping service pages, per 2026-07 pricing.
  const PRODUCT_FILTER_DIMS = {
    accounting: {
      key: "qboPlan",
      label: "Plan",
      options: [
        { v: "Solopreneur", share: 0.22, rateMult: 0.85 },
        { v: "Simple Start", share: 0.28, rateMult: 0.95 },
        { v: "Essentials", share: 0.27, rateMult: 1.05 },
        { v: "Plus", share: 0.18, rateMult: 1.15 },
        { v: "Advanced", share: 0.05, rateMult: 1.3 },
      ],
    },
    expert: {
      key: "expertService",
      label: "Service Offering",
      options: [
        { v: "Live Expert Assisted", share: 0.72, rateMult: 0.92 },
        { v: "Live Expert Full-Service Bookkeeping", share: 0.28, rateMult: 1.2 },
      ],
    },
    billpay: {
      key: "billPayPlan",
      label: "Plan",
      options: [
        { v: "Basic", share: 0.55, rateMult: 0.88 },
        { v: "Premium", share: 0.32, rateMult: 1.05 },
        { v: "Elite", share: 0.13, rateMult: 1.25 },
      ],
    },
  };

  // Shared "narrow to selected values, or use every value if unfiltered"
  // combiner -- used both for FILTER_DIMS (via combineDim below) and for a
  // product's own PRODUCT_FILTER_DIMS entry (via productSeriesForFilters).
  function combineOptions(opts, selected) {
    const chosen = !selected || selected.length === 0 || selected.length === opts.length
      ? opts
      : opts.filter((o) => selected.includes(o.v));
    const totalShare = chosen.reduce((s, o) => s + o.share, 0) || 0.0001;
    const rateMult = chosen.reduce((s, o) => s + o.rateMult * o.share, 0) / totalShare;
    return { share: totalShare, rateMult, isAll: chosen.length === opts.length };
  }

  function combineDim(dimKey, selected) {
    return combineOptions(FILTER_DIMS[dimKey].options, selected);
  }

  function combineAllDims(filters) {
    const dims = ["companySize", "tenure", "industry", "country"];
    let shareProduct = 1;
    const rateMults = [];
    dims.forEach((d) => {
      const r = combineDim(d, filters[d]);
      shareProduct *= r.share;
      rateMults.push(r.rateMult);
    });
    const rateMult = Math.pow(rateMults.reduce((a, b) => a * b, 1), 1 / rateMults.length);
    return { share: shareProduct, rateMult };
  }

  // Looks up a dimension's { label, options } definition regardless of
  // whether it's a universal FILTER_DIMS key or one product tab's own
  // PRODUCT_FILTER_DIMS entry -- lets every "Split by"-aware render/compute
  // site resolve a dimKey without needing to know which bucket it lives in.
  function dimDef(tabId, dimKey) {
    if (FILTER_DIMS[dimKey]) return FILTER_DIMS[dimKey];
    const productDim = PRODUCT_FILTER_DIMS[tabId];
    return productDim && productDim.key === dimKey ? productDim : undefined;
  }

  const BUNDLE_DEPTH = {
    All: { share: 1, rateMult: 1 },
    "1 product": { share: 0.42, rateMult: 0.85 },
    "2 products": { share: 0.35, rateMult: 1.08 },
    "3+ products": { share: 0.23, rateMult: 1.35 },
  };

  function bundleProductsEffect(count) {
    if (!count) return { share: 1, rateMult: 1 };
    return { share: Math.pow(0.42, count), rateMult: Math.pow(1.14, count) };
  }

  /* ---------------- format helpers ---------------- */

  function compactNum(v) {
    if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
    if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
    return Math.round(v).toString();
  }
  function pct(v) {
    return v.toFixed(1) + "%";
  }
  function signedPct(v) {
    return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
  }
  function pts(v) {
    return (v >= 0 ? "+" : "") + v.toFixed(1) + " pts";
  }
  // Executive Summary numeric highlighting (2026-07-20, per direct
  // feedback): wraps an already-formatted number/delta string (from pts,
  // pct, or signedPct above) in a color span -- green for favorable, red
  // for unfavorable. Every KPI this dashboard tracks (Activation Rate, Core
  // Job Completion, Habit Formation, Deepening Rate) is a "higher is
  // better" rate, so callers pass `favorable = value >= 0` for movement/gap
  // deltas; a few call sites (e.g. an abandonment rate or "the lowest
  // modeled rate in this segment") are always naming the weak point being
  // called out as a problem, so those pass `favorable = false` outright
  // rather than testing a sign. Deliberately a flat two-color scheme (no
  // amber/"watch" tier) -- narrower than kpiStatus's three-tier gap
  // coloring used on the KPI cards themselves, matching what was actually
  // asked for here.
  function numSpan(text, favorable) {
    return `<span class="${favorable ? "num-good" : "num-bad"}">${text}</span>`;
  }
  // ITPM/ITPY index: current as a percentage of the prior period's value
  // (100 = flat, >100 = improved, <100 = declined) -- replaces the earlier
  // pts-delta display per 2026-07-20 direction.
  function indexOf(current, prior) {
    if (!prior) return null;
    return Math.round((current / prior) * 100);
  }

  /* ============================================================
     Application state
     ============================================================ */

  const TABS = [
    { id: "portfolio", label: "Portfolio" },
    { id: "accounting", label: "QBO Accounting" },
    { id: "expert", label: "Intuit Expert" },
    { id: "payments", label: "Payments" },
    { id: "billpay", label: "Bill Pay" },
  ];

  function defaultFilters(tabId) {
    const f = {
      timeRange: "YTD",
      country: [],
      companySize: [],
      tenure: [],
      industry: [],
      trendDisplay: "Combined",
      viewGrain: "Weekly",
      // Default Custom-range bounds span the full available window so the
      // picker starts out showing everything, not an empty slice, the first
      // time someone switches Time Range to "Custom range".
      customFromYear: AVAILABLE_YEARS[0],
      customFromMonth: String(AVAILABLE_MONTH_NUMS[0]),
      customToYear: AVAILABLE_YEARS[AVAILABLE_YEARS.length - 1],
      customToMonth: String(AVAILABLE_MONTH_NUMS[AVAILABLE_MONTH_NUMS.length - 1]),
      // Which dimension the charts split into separate lines/stacks by when
      // Trend Display = Separated, toggled via the "Split by" checkbox next
      // to each eligible filter -- see the [data-splitby] handler in
      // wireEvents. Portfolio adds "Product" as a 5th, default choice (one
      // line per included product); product tabs only choose among the four
      // segmentation filters, defaulting to null (no split, single line).
      splitBy: null,
    };
    if (tabId === "portfolio") {
      f.bundleDepth = "All";
      f.productView = PRODUCTS.map((p) => p.id);
      f.splitBy = "product";
    } else {
      f.bundleProducts = [];
      // This tab's own Plan/Service Offering filter (2026-07-20), if it has
      // one -- defaults to [] (empty selection means "all values"), same
      // convention as Company Size/Tenure/Industry/Country.
      const productDim = PRODUCT_FILTER_DIMS[tabId];
      if (productDim) f[productDim.key] = [];
    }
    return f;
  }

  const state = {
    tab: "portfolio",
    filtersByTab: Object.fromEntries(TABS.map((t) => [t.id, defaultFilters(t.id)])),
    chatByTab: {},
    // 2026-07-19: an open scope-clarification question ("portfolio or which
    // product?"), waiting on the user's next chat message to resolve it --
    // see askAndRender(). Holds { originalQuestion, tabId, attempts } while
    // open, null otherwise. Global (not per-tab) since the clarifying
    // exchange itself isn't yet scoped to any one tab.
    pendingClarification: null,
    feedbackLog: [],
    moreFiltersOpenByTab: Object.fromEntries(TABS.map((t) => [t.id, false])),
    chatOpenByTab: Object.fromEntries(TABS.map((t) => [t.id, false])),
    dataGuideOpen: false,
    // Which multi-select dropdown (by id, e.g. "productView") is currently
    // open. Checking a box inside one triggers a full renderApp(), which
    // regenerates the panel's `hidden` attribute from scratch -- without
    // this, that attribute always came back to its default "hidden", so the
    // panel visually snapped shut after every single checkbox click and a
    // user could never select more than one option without reopening it.
    msPanelOpen: {},
  };

  function kpiStatus(card) {
    // Returns 'good' | 'watch' | 'risk' driven by gap-vs-target (targeted KPIs)
    // or period-over-period movement (non-targeted KPIs like raw counts).
    //
    // 2026-07-20 revision: being below target is always a real miss, not a
    // "watch" -- so any negative gap is risk, full stop, regardless of size.
    // But being barely above target isn't the same as comfortably clearing
    // it, so a small positive gap (<1 pt -- a judgment call, not a
    // disclosed threshold) still reads as watch/orange; only a gap of 1 pt
    // or more reads as good/green. This single function also drives
    // tabOverallStatus() (the Executive Summary status chip), so that chip now
    // reflects the same "close to target still isn't safely on track" read.
    if (card.target != null) {
      if (card.gap < 0) return "risk";
      if (card.gap < 1) return "watch";
      return "good";
    }
    // Deadband on the non-targeted count KPI: real weekly active-customer
    // counts wobble a little even during real growth, so a -0.4% single-week
    // dip shouldn't paint the whole card red — only a real decline should.
    if (card.movement >= -1) return "good";
    if (card.movement >= -3) return "watch";
    return "risk";
  }

  function tabOverallStatus(kpiCards) {
    const targeted = kpiCards.filter((c) => c.target != null);
    if (!targeted.length) return "good";
    const worst = targeted.reduce((a, b) => (b.gap < a.gap ? b : a));
    return kpiStatus(worst);
  }

  const STATUS_LABEL = { good: "On track", watch: "Watch", risk: "Needs attention" };

  /* ============================================================
     Metric computation
     ============================================================ */

  function windowedWeeks(filters) {
    const timeRange = filters.timeRange;
    if (timeRange === "Past quarter") return WEEKS.slice(-8);
    if (timeRange === "Custom range") {
      const pad2 = (v) => String(v).padStart(2, "0");
      let lo = `${filters.customFromYear}-${pad2(filters.customFromMonth)}`;
      let hi = `${filters.customToYear}-${pad2(filters.customToMonth)}`;
      if (lo > hi) {
        const t = lo;
        lo = hi;
        hi = t;
      }
      const sliced = WEEKS.filter((w) => {
        const k = fmtMonthKey(w);
        return k >= lo && k <= hi;
      });
      return sliced.length ? sliced : WEEKS.slice(-1); // never render an empty chart
    }
    return WEEKS; // YTD / Past year / Past 3 years -> synthetic demo shows the same generated ~3-month window (documented simplification)
  }

  // Groups a chronological weeks[] array into { key: "YYYY-MM", idx: [...] }
  // buckets, preserving chronological (ascending) order. Shared by the
  // Monthly chart grain and by lastFullMonthIndices() below.
  function monthBuckets(weeks) {
    const buckets = [];
    weeks.forEach((w, i) => {
      const mk = fmtMonthKey(w);
      let b = buckets.find((x) => x.key === mk);
      if (!b) {
        b = { key: mk, idx: [] };
        buckets.push(b);
      }
      b.idx.push(i);
    });
    return buckets;
  }

  function toGrain(weeks, values, grain) {
    if (grain === "Weekly") {
      return { labels: weeks.map(fmtWeekLabel), values: values.slice() };
    }
    // Monthly: snapshot = last week's value within each month bucket
    const buckets = monthBuckets(weeks);
    return {
      labels: buckets.map((b) => fmtMonthLabel(b.key)),
      values: buckets.map((b) => values[b.idx[b.idx.length - 1]]),
    };
  }

  // The four KPI cards always anchor to the last FULLY COMPLETED calendar
  // month, independent of the Time Range / Custom-range filter (which only
  // affects the charts and driver views below the cards) -- so this buckets
  // the full, unwindowed WEEKS array (not whatever windowedWeeks() returned)
  // and drops the current, still-in-progress month if the data happens to
  // include a few of its weeks already.
  function lastFullMonthIndices() {
    const buckets = monthBuckets(WEEKS);
    const todayKey = fmtMonthKey(new Date().toISOString().slice(0, 10));
    const complete = buckets.length && buckets[buckets.length - 1].key === todayKey ? buckets.slice(0, -1) : buckets;
    const cur = complete.length ? complete[complete.length - 1] : buckets[buckets.length - 1];
    const prior = complete.length >= 2 ? complete[complete.length - 2] : null;
    return {
      curIdx: cur.idx[cur.idx.length - 1],
      curKey: cur.key,
      priorIdx: prior ? prior.idx[prior.idx.length - 1] : null,
      priorKey: prior ? prior.key : null,
    };
  }

  function productSeriesForFilters(productId, filters) {
    const dims = combineAllDims(filters);
    const bundleSel = filters.bundleProducts || [];
    const bundle = bundleProductsEffect(bundleSel.length);
    // Product-only dimension (Plan/Service Offering, 2026-07-20): only ever
    // has an effect when `productId` is the one tab that dimension belongs
    // to AND that tab's own filters object actually carries a selection for
    // it -- Portfolio's filters (and every other product's) never set this
    // key, so `combineOptions` sees `undefined` and returns the neutral
    // "every option" blend, exactly as if this dimension didn't exist for
    // any other computation.
    const productDim = PRODUCT_FILTER_DIMS[productId];
    const productDimEff = productDim ? combineOptions(productDim.options, filters[productDim.key]) : { share: 1, rateMult: 1 };
    const totalShare = dims.share * bundle.share * productDimEff.share;
    const totalRateMult = dims.rateMult * bundle.rateMult * productDimEff.rateMult;
    const out = {};
    out.active_engaged = DATA.productData[productId].active_engaged.map((v) => v * totalShare);
    KPIS.forEach((k) => {
      const base = DATA.productData[productId][k.id];
      out[k.id] = k.unit === "count" ? base.map((v) => v * totalShare) : base.map((v) => clamp(v * totalRateMult, 1, 99));
    });
    return { series: out, totalShare, totalRateMult };
  }

  // Full (unwindowed, 12-week) absolute-count series per product for the
  // "Absolute Volumes" charts -- see the VOLUME_METRICS/assumption comment
  // above for how each of the four is derived.
  function volumeSeriesForFilters(productId, filters) {
    const ps = productSeriesForFilters(productId, filters);
    const ae = ps.series.active_engaged;
    const activation = ps.series.activation_rate;
    const completion = ps.series.core_job_completion;
    const deepening = ps.series.deepening_rate;
    return {
      newlyActivated: ae.map((v, i) => v * NEW_COHORT_RATE[productId] * (activation[i] / 100)),
      completedCoreTask: ae.map((v, i) => v * (completion[i] / 100)),
      threeMonthActive: ae.map((v) => v * THREE_MONTH_ACTIVE_SHARE[productId]),
      deepenedCustomers: ae.map((v, i) => v * (deepening[i] / 100)),
    };
  }

  // Portfolio-blended rate series (full 12-week window, unwindowed -- same
  // convention as base.series/card.series elsewhere) for one KPI, under a
  // given filter set, weighted by active-engaged count across `included`
  // products -- the same weighting method computePortfolioTab's own KPI
  // cards use, just reusable for an arbitrary filter override rather than
  // the outer `filters` closure. Used for the segment-split trend lines
  // (Company Size / Tenure / Industry / Country), where each line needs the
  // portfolio blend recomputed with that one dimension pinned to a single
  // value instead of the tab's actual current selection.
  function portfolioBlendedSeriesForFilters(included, filters, bd, kpiId) {
    const perProd = {};
    included.forEach((pid) => {
      perProd[pid] = productSeriesForFilters(pid, filters);
    });
    return WEEKS.map((w, i) => {
      let num = 0,
        den = 0;
      included.forEach((pid) => {
        const wgt = perProd[pid].series.active_engaged[i];
        const rate = clamp(perProd[pid].series[kpiId][i] * bd.rateMult, 1, 99);
        num += wgt * rate;
        den += wgt;
      });
      return den ? num / den : 0;
    });
  }

  function computeProductTab(productId, filters) {
    const weeks = windowedWeeks(filters);
    const startIdx = WEEKS.length - weeks.length;
    const base = productSeriesForFilters(productId, filters);
    const target = DATA.targets[productId];

    // KPI cards always anchor to the last fully completed calendar month,
    // independent of the Time Range filter (Time Range / View Grain only
    // affect the chart and driver views below the cards).
    const lfm = lastFullMonthIndices();

    const kpiCards = KPIS.map((k) => {
      const seriesFull = base.series[k.id];
      const series = seriesFull.slice(startIdx);
      const current = seriesFull[lfm.curIdx];
      const priorMonth = lfm.priorIdx != null ? seriesFull[lfm.priorIdx] : current;
      const movement = k.unit === "count" ? ((current - priorMonth) / priorMonth) * 100 : current - priorMonth;
      const itpyDelta = YOY_ASSUMPTION[productId] ? YOY_ASSUMPTION[productId][k.id] : null;
      const priorYear = itpyDelta != null ? current - itpyDelta : null;
      return {
        kpi: k,
        current,
        movement,
        itpy: itpyDelta,
        priorMonthVal: priorMonth,
        priorYearVal: priorYear,
        itpmIndex: indexOf(current, priorMonth),
        itpyIndex: priorYear != null ? indexOf(current, priorYear) : null,
        monthKey: lfm.curKey,
        target: target[k.id] != null ? target[k.id] * base.totalRateMult : null,
        gap: target[k.id] != null ? current - target[k.id] * base.totalRateMult : null,
        series,
      };
    });

    // Split by (product tabs): unlike Portfolio there's no "Product"
    // fallback dimension here -- filters.splitBy is either null (no split,
    // single line -- the long-standing default) or one of the four
    // segmentation filters. Same "narrow the filter's own selection, or
    // show every value if it's unfiltered" convention as Portfolio, and the
    // same explicit-checkbox trigger rather than the old implicit "2+ but
    // not all Tenure values selected" auto-detection this replaces.
    let lineSeriesList = null;
    if (filters.trendDisplay === "Separated" && filters.splitBy) {
      const dim = dimDef(productId, filters.splitBy);
      const allValues = dim.options.map((o) => o.v);
      const sel = filters[filters.splitBy] || [];
      const values = sel.length === 0 || sel.length === allValues.length ? allValues : sel;
      lineSeriesList = values.map((v) => ({ label: v, kind: filters.splitBy, key: v }));
    }

    const falloffWeekly = computeFalloffWeekly(productId, base.totalRateMult);
    const falloff = computeFalloff(productId, base.totalShare, base.totalRateMult).map((s, i) => {
      // vs prior week / vs prior month, read off the full (unwindowed)
      // weekly series at fixed anchors -- same convention as the KPI cards
      // and Portfolio's own driverColumns, so a step's movement here always
      // matches what the same step would show if pooled into Portfolio.
      const weeklyFull = falloffWeekly[i].series;
      const vsWeek = weeklyFull[weeklyFull.length - 1] - weeklyFull[weeklyFull.length - 2];
      const vsMonth = lfm.priorIdx != null ? weeklyFull[lfm.curIdx] - weeklyFull[lfm.priorIdx] : null;
      return {
        ...s,
        trend: weeklyFull.slice(startIdx),
        vsWeek,
        vsMonth,
        significance: sigTier(s.abandonRate),
      };
    });
    // Absolute-count companion for the paired chart next to the falloff
    // trend -- see falloffVolumeWeekly() for how it's derived.
    const falloffVolumeFull = falloffVolumeWeekly(productId, base.totalShare, base.totalRateMult);

    return { weeks, startIdx, base, kpiCards, lineSeriesList, falloff, falloffVolumeFull, target };
  }

  function computeFalloff(productId, share, rateMult) {
    return FALLOFF_BASE[productId].map((s) => {
      const baseAbandonRate = 1 - s.completed / s.entered;
      const adjAbandonRate = clamp(baseAbandonRate / clamp(rateMult, 0.4, 1.8), 0.02, 0.85);
      const entered = s.entered * share;
      const completed = entered * (1 - adjAbandonRate);
      return { step: s.step, entered, completed, abandoned: entered - completed, abandonRate: adjAbandonRate };
    });
  }

  function computePortfolioTab(filters) {
    const weeks = windowedWeeks(filters);
    const startIdx = WEEKS.length - weeks.length;
    const included = filters.productView && filters.productView.length ? filters.productView : PRODUCTS.map((p) => p.id);

    const perProduct = {};
    included.forEach((pid) => {
      perProduct[pid] = productSeriesForFilters(pid, filters);
    });

    const dims = combineAllDims(filters);
    const bd = BUNDLE_DEPTH[filters.bundleDepth || "All"];

    // KPI cards always anchor to the last fully completed calendar month,
    // independent of the Time Range filter -- see computeProductTab for the
    // same pattern. rateSeries/targetBlend below are unchanged and still
    // span the Time-Range-filtered `weeks` (used only by the chart).
    const lfm = lastFullMonthIndices();

    const kpiCards = KPIS.map((k) => {
      if (k.unit === "count") {
        const summed = weeks.map((w, i) => included.reduce((s, pid) => s + perProduct[pid].series[k.id][startIdx + i] * bd.share, 0));
        const current = summed[summed.length - 1];
        const prior = summed[summed.length - 2] != null ? summed[summed.length - 2] : current;
        return { kpi: k, current, movement: ((current - prior) / prior) * 100, target: null, gap: null, series: summed };
      }
      // blended rate weighted by active_engaged count (chart series)
      const rateSeries = weeks.map((w, i) => {
        let num = 0,
          den = 0;
        included.forEach((pid) => {
          const wgt = perProduct[pid].series.active_engaged[startIdx + i];
          const rate = clamp(perProduct[pid].series[k.id][startIdx + i] * bd.rateMult, 1, 99);
          num += wgt * rate;
          den += wgt;
        });
        return den ? num / den : 0;
      });

      // Card value/target/ITPM/ITPY: same weighted-blend method, evaluated
      // at the last-full-month index instead of across the windowed weeks.
      const blendRateAt = (idx) => {
        let num = 0,
          den = 0;
        included.forEach((pid) => {
          const wgt = perProduct[pid].series.active_engaged[idx];
          const rate = clamp(perProduct[pid].series[k.id][idx] * bd.rateMult, 1, 99);
          num += wgt * rate;
          den += wgt;
        });
        return den ? num / den : 0;
      };
      const blendTargetAt = (idx) => {
        let num = 0,
          den = 0;
        included.forEach((pid) => {
          const t = DATA.targets[pid][k.id];
          if (t == null) return;
          const wgt = perProduct[pid].series.active_engaged[idx];
          num += wgt * t;
          den += wgt;
        });
        return den ? num / den : 0;
      };
      const current = blendRateAt(lfm.curIdx);
      const priorMonth = lfm.priorIdx != null ? blendRateAt(lfm.priorIdx) : current;
      const target = blendTargetAt(lfm.curIdx);
      let yoyNum = 0,
        yoyDen = 0;
      included.forEach((pid) => {
        const delta = YOY_ASSUMPTION[pid] ? YOY_ASSUMPTION[pid][k.id] : null;
        if (delta == null) return;
        const wgt = perProduct[pid].series.active_engaged[lfm.curIdx];
        yoyNum += wgt * delta;
        yoyDen += wgt;
      });
      const itpy = yoyDen ? yoyNum / yoyDen : null;
      const priorYear = itpy != null ? current - itpy : null;

      return {
        kpi: k,
        current,
        movement: current - priorMonth,
        itpy,
        priorMonthVal: priorMonth,
        priorYearVal: priorYear,
        itpmIndex: indexOf(current, priorMonth),
        itpyIndex: priorYear != null ? indexOf(current, priorYear) : null,
        monthKey: lfm.curKey,
        target,
        gap: current - target,
        series: rateSeries,
      };
    });

    // Which dimension the Separated charts split by: "product" (default --
    // one line per included product) or one of the four segmentation
    // filters, chosen via the mutually-exclusive "Split by" checkboxes.
    // Segment values come from that filter's OWN current selection (same
    // "All means every value" convention combineDim already uses elsewhere)
    // so narrowing e.g. Tenure to just two values compares only those two.
    const splitBy = filters.splitBy || "product";
    let lineSeriesList = null;
    if (filters.trendDisplay === "Separated") {
      if (splitBy === "product") {
        lineSeriesList = included.map((pid) => ({ label: PRODUCT_BY_ID[pid].short, kind: "product", key: pid }));
      } else {
        const dim = FILTER_DIMS[splitBy];
        const allValues = dim.options.map((o) => o.v);
        const sel = filters[splitBy] || [];
        const values = sel.length === 0 || sel.length === allValues.length ? allValues : sel;
        lineSeriesList = values.map((v) => ({ label: v, kind: splitBy, key: v }));
      }
    }

    // portfolio driver view: worst friction step per product, ranked by abandon rate
    const lfmDrv = lastFullMonthIndices();
    const drivers = included
      .map((pid) => {
        const dims2 = combineAllDims(filters);
        const steps = computeFalloff(pid, dims2.share * bd.share, dims2.rateMult * bd.rateMult);
        const worst = steps.reduce((a, b) => (b.abandonRate > a.abandonRate ? b : a));
        const worstIdx = steps.indexOf(worst);
        const weeklyFull = computeFalloffWeekly(pid, dims2.rateMult * bd.rateMult)[worstIdx].series;
        // vs prior week / vs prior month read off the FULL (unwindowed)
        // weekly series, at fixed anchors -- same convention as the KPI
        // cards, so these two numbers don't shift just because someone
        // picked a different Time Range for the chart above them.
        const vsWeek = weeklyFull[weeklyFull.length - 1] - weeklyFull[weeklyFull.length - 2];
        const vsMonth = lfmDrv.priorIdx != null ? weeklyFull[lfmDrv.curIdx] - weeklyFull[lfmDrv.priorIdx] : null;
        return {
          productId: pid,
          product: PRODUCT_BY_ID[pid].short,
          step: worst.step,
          abandonRate: worst.abandonRate,
          abandoned: worst.abandoned,
          entered: worst.entered,
          vsWeek,
          vsMonth,
          significance: sigTier(worst.abandonRate),
          trend: weeklyFull.slice(startIdx),
        };
      })
      .sort((a, b) => b.abandonRate - a.abandonRate);

    // Combined (default) falloff line: each product's worst-driver trend
    // blended into one line, weighted by that step's own funnel volume
    // (`entered`) -- the same "weight by volume" principle the rate cards
    // use with active_engaged, just applied per friction step since there's
    // no single count that spans different steps across products.
    const combinedTrend = weeks.map((w, i) => {
      let num = 0,
        den = 0;
      drivers.forEach((d) => {
        num += d.trend[i] * d.entered;
        den += d.entered;
      });
      return den ? num / den : 0;
    });

    // Per-product falloff breakdown for the Separated view: unlike
    // `drivers` above (which only ever carries each product's single worst
    // step, for the cross-product ranking and the Executive Summary's citation),
    // this carries every funnel step for every included product, ranked
    // within that product -- "what are QBO's top falloff reasons," not
    // just "QBO's worst one." Kept in fixed product order (not sorted by
    // severity) so the four columns always land in the same place.
    const driverColumns = PRODUCTS.filter((p) => included.includes(p.id)).map((p) => {
      const pid = p.id;
      const dims2 = combineAllDims(filters);
      const steps = computeFalloff(pid, dims2.share * bd.share, dims2.rateMult * bd.rateMult);
      const weeklyAll = computeFalloffWeekly(pid, dims2.rateMult * bd.rateMult);
      const rows = steps
        .map((s, i) => {
          const weeklyFull = weeklyAll[i].series;
          const vsWeek = weeklyFull[weeklyFull.length - 1] - weeklyFull[weeklyFull.length - 2];
          const vsMonth = lfmDrv.priorIdx != null ? weeklyFull[lfmDrv.curIdx] - weeklyFull[lfmDrv.priorIdx] : null;
          return { step: s.step, abandonRate: s.abandonRate, abandoned: s.abandoned, vsWeek, vsMonth, significance: sigTier(s.abandonRate) };
        })
        .sort((a, b) => b.abandonRate - a.abandonRate);
      return { productId: pid, product: p.short, rows };
    });

    // Same absolute-count companion idea as the "Customer counts" volume
    // charts, paired with the falloff rate trend above -- per-product
    // series for the Separated stacked chart, and a combined portfolio
    // total for the default (Combined) view.
    const falloffVolumeByProduct = {};
    PRODUCTS.filter((p) => included.includes(p.id)).forEach((p) => {
      const dims2 = combineAllDims(filters);
      falloffVolumeByProduct[p.id] = falloffVolumeWeekly(p.id, dims2.share * bd.share, dims2.rateMult * bd.rateMult);
    });
    const falloffVolumeCombined = WEEKS.map((w, i) => included.reduce((s, pid) => s + falloffVolumeByProduct[pid][i], 0));

    return {
      weeks,
      startIdx,
      perProduct,
      included,
      kpiCards,
      lineSeriesList,
      drivers,
      combinedTrend,
      driverColumns,
      falloffVolumeByProduct,
      falloffVolumeCombined,
      bd,
    };
  }

  /* ============================================================
     SVG chart rendering
     ============================================================ */

  // Single-axis bar chart — used for the one non-targeted, count-based KPI
  // (Active Engaged Customers). No secondary axis, nothing to misread.
  // `stacks` (optional): [{ label, color, values: number[] }] -- when
  // present, each bar position is drawn as a stack of colored segments
  // (one per product) instead of a single flat bar, for the Separated view
  // of the Customer counts charts. `bars` (flat mode) is still supported
  // for every other caller. Either mode carries data-tip-label/value
  // attributes instead of a native <title>, read by the shared hover
  // tooltip wired once in initChartTooltip().
  // deltaUnit ("wk" or "mo") labels the point-over-point movement shown in
  // the hover tooltip, matching whatever View Grain the chart is currently
  // rendered at -- a weekly chart's tooltip says "wk", a monthly-bucketed
  // one says "mo", so the movement reads against the same period the chart
  // itself is grouped by.
  function deltaUnitFor(grain) {
    return grain === "Monthly" ? "mo" : "wk";
  }

  function buildBarSVG({ labels, bars, stacks, axisLabel, deltaUnit }) {
    const W = 540,
      H = 210,
      padL = 50,
      padR = 20,
      padT = 18,
      padB = 30;
    const plotW = W - padL - padR,
      plotH = H - padT - padB;
    const n = labels.length;
    const totals = stacks ? labels.map((_, i) => stacks.reduce((s, st) => s + st.values[i], 0)) : bars;
    const barMax = Math.max.apply(null, totals.concat([1])) * 1.2;
    const xStep = plotW / n;
    const barW = Math.min(34, xStep * 0.46);
    const xC = (i) => padL + xStep * i + xStep / 2;
    const yBar = (v) => padT + plotH - (v / barMax) * plotH;
    const du = deltaUnit || "wk";
    const countDelta = (v, prev) => (prev == null ? "" : ` data-tip-delta="${v - prev >= 0 ? "▲" : "▼"} ${du} ${v - prev >= 0 ? "+" : "-"}${compactNum(Math.abs(v - prev))}"`);

    let s = `<svg viewBox="0 0 ${W} ${H}" class="single-chart" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">`;
    for (let g = 0; g <= 4; g++) {
      const y = padT + (plotH * g) / 4;
      s += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" class="grid-line"/>`;
      const barVal = barMax * (1 - g / 4);
      s += `<text x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" class="axis-tick">${compactNum(barVal)}</text>`;
    }
    s += `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" class="axis-line"/>`;
    s += `<line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" class="axis-line"/>`;

    if (stacks) {
      labels.forEach((lb, i) => {
        let cum = 0;
        stacks.forEach((st) => {
          const v = st.values[i];
          const x = xC(i) - barW / 2,
            yTop = yBar(cum + v),
            yBottom = yBar(cum);
          const prev = i > 0 ? st.values[i - 1] : null;
          s += `<rect x="${x.toFixed(1)}" y="${yTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${(yBottom - yTop).toFixed(1)}" class="bar-rect" style="fill:${st.color}" data-tip-label="${lb} · ${st.label}" data-tip-value="${compactNum(v)} customers"${countDelta(v, prev)}/>`;
          cum += v;
        });
      });
    } else {
      bars.forEach((v, i) => {
        const x = xC(i) - barW / 2,
          y = yBar(v),
          h = padT + plotH - y;
        const prev = i > 0 ? bars[i - 1] : null;
        s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" class="bar-rect" data-tip-label="${labels[i]}" data-tip-value="${compactNum(v)} customers"${countDelta(v, prev)}/>`;
      });
    }
    // One total label per bar position (not just first/last) -- still just
    // one label per column even in stacked mode, so this doesn't add the
    // per-segment clutter a label-per-stack-slice would.
    const dense = n >= 10 ? " dense" : "";
    totals.forEach((v, i) => {
      s += `<text x="${xC(i)}" y="${(yBar(v) - 6).toFixed(1)}" text-anchor="middle" class="bar-datalabel${dense}">${compactNum(v)}</text>`;
    });

    // 2026-07-20: the week-grain "M/D/YY" label format (e.g. "7/19/26") is
    // noticeably wider than the old "MMM D" format it replaced -- at 12
    // weekly ticks (the `dense` threshold above) every label no longer fits
    // in its ~40px slot and adjacent labels started overlapping into
    // unreadable text. Thin to every other tick in dense mode, anchored to
    // always keep the most recent week (the "today" point) labeled.
    labels.forEach((lb, i) => {
      if (n >= 10 && (n - 1 - i) % 2 === 1) return;
      s += `<text x="${xC(i).toFixed(1)}" y="${H - 10}" text-anchor="middle" class="axis-tick x">${lb}</text>`;
    });
    s += `<text x="${padL}" y="12" class="axis-title">${axisLabel}</text>`;
    s += `</svg>`;
    return s;
  }

  // Single-axis rate-vs-target chart. Instead of a second bar/line axis, the
  // "on-target zone" (at/above target) is shown as a light shaded band so the
  // line's position relative to it reads instantly, with no dual-scale risk.
  function buildRateTargetSVG({ labels, lineSeriesList, target, axisLabel, deltaUnit }) {
    const W = 540,
      H = 210,
      padL = 42,
      padR = 20,
      padT = 18,
      padB = 30;
    const plotW = W - padL - padR,
      plotH = H - padT - padB;
    const n = labels.length;
    const allVals = lineSeriesList.flatMap((s) => s.data).concat(target != null ? [target] : []);
    const maxV = Math.max(10, Math.ceil((Math.max.apply(null, allVals.concat([1])) * 1.15) / 10) * 10);
    const xStep = plotW / n;
    const xC = (i) => padL + xStep * i + xStep / 2;
    const yV = (v) => padT + plotH - (v / maxV) * plotH;
    const du = deltaUnit || "wk";
    // Data-point labels at every point would overlap heavily once there's
    // more than one line on the chart (Separated views, multi-step funnel
    // trends), so full labeling is reserved for single-line charts; a
    // multi-line chart keeps just the end-of-line label it already had.
    const dense = n >= 10 ? " dense" : "";

    let s = `<svg viewBox="0 0 ${W} ${H}" class="single-chart" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">`;
    for (let g = 0; g <= 4; g++) {
      const y = padT + (plotH * g) / 4;
      s += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" class="grid-line"/>`;
      const val = maxV * (1 - g / 4);
      s += `<text x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" class="axis-tick">${Math.round(val)}%</text>`;
    }

    if (target != null) {
      const yT = yV(target);
      s += `<rect x="${padL}" y="${padT.toFixed(1)}" width="${plotW.toFixed(1)}" height="${(yT - padT).toFixed(1)}" class="target-band"/>`;
      s += `<line x1="${padL}" y1="${yT.toFixed(1)}" x2="${W - padR}" y2="${yT.toFixed(1)}" class="target-line"/>`;
      // The target label sits at the top-right by default, anchored to the
      // chart's right edge. The earlier fix only compared the label's own
      // baseline against the *last point's label baseline* -- but a data
      // point's label is drawn 8px above its marker, so pushing the target
      // label just clear of that label position could (and did) drop it
      // right on top of the marker/line sitting a few pixels below, which
      // is what "target label overlapping the blue line" turned out to be.
      // This version tracks the real occupied vertical band of every point
      // (marker + its own label, not just the label's baseline) that falls
      // inside the target label's horizontal footprint -- not only the very
      // last point, since a dense weekly view (up to 27 points) packs
      // several points into that same horizontal span -- and walks the
      // target label past all of them instead of just the nearest one.
      const targetText = `Target ${target.toFixed(0)}%`;
      const labelReach = targetText.length * 6.3 + 8; // heuristic px width at 10.5px semibold + right-edge padding
      const singleLine = lineSeriesList.length === 1;
      const keepouts = [];
      lineSeriesList.forEach((series) => {
        series.data.forEach((v, i) => {
          const px = xC(i);
          if (px < W - padR - labelReach) return;
          const py = yV(v);
          if (singleLine) keepouts.push([py - 17, py + 4]); // marker + its own label, drawn above it
          else if (i === n - 1) keepouts.push([py - 6, py + 5]); // marker + its own label, drawn beside it
          else keepouts.push([py - 4, py + 4]); // marker only, no label
        });
      });
      const labelBox = (y) => [y - 9, y + 2];
      const overlaps = (y) => {
        const [top, bottom] = labelBox(y);
        return keepouts.some(([kTop, kBottom]) => kTop < bottom + 2 && top < kBottom + 2);
      };
      let targetLabelY = yT - 5;
      let guard = 0;
      while (overlaps(targetLabelY) && guard < 8) {
        const roomAbove = targetLabelY - padT;
        const roomBelow = padT + plotH - targetLabelY;
        const dir = roomAbove > roomBelow ? -1 : 1;
        const [top, bottom] = labelBox(targetLabelY);
        let next = targetLabelY;
        keepouts.forEach(([kTop, kBottom]) => {
          if (!(kTop < bottom + 2 && top < kBottom + 2)) return;
          next = dir === 1 ? Math.max(next, kBottom + 11) : Math.min(next, kTop - 11);
        });
        if (next === targetLabelY) break;
        targetLabelY = next;
        guard++;
      }
      targetLabelY = Math.max(padT + 8, Math.min(padT + plotH - 2, targetLabelY));
      s += `<text x="${W - padR}" y="${targetLabelY.toFixed(1)}" text-anchor="end" class="target-label">${targetText}</text>`;
    }

    s += `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" class="axis-line"/>`;
    s += `<line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" class="axis-line"/>`;

    const palette = [COLORS.accounting, COLORS.expert, COLORS.payments, COLORS.billpay, COLORS.watch];
    lineSeriesList.forEach((series, si) => {
      const color = series.color || palette[si % palette.length];
      const pointsStr = series.data.map((v, i) => `${xC(i).toFixed(1)},${yV(v).toFixed(1)}`).join(" ");
      s += `<polyline points="${pointsStr}" class="line-path" style="stroke:${color}"/>`;
      series.data.forEach((v, i) => {
        const prev = i > 0 ? series.data[i - 1] : null;
        const deltaAttr = prev != null ? ` data-tip-delta="${v - prev >= 0 ? "▲" : "▼"} ${du} ${pts(v - prev)}"` : "";
        s += `<circle cx="${xC(i).toFixed(1)}" cy="${yV(v).toFixed(1)}" r="4" class="line-point" style="fill:${color}" data-tip-label="${labels[i]} · ${series.label}" data-tip-value="${v.toFixed(1)}%"${deltaAttr}/>`;
      });
      if (lineSeriesList.length === 1) {
        series.data.forEach((v, i) => {
          s += `<text x="${xC(i).toFixed(1)}" y="${(yV(v) - 8).toFixed(1)}" text-anchor="middle" class="line-datalabel${dense}" style="fill:${color}">${v.toFixed(1)}%</text>`;
        });
      } else {
        const li = n - 1;
        s += `<text x="${(xC(li) + 6).toFixed(1)}" y="${(yV(series.data[li]) + 3).toFixed(1)}" class="line-datalabel" style="fill:${color}">${series.data[li].toFixed(1)}%</text>`;
      }
    });

    // 2026-07-20: the week-grain "M/D/YY" label format (e.g. "7/19/26") is
    // noticeably wider than the old "MMM D" format it replaced -- at 12
    // weekly ticks (the `dense` threshold above) every label no longer fits
    // in its ~40px slot and adjacent labels started overlapping into
    // unreadable text. Thin to every other tick in dense mode, anchored to
    // always keep the most recent week (the "today" point) labeled.
    labels.forEach((lb, i) => {
      if (n >= 10 && (n - 1 - i) % 2 === 1) return;
      s += `<text x="${xC(i).toFixed(1)}" y="${H - 10}" text-anchor="middle" class="axis-tick x">${lb}</text>`;
    });
    s += `<text x="${padL}" y="12" class="axis-title">${axisLabel}</text>`;
    s += `</svg>`;
    return s;
  }

  /* ============================================================
     AI content generation (governed, grounded in on-screen numbers)
     ============================================================ */

  function ordinalDriver(view) {
    if (view.drivers) return view.drivers[0];
    const worst = view.falloff.reduce((a, b) => (b.abandonRate > a.abandonRate ? b : a));
    // 2026-07-20: carry vsWeek/vsMonth through too (view.falloff's rows
    // already compute them, same as Portfolio's own view.drivers) -- without
    // this, a product tab's funnel driver line had no trend movement to
    // report, unlike Portfolio's.
    return {
      product: PRODUCT_BY_ID[view.productId || ""] ? PRODUCT_BY_ID[view.productId].short : "",
      step: worst.step,
      abandonRate: worst.abandonRate,
      abandoned: worst.abandoned,
      vsWeek: worst.vsWeek,
      vsMonth: worst.vsMonth,
    };
  }

  // Active Engaged Customers driver, Portfolio only (2026-07-20, per direct
  // feedback): "What moved" has always named AEC's blended MoM trend for
  // scale/context, but "Likely reason"/"Suggestion" never covered it -- the
  // two fields' scope silently stopped short of what "What moved" actually
  // discusses. AEC is a raw count with no target, so there's no gap to
  // decompose the way the four targeted KPIs are; the natural driver
  // instead is which included product contributed the largest share of the
  // net MoM change (by absolute customers, not percent -- a small product
  // swinging 20% moves the portfolio far less than a large one swinging
  // 2%).
  function aecDriverPortfolio(view) {
    const lfm = lastFullMonthIndices();
    const perProduct = view.included.map((pid) => {
      const series = view.perProduct[pid].series.active_engaged;
      const cur = series[lfm.curIdx];
      const prior = lfm.priorIdx != null ? series[lfm.priorIdx] : cur;
      const deltaPct = prior ? ((cur - prior) / prior) * 100 : 0;
      const deltaAbs = cur - prior;
      return { productId: pid, product: PRODUCT_BY_ID[pid].short, cur, prior, deltaPct, deltaAbs };
    });
    return perProduct.reduce((a, b) => (Math.abs(b.deltaAbs) > Math.abs(a.deltaAbs) ? b : a));
  }

  // Segment lens for the same AEC trend: which FILTER_DIMS segment shows
  // the largest MoM movement in active-engaged customers (by percent, since
  // segments don't have a comparable absolute scale to each other the way
  // products do). Same "pin one segment value, recompute with the existing
  // governed share adjustment" pattern used everywhere else.
  function aecSegmentDriverPortfolio(view) {
    const lfm = lastFullMonthIndices();
    let mostMoved = null;
    Object.keys(FILTER_DIMS).forEach((dimKey) => {
      FILTER_DIMS[dimKey].options.forEach((opt) => {
        const pinned = filtersPinned(view.filters, dimKey, opt.v);
        const cur = view.included.reduce((s, pid) => s + productSeriesForFilters(pid, pinned).series.active_engaged[lfm.curIdx], 0);
        const prior =
          lfm.priorIdx != null ? view.included.reduce((s, pid) => s + productSeriesForFilters(pid, pinned).series.active_engaged[lfm.priorIdx], 0) : cur;
        const deltaPct = prior ? ((cur - prior) / prior) * 100 : 0;
        if (!mostMoved || Math.abs(deltaPct) > Math.abs(mostMoved.deltaPct)) mostMoved = { dimKey, dimLabel: FILTER_DIMS[dimKey].label, value: opt.v, deltaPct };
      });
    });
    return mostMoved;
  }

  // Deepening Rate driver, Portfolio (2026-07-19): unlike the falloff funnel
  // (which decomposes to a specific workflow step), Deepening Rate has no
  // step-level breakdown in this model -- but Portfolio blends across four
  // products, so the natural, already-computed comparison is which included
  // product's own Deepening Rate is furthest below its target (or, if none
  // has a target, simply lowest). Reuses the exact same last-full-month
  // anchor and bd.rateMult adjustment the KPI cards use, so this always
  // agrees with what the KPI card itself would show for that product.
  function deepeningDriverPortfolio(view) {
    const lfm = lastFullMonthIndices();
    const bd = view.bd;
    const candidates = view.included.map((pid) => {
      const series = view.perProduct[pid].series.deepening_rate;
      const raw = series[lfm.curIdx];
      const current = clamp(raw * bd.rateMult, 1, 99);
      const target = DATA.targets[pid].deepening_rate;
      const gap = target != null ? current - target : null;
      // 2026-07-20 (trend analysis, per direct feedback): wk-over-wk
      // movement of this product's own Deepening Rate, same anchor/scaling
      // as `current` -- gives the driver line a trend fact, not just a
      // snapshot comparison.
      const vsWeek = lfm.curIdx > 0 ? current - clamp(series[lfm.curIdx - 1] * bd.rateMult, 1, 99) : null;
      return { productId: pid, product: PRODUCT_BY_ID[pid].short, current, target, gap, vsWeek };
    });
    const withTarget = candidates.filter((c) => c.gap != null);
    return withTarget.length ? withTarget.reduce((a, b) => (b.gap < a.gap ? b : a)) : candidates.reduce((a, b) => (b.current < a.current ? b : a));
  }

  // Deepening Rate driver, product tab (2026-07-19): a single product tab
  // has no other product to compare against, so the natural driver instead
  // asks which single segment value, in isolation, produces the lowest
  // modeled Deepening Rate -- the same "pin one FILTER_DIMS value, recompute
  // with the existing governed formula" pattern Split by and the falloff
  // segment helpers already use, just applied to Deepening Rate and scored
  // across all four dimensions at once to find the single weakest segment,
  // rather than one dimension at a time.
  // Returns every (dimension, value) segment candidate's modeled value for
  // one KPI, sorted worst-first -- the full ranking `segmentDriverProduct`
  // and `deepeningDriverProduct` each only surface the #1 of. Kept separate
  // so callers that want a runner-up (a second, independent reason -- see
  // deepeningDriverProduct below) don't have to re-run the same governed
  // pin-and-recompute loop a second time.
  function segmentDriverCandidatesProduct(tabId, view, kpiId) {
    const filters = view.filters;
    const lfm = lastFullMonthIndices();
    const candidates = [];
    Object.keys(FILTER_DIMS).forEach((dimKey) => {
      FILTER_DIMS[dimKey].options.forEach((opt) => {
        const series = productSeriesForFilters(tabId, filtersPinned(filters, dimKey, opt.v)).series[kpiId];
        const rate = series[lfm.curIdx];
        // 2026-07-20 (trend analysis, per direct feedback): this segment's
        // own wk-over-wk movement, under the same pinned filter -- shared by
        // every caller of this helper (Deepening Rate and the funnel KPIs'
        // segment lens alike), so trend context reaches every segment-lens
        // bullet in the Executive Summary, not just the top-level driver.
        const vsWeek = lfm.curIdx > 0 ? rate - series[lfm.curIdx - 1] : null;
        candidates.push({ dimKey, dimLabel: FILTER_DIMS[dimKey].label, value: opt.v, rate, vsWeek });
      });
    });
    candidates.sort((a, b) => a.rate - b.rate);
    return candidates;
  }

  function deepeningDriverProduct(tabId, view) {
    const candidates = segmentDriverCandidatesProduct(tabId, view, "deepening_rate");
    // `second` carries the runner-up segment so the Executive Summary can
    // give a product tab's Deepening Rate driver a genuine second reason
    // (this KPI has no separate workflow-step lens the way funnel-driven
    // KPIs do, so the second cut comes from the same segment ranking rather
    // than a different lens entirely).
    return Object.assign({}, candidates[0], { second: candidates[1] || null });
  }

  // Segment lens (2026-07-19 follow-up): deepeningDriverProduct above already
  // asks "which single segment value, pinned in isolation, produces the
  // worst modeled rate" for Deepening Rate specifically. Generalized here so
  // the same governed pattern -- pin one FILTER_DIMS value, recompute with
  // the existing certified formula, keep the worst -- can be asked of ANY
  // rate KPI, not just Deepening Rate. This gives the funnel-driven KPIs
  // (Habit Formation, Core Job Completion) a second, independent lever
  // alongside their existing workflow-step driver: not just "which step in
  // the journey is leaking," but "which customer segment is disproportion-
  // ately represented in that leak" -- two different decision points for a
  // leader (fix the step vs. target the segment), not one.
  function segmentDriverProduct(tabId, view, kpiId) {
    return segmentDriverCandidatesProduct(tabId, view, kpiId)[0];
  }

  // Same segment lens, Portfolio scope: reuses portfolioBlendedSeriesForFilters
  // (the same active-engaged-weighted blend the Split by feature already
  // uses) with each segment value pinned in turn, across the included
  // products, so the comparison stays apples-to-apples with what the
  // Portfolio KPI cards themselves would show for that value.
  function segmentDriverPortfolio(view, kpiId) {
    const lfm = lastFullMonthIndices();
    let worst = null;
    Object.keys(FILTER_DIMS).forEach((dimKey) => {
      FILTER_DIMS[dimKey].options.forEach((opt) => {
        const pinned = filtersPinned(view.filters, dimKey, opt.v);
        const series = portfolioBlendedSeriesForFilters(view.included, pinned, view.bd, kpiId);
        const rate = series[lfm.curIdx];
        // 2026-07-20 (trend analysis): same wk-over-wk addition as the
        // product-tab segment helper above, kept consistent across scopes.
        const vsWeek = lfm.curIdx > 0 ? rate - series[lfm.curIdx - 1] : null;
        if (!worst || rate < worst.rate) worst = { dimKey, dimLabel: FILTER_DIMS[dimKey].label, value: opt.v, rate, vsWeek };
      });
    });
    return worst;
  }

  // Driver bundle for a single KPI card (2026-07-19): given whichever card is
  // being narrated -- the primary (worst-gap) mover or, when a second KPI's
  // gap also clears the materiality bar, that second mover too -- produces
  // the driver text/decision/citation for it. Pulled out of buildAiSummary
  // so both movers go through identical logic instead of the primary/
  // secondary paths silently drifting apart over time.
  function driverBundleForCard(tabId, view, card) {
    const kpiId = card.kpi.id;
    const isPortfolio = tabId === "portfolio";
    if (kpiId === "habit_formation" || kpiId === "core_job_completion") {
      const d = isPortfolio ? view.drivers[0] : ordinalDriver(Object.assign({ productId: tabId }, view));
      const seg = isPortfolio ? segmentDriverPortfolio(view, kpiId) : segmentDriverProduct(tabId, view, kpiId);
      // Abandonment rates and "lowest modeled rate" segment call-outs are
      // always naming the weak point behind the gap, not a number whose
      // sign could go either way -- colored red outright rather than by
      // testing >= 0.
      // 2026-07-20 (trend analysis, per direct feedback): the step's own
      // wk-over-wk movement (d.vsWeek, already computed the same way the
      // falloff ranking rows/trend chart show it) is now stated alongside
      // the snapshot rate -- an abandonment rate that's climbing is a
      // different story from one that's already improving, and "Likely
      // reason" previously only ever showed the single-period number. Lower
      // abandonment is favorable, so the trend color is the opposite test
      // from a KPI movement/gap (<=0 is green here, not >=0).
      const trendClause = d.vsWeek != null ? `, trending ${numSpan(fmtDeltaPts(d.vsWeek), d.vsWeek <= 0)} vs. last week` : "";
      const stepLine = isPortfolio
        ? `Largest single driver behind ${card.kpi.name}: ${d.product} — ${d.step} (${numSpan(pct(d.abandonRate * 100), false)} abandonment${trendClause}, ${compactNum(d.abandoned)} customers).`
        : `Largest contributing driver: ${FRICTION_LABEL[tabId]} falloff, ${numSpan(pct(d.abandonRate * 100), false)} abandonment${trendClause} (${compactNum(d.abandoned)} customers), concentrated in the ${d.step} step.`;
      // Segment rates are the KPI's own "higher is better" scale (unlike the
      // abandonment rate above), so trend favorability flips: >= 0 is green.
      const segTrendClause = seg && seg.vsWeek != null ? `, trending ${numSpan(pts(seg.vsWeek), seg.vsWeek >= 0)} vs. last week` : "";
      const segLine = seg
        ? `Segment lens: the ${seg.value} segment (by ${seg.dimLabel}) shows the lowest modeled ${card.kpi.name} at ${numSpan(pct(seg.rate), false)}${segTrendClause} -- a second lever alongside the journey-step driver above.`
        : null;
      return {
        kind: "funnel",
        // Same underlying step+product pair regardless of which funnel KPI
        // asked for it (Habit Formation and Core Job Completion are both fed
        // by the identical workflow-falloff decomposition) -- used to detect
        // and dedupe when both movers would otherwise repeat the same fact.
        dedupeKey: `funnel:${d.product}|${d.step}`,
        lines: [stepLine, segLine].filter(Boolean),
        decision:
          card.gap != null && card.gap < -0.5
            ? isPortfolio
              ? `Prioritize an intervention review for ${d.product} before next QBR.`
              : `Recommend workflow-owner review of ${FRICTION_LABEL[tabId].toLowerCase()} this cycle.`
            : isPortfolio
            ? `Portfolio is tracking near target — monitor, no intervention flagged this period.`
            : `Trending in line with target — continue current monitoring cadence.`,
        citesFalloff: true,
      };
    }
    if (kpiId === "deepening_rate") {
      if (isPortfolio) {
        const dd = deepeningDriverPortfolio(view);
        const seg = segmentDriverPortfolio(view, "deepening_rate");
        const ddTrendClause = dd.vsWeek != null ? `, trending ${numSpan(pts(dd.vsWeek), dd.vsWeek >= 0)} vs. last week` : "";
        const lines = [
          `${dd.product} has the lowest Deepening Rate among included products, at ${numSpan(pct(dd.current), false)}${
            dd.target != null ? ` vs. ${pct(dd.target)} target (${numSpan(pts(dd.gap), dd.gap >= 0)})` : ""
          }${ddTrendClause} — the main drag on the blended figure.`,
        ];
        if (seg) {
          const segTrendClause = seg.vsWeek != null ? `, trending ${numSpan(pts(seg.vsWeek), seg.vsWeek >= 0)} vs. last week` : "";
          lines.push(
            `Segment lens: the ${seg.value} segment (by ${seg.dimLabel}) shows the lowest modeled Deepening Rate at ${numSpan(pct(seg.rate), false)}${segTrendClause} across included products -- a second cut alongside the product-level view above.`
          );
        }
        return {
          kind: "deepening",
          dedupeKey: `deepening-portfolio:${dd.product}`,
          lines,
          decision: `Recommend a cross-sell/bundling review focused on ${dd.product} before next QBR.`,
          citesFalloff: false,
        };
      }
      const dd = deepeningDriverProduct(tabId, view);
      const ddTrendClause = dd.vsWeek != null ? `, trending ${numSpan(pts(dd.vsWeek), dd.vsWeek >= 0)} vs. last week` : "";
      const ddLines = [`The ${dd.value} segment (by ${dd.dimLabel}) has the lowest modeled Deepening Rate at ${numSpan(pct(dd.rate), false)}${ddTrendClause}, the main driver of the product-level gap.`];
      if (dd.second) {
        const secondTrendClause = dd.second.vsWeek != null ? `, trending ${numSpan(pts(dd.second.vsWeek), dd.second.vsWeek >= 0)} vs. last week` : "";
        ddLines.push(`Second-largest segment factor: the ${dd.second.value} segment (by ${dd.second.dimLabel}) at ${numSpan(pct(dd.second.rate), false)}${secondTrendClause}.`);
      }
      return {
        kind: "deepening",
        dedupeKey: `deepening-product:${dd.dimKey}|${dd.value}`,
        lines: ddLines,
        decision: `Recommend a cross-sell review focused on the ${dd.value} segment.`,
        citesFalloff: false,
      };
    }
    // Activation Rate (and anything else that reaches this fallback): no
    // step-level funnel decomposition exists for it in this data model, but
    // 2026-07-20 (per direct feedback -- segment analysis should reach
    // every topic in the Executive Summary, not just the funnel/deepening
    // KPIs) a segment lens is still computable via the same generalized
    // segmentDriverProduct/Portfolio helpers used everywhere else, since
    // those work for any rate KPI. Gives this KPI at least one real,
    // governed comparison instead of only a flagged-gap message.
    const seg = isPortfolio ? segmentDriverPortfolio(view, kpiId) : segmentDriverProduct(tabId, view, kpiId);
    const segTrendClause = seg && seg.vsWeek != null ? `, trending ${numSpan(pts(seg.vsWeek), seg.vsWeek >= 0)} vs. last week` : "";
    const lines = [
      `A step-level funnel decomposition isn't available for ${card.kpi.name} yet — driver analysis here covers the Habit Formation/Core Job Completion funnel and Deepening Rate's segment mix natively; treat the segment comparison below as a starting point, not an attributed cause.`,
    ];
    if (seg) {
      lines.push(
        `Segment lens: the ${seg.value} segment (by ${seg.dimLabel}) shows the lowest modeled ${card.kpi.name} at ${numSpan(pct(seg.rate), false)}${segTrendClause}${isPortfolio ? " across included products" : ""}.`
      );
    }
    return {
      kind: "none",
      dedupeKey: "none",
      lines,
      decision: seg
        ? `Recommend an activation-funnel owner review, starting with the ${seg.value} segment, before assuming it shares a root cause with the funnel/segment drivers above.`
        : `Recommend an activation-funnel owner review before assuming it shares a root cause with the funnel/segment drivers above.`,
      citesFalloff: false,
    };
  }

  function buildAiSummary(tabId, view) {
    const habitCard = view.kpiCards.find((c) => c.kpi.id === "habit_formation");
    const gapTxt = habitCard.gap != null ? pts(habitCard.gap) : "n/a";
    const gapTxtColored = habitCard.gap != null ? numSpan(gapTxt, habitCard.gap >= 0) : gapTxt;

    // The status chip is driven by whichever targeted KPI has the worst
    // gap-vs-target (see tabOverallStatus) -- not always Habit Formation.
    // The card used to always narrate Habit Formation regardless, so a
    // "Needs attention" chip could sit above text about a modest -1.5pt
    // Habit Formation gap while a *different* KPI (e.g. Deepening Rate) was
    // actually the one sitting in risk territory. Find the real worst KPI
    // and, if it isn't Habit Formation, say so explicitly and name it,
    // rather than the chip and the narrative silently disagreeing.
    const status = tabOverallStatus(view.kpiCards);
    const targeted = view.kpiCards.filter((c) => c.target != null);

    // Mover ranking (2026-07-20, per direct feedback): "what moved" was
    // picking the KPI furthest below its target (gap-vs-target only), which
    // could name a KPI that's been chronically a little behind but hasn't
    // actually moved this period, while ignoring a KPI swinging hard MoM
    // that just hasn't drifted below target yet. Confirmed weighting: 70%
    // this period's MoM movement, 30% gap-vs-target -- movement dominates
    // the ranking, but a KPI that's badly off target can still surface if
    // its movement isn't as extreme. The status chip (tabOverallStatus,
    // above) deliberately keeps its original gap-only meaning ("how far off
    // target are we") -- only the Executive Summary's mover selection below
    // uses this composite.
    const moverScore = (c) => 0.7 * c.movement + 0.3 * c.gap;

    // Second mover: only the single top-ranked KPI was ever named before. A
    // second targeted KPI is now also called out, but ONLY when its own
    // composite score also clears the same -0.5 "worth escalating" bar the
    // primary mover already uses below -- a KPI that's merely not-the-worst
    // isn't a real second concern, and naming one every period regardless
    // would overstate how many things are actually wrong this period.
    const sortedByMoverScore = [...targeted].sort((a, b) => moverScore(a) - moverScore(b));
    const primaryCard = sortedByMoverScore.length ? sortedByMoverScore[0] : null;
    const secondaryCard = sortedByMoverScore.length > 1 && moverScore(sortedByMoverScore[1]) < -0.5 ? sortedByMoverScore[1] : null;
    const worstKpiId = primaryCard ? primaryCard.kpi.id : "habit_formation";
    const gapBelowWorst = primaryCard ? moverScore(primaryCard) < -0.5 : habitCard.gap != null && habitCard.gap < -0.5;

    // Driver coverage (2026-07-19): the workflow-falloff funnel decomposes
    // to a specific step for both Habit Formation (a repeat-completion
    // metric fed by that same funnel) and Core Job Completion (literally
    // 1 - that funnel's abandonment) -- same computation, attributed to
    // whichever of the two is actually the worst gap. Deepening Rate gets
    // its own decomposition (deepeningDriverPortfolio/Product) since it
    // isn't a funnel metric -- Portfolio compares across included products,
    // a single product tab compares across its own segment mix, and both
    // scopes now also get a segment lens (segmentDriverPortfolio/Product)
    // as a second, independent cut. Activation Rate has no sub-funnel
    // breakdown in this data model, so it's the one KPI that still falls
    // back to the "not available" message -- an honest gap, not a
    // placeholder.
    const primaryCardEff = primaryCard || habitCard;
    const primaryBundle = driverBundleForCard(tabId, view, primaryCardEff);
    const secondaryBundle = secondaryCard ? driverBundleForCard(tabId, view, secondaryCard) : null;
    // Habit Formation and Core Job Completion are fed by the identical
    // workflow-falloff decomposition -- if both happen to be the top two
    // movers in the same period, repeating the same step/product fact twice
    // under two different KPI names would read as two problems when it's
    // actually one. Detected via dedupeKey (set in driverBundleForCard) and
    // stated once, explicitly, instead.
    const sharesDriver = !!(secondaryBundle && secondaryBundle.dedupeKey === primaryBundle.dedupeKey);

    let whatMoved, driverLine, decision;
    if (tabId === "portfolio") {
      // Was previously reading kpiCards[0].movement (Activation Rate's
      // percentage-POINT delta) and mislabeling it as "Active Engaged
      // Customers" -- stale since active_engaged stopped being a KPI card
      // (M1/M16). Computed fresh here so it actually reflects the real
      // active-customer count, consistent with the scale strip above, and
      // anchored to the same last-full-month comparison as the cards.
      const lfmAec = lastFullMonthIndices();
      const curAec = view.included.reduce((s, pid) => s + view.perProduct[pid].series.active_engaged[lfmAec.curIdx], 0);
      const priorAec =
        lfmAec.priorIdx != null ? view.included.reduce((s, pid) => s + view.perProduct[pid].series.active_engaged[lfmAec.priorIdx], 0) : curAec;
      const aecMovementPct = priorAec ? ((curAec - priorAec) / priorAec) * 100 : 0;
      const aecBullet = `Portfolio Active Engaged Customers ${numSpan(signedPct(aecMovementPct), aecMovementPct >= 0)} vs. prior month.`;
      const primaryName = primaryCard ? primaryCard.kpi.name : "Habit Formation";

      whatMoved = [
        aecBullet,
        primaryCard
          ? `${primaryName} moved ${numSpan(pts(primaryCard.movement), primaryCard.movement >= 0)} this period and now sits ${numSpan(pts(primaryCard.gap), primaryCard.gap >= 0)} vs. target (${STATUS_LABEL[status]}).`
          : `${primaryName} gap vs. target is ${gapTxtColored} (${STATUS_LABEL[status]}).`,
      ];
      if (primaryBundle.kind === "none" && worstKpiId !== "habit_formation") whatMoved.push(`Habit Formation gap is a smaller ${gapTxtColored} for comparison.`);
      if (secondaryCard) whatMoved.push(`${secondaryCard.kpi.name} moved ${numSpan(pts(secondaryCard.movement), secondaryCard.movement >= 0)} this period (now ${numSpan(pts(secondaryCard.gap), secondaryCard.gap >= 0)} vs. target) -- the next-largest mover.`);
    } else {
      const productShort = PRODUCT_BY_ID[tabId].short;
      const primaryName = primaryCard ? primaryCard.kpi.name : "Habit Formation";

      whatMoved = [
        primaryCard
          ? `${productShort} ${primaryName} moved ${numSpan(pts(primaryCard.movement), primaryCard.movement >= 0)} this period and now sits at ${pct(primaryCard.current)}${
              primaryCard.target != null ? ` vs. ${pct(primaryCard.target)} target` : ""
            } (${numSpan(pts(primaryCard.gap), primaryCard.gap >= 0)}).`
          : `${productShort} ${primaryName} is ${pct(primaryCardEff.current)}${primaryCardEff.target != null ? ` vs. ${pct(primaryCardEff.target)} target` : " (no target)"} (${
              primaryCardEff.gap != null ? numSpan(pts(primaryCardEff.gap), primaryCardEff.gap >= 0) : "n/a"
            }).`,
      ];
      if (primaryBundle.kind === "none" && worstKpiId !== "habit_formation") whatMoved.push(`Habit Formation gap is a smaller ${gapTxtColored} for comparison.`);
      if (secondaryCard) whatMoved.push(`${secondaryCard.kpi.name} moved ${numSpan(pts(secondaryCard.movement), secondaryCard.movement >= 0)} this period (now ${numSpan(pts(secondaryCard.gap), secondaryCard.gap >= 0)} vs. target) -- the next-largest mover.`);
    }

    // 2026-07-20 (per direct feedback): "Likely reason"/"Suggestion" bullets
    // must be ordered to match "What moved"'s own bullet order -- AEC first
    // (portfolio only, since it's always "What moved"'s first bullet there),
    // then the primary mover, then the secondary mover -- with each mover's
    // own reasons internally ordered by significance (its single biggest
    // driver fact first, a supplementary segment-lens cut second). Built as
    // separate ordered blocks below and concatenated in that exact sequence,
    // rather than appending AEC at the end as an afterthought.
    let aecLines = [],
      aecDecision = [];
    if (tabId === "portfolio") {
      const aecDriver = aecDriverPortfolio(view);
      const aecSeg = aecSegmentDriverPortfolio(view);
      const aecFavorable = aecDriver.deltaPct >= 0;
      aecLines.push(
        `Active Engaged Customers: ${aecDriver.product} is the largest contributor to this period's net change (${numSpan(signedPct(aecDriver.deltaPct), aecFavorable)} MoM).`
      );
      if (aecSeg) {
        aecLines.push(
          `Segment lens: the ${aecSeg.value} segment (by ${aecSeg.dimLabel}) shows the largest MoM movement in active-engaged customers, at ${numSpan(signedPct(aecSeg.deltaPct), aecSeg.deltaPct >= 0)}.`
        );
      }
      aecDecision.push(
        aecFavorable
          ? `Continue current acquisition/retention motions for ${aecDriver.product} -- it's the primary driver of this period's active-customer growth.`
          : `Recommend a customer-health review for ${aecDriver.product} -- it's the primary driver of this period's active-customer decline.`
      );
    }

    // Primary mover gets its full driver bundle (2 reasons, where a second,
    // independent cut is actually computable -- see driverBundleForCard).
    // Secondary mover is deliberately kept to exactly ONE reason and ONE
    // suggestion -- it's a real second concern worth naming, not a second
    // full writeup competing with the primary for attention.
    const primaryLines = [...primaryBundle.lines];
    const primaryDecision = [primaryBundle.decision];
    const secondaryLines = [];
    const secondaryDecision = [];
    if (secondaryBundle) {
      if (sharesDriver) {
        // Habit Formation and Core Job Completion are both fed by the
        // identical workflow-falloff funnel -- the secondary's "one reason"
        // is that shared fact, not a repeat of the primary's step detail,
        // and its "one suggestion" is that no separate fix is needed.
        secondaryLines.push(`${secondaryCard.kpi.name} shares this same driver -- it and ${primaryCardEff.kpi.name} are both fed by the identical workflow-falloff funnel.`);
        secondaryDecision.push(`No separate action needed for ${secondaryCard.kpi.name} -- the ${primaryCardEff.kpi.name} review above should move both metrics together.`);
      } else {
        // Only the secondary bundle's own headline reason, not its segment
        // lens too -- that second cut is reserved for the primary mover so
        // the summary doesn't read as two full driver writeups back to back.
        secondaryLines.push(secondaryBundle.lines[0]);
        secondaryDecision.push(secondaryBundle.decision);
      }
    }

    driverLine = [...aecLines, ...primaryLines, ...secondaryLines];
    decision = [...aecDecision, ...primaryDecision, ...secondaryDecision];

    const citeTokens = [citeToken(tabId, worstKpiId)];
    if (primaryBundle.citesFalloff) citeTokens.push("workflow_falloff");
    if (secondaryCard && secondaryCard.kpi.id !== worstKpiId) {
      const secToken = citeToken(tabId, secondaryCard.kpi.id);
      if (!citeTokens.includes(secToken)) citeTokens.push(secToken);
      if (secondaryBundle.citesFalloff && !citeTokens.includes("workflow_falloff")) citeTokens.push("workflow_falloff");
    }

    return {
      status,
      whatMoved,
      driverLine,
      decision,
      caveat: "Scenario estimate based on certified workflow counts, not causal proof.",
      citation: `Cites: ${citeTokens.map((t) => "\`" + t + "\`").join(", ")} · refreshed ${REFRESH_TS} · owner: ${tabId === "portfolio" ? "Product Analytics" : PRODUCT_BY_ID[tabId].short + " Analytics"} · reconciled to dashboard`,
    };
  }

  // Prefer the certified, named formula (e.g. "Invoice Success Rate") over a
  // generic snake_case metric id whenever one exists for this product/KPI --
  // makes the "AI only cites certified definitions" story concrete rather
  // than cosmetic. Portfolio tab has no single product formula, so it falls
  // back to the generic id there.
  function citeToken(tabId, kpiId) {
    const f = tabId !== "portfolio" && METRIC_FORMULAS[tabId] ? METRIC_FORMULAS[tabId][kpiId] : null;
    return f ? f.name : kpiId;
  }

  // A "why is X low / what's the gap" question and a "why did X go up over
  // the past N weeks" question need different answers -- the first is about
  // the current gap-vs-target, the second is about directional movement
  // across the displayed window. Without this check, every question just
  // fell through to the gap/driver template, so a trend question like "what
  // caused habit formation to go up in the past 3 months" got answered with
  // the current gap and a negatively-framed driver, ignoring "up" entirely.
  const TREND_RE =
    /\btrend\b|\bover (the )?(past|last)\b|\b(past|last)\s+\d+\s*(day|week|month|quarter|year)s?\b|\b(increase|increasing|increased|rose|rising|risen|went up|going up|go up|climb|climbing|climbed|improve|improved|improving)\b|\b(decrease|decreasing|decreased|fell|falling|fallen|went down|going down|go down|drop|dropped|dropping|declin|worsen)\b|\bup or down\b|\bchange(d)? over\b/;

  function trendAnswer(scopeLabel, metricName, card, weeks, citeStr) {
    const series = card.series;
    if (!series || series.length < 2) return null;
    const startVal = series[0];
    const endVal = series[series.length - 1];
    const delta = endVal - startVal;
    const dir = delta > 0.3 ? "rose" : delta < -0.3 ? "fell" : "was roughly flat";
    const spanLabel = `${fmtWeekLabel(weeks[0])}–${fmtWeekLabel(weeks[weeks.length - 1])}`;
    const deltaTxt = delta > 0.3 || delta < -0.3 ? `, moving ${pts(delta)}` : "";
    return {
      text: `${scopeLabel} ${metricName} ${dir} over the displayed ${weeks.length}-week window (${spanLabel})${deltaTxt}, from ${pct(startVal)} to ${pct(endVal)}. This dashboard's driver analysis is built for the current-period gap-vs-target view -- it doesn't yet decompose a positive or negative multi-week trend to a single driver, so treat this as the directional read from the chart, not an attributed cause.`,
      cites: citeStr,
    };
  }

  const OUT_OF_SCOPE_KEYWORDS = [
    "revenue",
    "churn",
    "retention",
    "ssn",
    "social security",
    "salary",
    "pii",
    "account number",
    "password",
    "legal",
    "compliance",
    "hr ",
    "layoff",
    "headcount",
    "stock price",
  ];
  const OUT_OF_SCOPE_RESPONSE =
    "I can't answer that from this governed dashboard because it is outside the certified Product Engagement metric scope. I can help with activation, job completion, habit formation, deepening, falloff, targets, and certified driver analysis.";

  // Which certified metric/topic a question is about, independent of which
  // product or scope it's asking about -- shared by answerQuestion (which
  // needs it to pick a response body) and askAndRender's scope-
  // clarification check (2026-07-19, which needs to know a question is
  // about a scoped topic *before* deciding whether it also names a product
  // or "portfolio"). Order/patterns match answerQuestion's original inline
  // routing exactly, just extracted so the two call sites can't drift apart.
  function detectMetricTopic(q) {
    if (/deepen|cross.?sell|attach|multi.?product|other product/.test(q)) return "deepening";
    if (/habit/.test(q)) return "habit";
    if (/activat/.test(q)) return "activation";
    if (/core job|job completion|complet/.test(q)) return "core_completion";
    if (/falloff|drop|abandon|stuck|attention|worst|driver/.test(q)) return "falloff";
    if (/target|gap|goal/.test(q)) return "target_gap";
    return null;
  }

  function answerQuestion(tabId, view, question) {
    const q = question.toLowerCase();
    if (OUT_OF_SCOPE_KEYWORDS.some((kw) => q.includes(kw))) {
      return { text: OUT_OF_SCOPE_RESPONSE, cites: null, boundary: true };
    }

    const habitCard = view.kpiCards.find((c) => c.kpi.id === "habit_formation");
    const activationCard = view.kpiCards.find((c) => c.kpi.id === "activation_rate");
    const coreCard = view.kpiCards.find((c) => c.kpi.id === "core_job_completion");
    const deepeningCard = view.kpiCards.find((c) => c.kpi.id === "deepening_rate");
    const topic = detectMetricTopic(q);

    if (topic === "deepening") {
      const scopeLabel = tabId === "portfolio" ? "Portfolio (blended)" : PRODUCT_BY_ID[tabId].short;
      const deepeningCite = `\`${citeToken(tabId, "deepening_rate")}\` · refreshed ${REFRESH_TS} · reconciled to dashboard`;
      if (TREND_RE.test(q)) {
        const t = trendAnswer(scopeLabel, "Deepening Rate", deepeningCard, view.weeks, deepeningCite);
        if (t) return t;
      }
      return {
        text: `${scopeLabel} Deepening Rate is ${pct(deepeningCard.current)}${deepeningCard.target != null ? ` vs. ${pct(deepeningCard.target)} target (${pts(deepeningCard.gap)})` : ""}, moving ${pts(deepeningCard.movement)} vs. prior period. This measures the share of active customers who have adopted at least one additional product beyond their primary one.`,
        cites: deepeningCite,
      };
    }
    if (topic === "habit") {
      const scopeLabel = tabId === "portfolio" ? "Portfolio (blended)" : PRODUCT_BY_ID[tabId].short;
      const habitCite = `\`${citeToken(tabId, "habit_formation")}\` · refreshed ${REFRESH_TS} · reconciled to dashboard`;
      if (TREND_RE.test(q)) {
        const t = trendAnswer(scopeLabel, "Habit Formation", habitCard, view.weeks, habitCite);
        if (t) return t;
      }
      const d = ordinalDriver(Object.assign({ productId: tabId }, view));
      const gapTxt = habitCard.gap != null ? pts(habitCard.gap) : "n/a";
      return {
        text: `${scopeLabel} Habit Formation is ${pct(habitCard.current)}${habitCard.target != null ? ` vs. ${pct(habitCard.target)} target (${gapTxt})` : ""}. The largest driver is ${d.step} falloff (${d.product}), contributing an estimated ${pts(-d.abandonRate * 10)} to the gap, concentrated among newer customers. This is a scenario estimate based on certified workflow counts, not causal proof.`,
        cites: `\`${citeToken(tabId, "habit_formation")}\`, \`${d.step.toLowerCase().replace(/\s+/g, "_")}_falloff\` · refreshed ${REFRESH_TS} · reconciled to dashboard`,
      };
    }
    if (topic === "activation") {
      const scopeLabel = tabId === "portfolio" ? "Portfolio (blended)" : PRODUCT_BY_ID[tabId].short;
      const activationCite = `\`${citeToken(tabId, "activation_rate")}\` · refreshed ${REFRESH_TS} · reconciled to dashboard`;
      if (TREND_RE.test(q)) {
        const t = trendAnswer(scopeLabel, "Activation Rate", activationCard, view.weeks, activationCite);
        if (t) return t;
      }
      return {
        text: `${scopeLabel} Activation Rate is ${pct(activationCard.current)}${activationCard.target != null ? ` vs. ${pct(activationCard.target)} target (${pts(activationCard.gap)})` : ""}, moving ${pts(activationCard.movement)} vs. prior period. This measures the share of new customers who reach first value in the product. No computed driver decomposition exists yet for this metric.`,
        cites: activationCite,
      };
    }
    if (topic === "core_completion") {
      const scopeLabel = tabId === "portfolio" ? "Portfolio (blended)" : PRODUCT_BY_ID[tabId].short;
      const coreCite = `\`${citeToken(tabId, "core_job_completion")}\` · refreshed ${REFRESH_TS} · reconciled to dashboard`;
      if (TREND_RE.test(q)) {
        const t = trendAnswer(scopeLabel, "Core Job Completion", coreCard, view.weeks, coreCite);
        if (t) return t;
      }
      const dCore = ordinalDriver(Object.assign({ productId: tabId }, view));
      return {
        text: `${scopeLabel} Core Job Completion is ${pct(coreCard.current)}${coreCard.target != null ? ` vs. ${pct(coreCard.target)} target (${pts(coreCard.gap)})` : ""}, moving ${pts(coreCard.movement)} vs. prior period. The largest driver is ${dCore.step} falloff (${dCore.product}), affecting roughly ${compactNum(dCore.abandoned)} customers. This is a scenario estimate based on certified workflow counts, not causal proof.`,
        cites: `\`${citeToken(tabId, "core_job_completion")}\`, \`${dCore.step.toLowerCase().replace(/\s+/g, "_")}_falloff\` · refreshed ${REFRESH_TS} · reconciled to dashboard`,
      };
    }
    if (topic === "falloff") {
      const d = ordinalDriver(Object.assign({ productId: tabId }, view));
      return {
        text: `The largest falloff driver in view is ${d.step}${d.product ? ` (${d.product})` : ""}, with ${pct(d.abandonRate * 100)} abandonment affecting roughly ${compactNum(d.abandoned)} customers this period.`,
        cites: `workflow_falloff · refreshed ${REFRESH_TS} · reconciled to dashboard`,
      };
    }
    if (topic === "target_gap") {
      const gaps = view.kpiCards.filter((c) => c.target != null).map((c) => `${c.kpi.name}: ${pts(c.gap)}`);
      return {
        text: `Actual-vs-target gaps this period — ${gaps.join("; ")}.`,
        cites: `target_gap · refreshed ${REFRESH_TS} · reconciled to dashboard`,
      };
    }
    return {
      text: "I can help with activation, core job completion, habit formation, deepening, falloff, and targets for this dashboard's certified metrics. Try asking about one of those, or use a suggested question above.",
      cites: null,
    };
  }

  // Scope-clarification messages (2026-07-19): a recognized metric question
  // that names neither a specific product nor "portfolio" gets asked which
  // one it means, rather than askAndRender silently answering for whatever
  // tab happens to be open. `cites: null` and `clarification: true` (not
  // `boundary: true`, which is reserved for the red "can't help with that"
  // refusal style) -- this isn't a refusal, just a follow-up question, so it
  // gets its own neutral bubble style and still suppresses the citation row
  // (nothing's actually been asserted about the dashboard yet).
  function scopeClarificationResponse() {
    return {
      text: `Are you asking about the Portfolio (blended across all four products) or a specific product? Reply with a product name (${PRODUCTS.map((p) => p.short).join(", ")}) or say "portfolio."`,
      cites: null,
      clarification: true,
    };
  }
  function scopeClarificationRetryResponse() {
    return {
      text: `Sorry, I didn't catch a scope there. Please reply with one of the product names (${PRODUCTS.map((p) => p.short).join(", ")}) or say "portfolio."`,
      cites: null,
      clarification: true,
    };
  }

  /* ============================================================
     Rendering
     ============================================================ */

  const root = document.getElementById("app");

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function multiSelectHtml(id, label, options, selected, allLabel, emptyMeansAll, splitKey, activeSplitBy, alignSpacer) {
    emptyMeansAll = emptyMeansAll !== false;
    const noneSelected = !selected || selected.length === 0;
    const isAllSelected = emptyMeansAll
      ? noneSelected || selected.length === options.length
      : !!selected && selected.length === options.length;
    const summary = emptyMeansAll
      ? isAllSelected
        ? allLabel || "All"
        : selected.length <= 2
        ? selected.join(", ")
        : `${selected.length} selected`
      : noneSelected
      ? allLabel || "None"
      : selected.length <= 2
      ? selected.join(", ")
      : `${selected.length} selected`;
    const checkedSet = emptyMeansAll ? (isAllSelected ? options : selected) : selected || [];
    // "Split by" checkbox: lets a leader pick which single dimension the
    // charts below split into separate lines/stacks by when Trend Display
    // is Separated. Mutually exclusive across all split-able filters --
    // enforced by [data-splitby]'s change handler setting one shared
    // `filters.splitBy` value, not by anything checkbox-specific here.
    // When this filter isn't itself split-able (e.g. Bundle Products/Bundle
    // Depth aren't one of the FILTER_DIMS) but a sibling filter in the same
    // row is showing a real Split by row above its box, an invisible spacer
    // reusing the identical markup keeps this box's top edge lined up with
    // its neighbors (`.filter-group-body` uses align-items: flex-start, so
    // a missing row above just one box would otherwise sit it higher).
    const splitCheckbox = splitKey
      ? `<label class="split-check" title="Split trend lines by ${label} (when Trend Display is Separated)">
           <input type="checkbox" data-splitby="${splitKey}" ${activeSplitBy === splitKey ? "checked" : ""}/>
           <span>Split by</span>
         </label>`
      : alignSpacer
      ? `<label class="split-check" aria-hidden="true" style="visibility:hidden">
           <input type="checkbox" disabled/>
           <span>Split by</span>
         </label>`
      : "";
    return `
      <div class="filter-ms" data-ms="${id}">
        ${splitCheckbox}
        <button type="button" class="filter-box filter-box-clickable" data-ms-toggle="${id}">
          <span class="filter-box-label">${label}</span>
          <span class="filter-box-value">${summary}</span>
        </button>
        <div class="filter-ms-panel" data-ms-panel="${id}" ${state.msPanelOpen[id] ? "" : "hidden"}>
          ${options
            .map(
              (o) => `
            <label class="filter-ms-opt">
              <input type="checkbox" data-ms-input="${id}" value="${o}" ${checkedSet.includes(o) ? "checked" : ""}/>
              <span>${o}</span>
            </label>`
            )
            .join("")}
        </div>
      </div>`;
  }

  function activeMoreFilterCount(tabId, filters) {
    let n = 0;
    ["country", "companySize", "tenure", "industry"].forEach((d) => {
      if (filters[d] && filters[d].length) n++;
    });
    if (tabId === "portfolio") {
      if (filters.bundleDepth && filters.bundleDepth !== "All") n++;
      if (filters.productView.length !== PRODUCTS.length) n++;
      if (filters.splitBy && filters.splitBy !== "product") n++;
    } else {
      if (filters.bundleProducts && filters.bundleProducts.length) n++;
      // This tab's own Plan/Service Offering filter (2026-07-20), if it has one.
      const productDim = PRODUCT_FILTER_DIMS[tabId];
      if (productDim && filters[productDim.key] && filters[productDim.key].length) n++;
    }
    return n;
  }

  function renderFilterBand(tabId, filters) {
    const isPortfolio = tabId === "portfolio";
    // Split by is fully generalized in the computation/rendering layer (any
    // product tab could enable it). Originally only turned on for Portfolio
    // and QBO Accounting; extended 2026-07-20 to Intuit Expert and Bill Pay
    // too, since each of those tabs now has its own Plan/Service Offering
    // filter that should be split-able -- as a consequence, those two tabs'
    // existing Company Size/Tenure/Industry/Country filters also gain the
    // "Split by" checkbox they were always capable of showing (same
    // plumbing Accounting already exercises), so all four product tabs
    // eligible for their own dimension are now consistent. Payments has no
    // product-specific dimension (it's usage-based, not plan-tiered -- see
    // deck-plan notes) and stays as before.
    const enableSplitBy = isPortfolio || tabId === "accounting" || tabId === "expert" || tabId === "billpay";
    let extra = "";
    if (isPortfolio) {
      extra += `
        <div class="filter-ms">
          <label class="split-check" aria-hidden="true" style="visibility:hidden">
            <input type="checkbox" disabled/>
            <span>Split by</span>
          </label>
          <div class="filter-box">
            <span class="filter-box-label">Bundle Depth</span>
            <select class="filter-box-select" data-filter="bundleDepth">
              ${Object.keys(BUNDLE_DEPTH)
                .map((k) => `<option value="${k}" ${filters.bundleDepth === k ? "selected" : ""}>${k}</option>`)
                .join("")}
            </select>
          </div>
        </div>`;
      extra += multiSelectHtml(
        "productView",
        "Product",
        PRODUCTS.map((p) => p.short),
        filters.productView.map((id) => PRODUCT_BY_ID[id].short),
        "All",
        true,
        "product",
        filters.splitBy
      );
    } else {
      // This tab's own Plan/Service Offering filter (2026-07-20), if it has
      // one -- rendered first, ahead of Bundle Products, since it's the
      // tab's own primary segmentation choice. Same multiSelectHtml call
      // shape as Company Size/Tenure/etc. below, so format/layout/alignment
      // (box width, "Split by" checkbox row, panel behavior) all match
      // exactly with no separate styling.
      const productDim = PRODUCT_FILTER_DIMS[tabId];
      if (productDim) {
        extra += multiSelectHtml(
          productDim.key,
          productDim.label,
          productDim.options.map((o) => o.v),
          filters[productDim.key],
          undefined,
          undefined,
          enableSplitBy ? productDim.key : null,
          filters.splitBy
        );
      }
      const others = PRODUCTS.filter((p) => p.id !== tabId).map((p) => p.short);
      // Bundle Products isn't one of the split-able FILTER_DIMS, but on a
      // tab where Split by is enabled its sibling filters (Plan/Service
      // Offering, Company Size, Tenure, etc.) do grow a real Split by row
      // above their box -- pass alignSpacer so this box gets the same
      // invisible spacer Bundle Depth uses on Portfolio, instead of sitting
      // higher than the rest of the row.
      extra += multiSelectHtml("bundleProducts", "Bundle Products", others, filters.bundleProducts, "None", false, null, null, enableSplitBy);
    }

    const isOpen = !!state.moreFiltersOpenByTab[tabId];
    const moreCount = activeMoreFilterCount(tabId, filters);

    return `
      <div class="filter-band">
        <div class="filter-band-core">
          <div class="filter-box">
            <span class="filter-box-label">Time Range</span>
            <select class="filter-box-select" data-filter="timeRange">
              ${["Past quarter", "YTD", "Past year", "Past 3 years", "Custom range"]
                .map((v) => `<option value="${v}" ${filters.timeRange === v ? "selected" : ""}>${v}</option>`)
                .join("")}
            </select>
          </div>
          ${
            filters.timeRange === "Custom range"
              ? `
          <div class="filter-box">
            <span class="filter-box-label">From</span>
            <div class="filter-box-range-row">
              <select class="filter-box-select" data-filter="customFromMonth">
                ${AVAILABLE_MONTH_NUMS.map((m) => `<option value="${m}" ${String(filters.customFromMonth) === String(m) ? "selected" : ""}>${MONTH_ABBR[m - 1]}</option>`).join("")}
              </select>
              <select class="filter-box-select" data-filter="customFromYear">
                ${AVAILABLE_YEARS.map((y) => `<option value="${y}" ${String(filters.customFromYear) === String(y) ? "selected" : ""}>${y}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="filter-box">
            <span class="filter-box-label">To</span>
            <div class="filter-box-range-row">
              <select class="filter-box-select" data-filter="customToMonth">
                ${AVAILABLE_MONTH_NUMS.map((m) => `<option value="${m}" ${String(filters.customToMonth) === String(m) ? "selected" : ""}>${MONTH_ABBR[m - 1]}</option>`).join("")}
              </select>
              <select class="filter-box-select" data-filter="customToYear">
                ${AVAILABLE_YEARS.map((y) => `<option value="${y}" ${String(filters.customToYear) === String(y) ? "selected" : ""}>${y}</option>`).join("")}
              </select>
            </div>
          </div>`
              : ""
          }
          <div class="filter-box">
            <span class="filter-box-label">View Grain</span>
            <select class="filter-box-select" data-filter="viewGrain">
              ${["Weekly", "Monthly"].map((v) => `<option value="${v}" ${filters.viewGrain === v ? "selected" : ""}>${v}</option>`).join("")}
            </select>
          </div>
          <div class="filter-box">
            <span class="filter-box-label">Trend Display</span>
            <button type="button" class="switch-toggle" data-toggle="trendDisplay" role="switch" aria-checked="${filters.trendDisplay === "Separated" ? "true" : "false"}">
              <span class="switch-toggle-thumb ${filters.trendDisplay === "Separated" ? "is-right" : ""}"></span>
              <span class="switch-toggle-opt ${filters.trendDisplay === "Combined" ? "is-active" : ""}">Combined</span>
              <span class="switch-toggle-opt ${filters.trendDisplay === "Separated" ? "is-active" : ""}">Separated</span>
            </button>
          </div>
          <button type="button" class="more-filters-toggle" data-more-toggle="1">
            More filters${moreCount ? ` <span class="more-count">${moreCount}</span>` : ""} ${isOpen ? "▴" : "▾"}
          </button>
        </div>
        <div class="filter-band-more" ${isOpen ? "" : "hidden"}>
          ${multiSelectHtml("companySize", "Company Size", FILTER_DIMS.companySize.options.map((o) => o.v), filters.companySize, undefined, undefined, enableSplitBy ? "companySize" : null, filters.splitBy)}
          ${multiSelectHtml("industry", "Industry", FILTER_DIMS.industry.options.map((o) => o.v), filters.industry, undefined, undefined, enableSplitBy ? "industry" : null, filters.splitBy)}
          ${multiSelectHtml("country", "Country", FILTER_DIMS.country.options.map((o) => o.v), filters.country, undefined, undefined, enableSplitBy ? "country" : null, filters.splitBy)}
          ${multiSelectHtml("tenure", "Tenure", FILTER_DIMS.tenure.options.map((o) => o.v), filters.tenure, undefined, undefined, enableSplitBy ? "tenure" : null, filters.splitBy)}
          ${extra}
        </div>
      </div>`;
  }

  function renderAiSummary(summary) {
    // 2026-07-19: renamed from "AI Summary" to "Executive Summary" -- the
    // small sparkle icon next to the title now carries the "this is
    // AI-generated" signal that the word "AI" used to carry in the title
    // text itself. Each field's content is now an array of bullet strings
    // (not one clustered sentence) -- see buildAiSummary, whose branches
    // each return whatMoved/driverLine/decision as arrays for exactly this.
    const fields = [
      { eyebrow: "What moved", bullets: summary.whatMoved },
      { eyebrow: "Likely reason", bullets: summary.driverLine },
      { eyebrow: "Suggestion", bullets: summary.decision },
    ];
    return `
      <div class="ai-summary">
        <div class="ai-summary-head">
          <span class="ai-summary-title"><span class="ai-summary-icon" aria-hidden="true" title="AI-generated">✨</span>Executive Summary</span>
        </div>
        <div class="ai-summary-fields">
          ${fields
            .map(
              (f) => `
            <div class="ai-summary-field">
              <div class="ai-summary-eyebrow">${f.eyebrow}</div>
              <ul class="ai-summary-list">
                ${f.bullets.map((b) => `<li>${b}</li>`).join("")}
              </ul>
            </div>`
            )
            .join("")}
        </div>
        <div class="ai-summary-foot">
          <span class="ai-cite">${summary.caveat} ${summary.citation}</span>
          <span class="ai-feedback" data-feedback="ai-summary">
            <button type="button" class="fb-btn" data-fb="up" aria-label="Good">\u{1F44D}</button>
            <button type="button" class="fb-btn" data-fb="down" aria-label="Issue">\u{1F44E}</button>
          </span>
        </div>
      </div>`;
  }

  function kpiCardHtml(card) {
    const isCount = card.kpi.unit === "count";
    const valTxt = isCount ? compactNum(card.current) : pct(card.current);
    const status = kpiStatus(card);
    const reg = METRIC_REGISTRY[card.kpi.id];
    const monthLabel = card.monthKey ? fmtMonthLabel(card.monthKey) : "";
    // ITPM = Index to Prior Month, ITPY = Index to Prior Year: current as a
    // percentage of the prior period's value (100 = flat, >100 = improved,
    // <100 = declined). The parenthetical shows the prior period's value,
    // a direction triangle, and the signed pts movement (current - prior)
    // for an auditable trail without making the reader do the subtraction
    // themselves. ITPM's prior value is real month-bucketed data; ITPY's is
    // implied from the YOY_ASSUMPTION delta (documented above), since the
    // 12-week trend can't be trusted a full year out. itpmIndex >= 100 is
    // mathematically equivalent to movement >= 0 (both just test
    // current >= prior), so the row's color and the triangle's direction
    // always agree.
    const fmtPrior = isCount ? compactNum : pct;
    // The prior-value part stays muted (.kpi-trend-prior); the arrow+delta
    // part gets its own good/risk color so it reads at a glance regardless
    // of the row-level class it's nested inside.
    const trendDetail = (delta, priorVal) => {
      const cls = delta >= 0 ? "good" : "risk";
      return `<span class="kpi-trend-prior">(${fmtPrior(priorVal)}, <span class="kpi-trend-delta ${cls}">${delta >= 0 ? "▲" : "▼"} ${pts(delta)}</span>)</span>`;
    };
    let sub;
    if (card.target != null) {
      // Reuse `status` (kpiStatus(card)) rather than a second threshold
      // computation, so the gap pill, the value's color, and the card's
      // left border never disagree about the same number.
      const gapClass = status;
      sub = `
        <div class="kpi-sub">
          <span class="kpi-target">Target ${pct(card.target)}</span>
          <span class="kpi-gap ${gapClass}">${pts(card.gap)}</span>
        </div>
        <div class="kpi-trend-rows">
          <div class="kpi-trend-row ${card.itpmIndex >= 100 ? "good" : "risk"}"><span class="kpi-trend-tag">ITPM</span>${card.itpmIndex} ${trendDetail(card.movement, card.priorMonthVal)}</div>
          ${card.itpyIndex != null ? `<div class="kpi-trend-row ${card.itpyIndex >= 100 ? "good" : "risk"}"><span class="kpi-trend-tag">ITPY</span>${card.itpyIndex} ${trendDetail(card.itpy, card.priorYearVal)}</div>` : ""}
        </div>`;
    } else {
      sub = `
        <div class="kpi-trend-rows">
          <div class="kpi-trend-row ${card.itpmIndex >= 100 ? "good" : "risk"}"><span class="kpi-trend-tag">ITPM</span>${card.itpmIndex} ${trendDetail(card.movement, card.priorMonthVal)}</div>
        </div>`;
    }
    return `
      <div class="kpi-card status-${status}">
        <div class="kpi-label">
          <span>${card.kpi.name}</span>
          ${reg ? `<span class="kpi-info-icon" data-tip-value="${reg.focus}">ⓘ</span>` : ""}
          ${card.target == null ? '<span class="kpi-no-target">no target set</span>' : ""}
        </div>
        ${reg ? `<div class="kpi-essence">${reg.essence}</div>` : ""}
        ${monthLabel ? `<div class="kpi-month">${monthLabel}</div>` : ""}
        <div class="kpi-value status-${status}">${valTxt}</div>
        ${sub}
      </div>`;
  }

  function chartTitleFor(kpi) {
    return kpi.name;
  }

  // Same hover-definition icon as the KPI cards, reused on every chart-card
  // title below them so "what does this chart mean" is answered the same
  // way everywhere on the page, not just on the cards up top.
  function chartInfoIcon(text) {
    return `<span class="kpi-info-icon" data-tip-value="${text}">ⓘ</span>`;
  }

  // One rate-KPI chart-card (e.g. "Activation Rate vs. Target"). Extracted
  // from the old renderCharts() so a single pillar's chart can be paired
  // directly with its own volume chart in one row, instead of all four rate
  // charts living in one grid and all four volume charts in a separate one.
  function buildRateChartCard(tabId, view, kpiId) {
    const grain = view.filters ? view.filters.viewGrain : "Weekly";
    const k = KPIS.find((x) => x.id === kpiId);
    const card = view.kpiCards.find((c) => c.kpi.id === k.id);
    const status = kpiStatus(card);

    let lineFull = tabId === "portfolio" ? card.series : view.base.series[k.id].slice(view.startIdx);
    let lineSeriesList;
    if (view.lineSeriesList && tabId === "portfolio") {
      lineSeriesList = view.lineSeriesList.map((s, i) => {
        if (s.kind === "product") {
          const pid = s.key;
          const raw = view.perProduct[pid].series[k.id].slice(view.startIdx);
          return { label: s.label, color: COLORS[pid], data: toGrain(view.weeks, raw, grain).values };
        }
        // Segment split (Company Size / Tenure / Industry / Country): pin
        // that one dimension to this line's value and recompute the
        // portfolio blend fresh, same weighting the KPI cards use -- there's
        // no precomputed per-segment series to reuse the way perProduct
        // covers the product-split case.
        const f2 = Object.assign({}, view.filters, { [s.kind]: [s.key] });
        const raw = portfolioBlendedSeriesForFilters(view.included, f2, view.bd, k.id).slice(view.startIdx);
        return { label: s.label, color: DRIVER_TREND_PALETTE[i % DRIVER_TREND_PALETTE.length], data: toGrain(view.weeks, raw, grain).values };
      });
    } else if (view.lineSeriesList && tabId !== "portfolio") {
      lineSeriesList = view.lineSeriesList.map((s, i) => {
        const eff = productSeriesForFilters(tabId, filtersPinned(view.filtersRaw, s.kind, s.key));
        const raw = eff.series[k.id].slice(view.startIdx);
        return { label: s.label, color: DRIVER_TREND_PALETTE[i % DRIVER_TREND_PALETTE.length], data: toGrain(view.weeks, raw, grain).values };
      });
    } else {
      lineSeriesList = [{ label: tabId === "portfolio" ? "Portfolio (blended)" : PRODUCT_BY_ID[tabId].short, color: COLORS.line, data: toGrain(view.weeks, lineFull, grain).values }];
    }
    const labels = toGrain(view.weeks, lineFull, grain).labels;
    const target = card.target;
    const svg = buildRateTargetSVG({ labels, lineSeriesList, target, axisLabel: "Rate (%)", deltaUnit: deltaUnitFor(grain) });
    const reg = METRIC_REGISTRY[k.id];
    return `
      <div class="chart-card">
        <div class="chart-card-title">${chartTitleFor(k)}${reg ? chartInfoIcon(reg.focus) : ""} <span class="status-dot status-${status}"></span></div>
        ${svg}
        <div class="chart-legend">
          ${lineSeriesList.map((s) => `<span><i class="legend-swatch" style="background:${s.color || COLORS.line}"></i>${s.label}</span>`).join("")}
          ${target != null ? `<span><i class="legend-swatch legend-target"></i>Target</span><span><i class="legend-swatch legend-band"></i>On-target zone</span>` : ""}
        </div>
      </div>`;
  }

  // One "Customer counts" volume chart-card. Extracted from the old
  // renderVolumeCharts() for the same pairing reason as buildRateChartCard
  // above. `ctx` carries the per-portfolio-tab precomputed series so this
  // doesn't redo that work once per pillar row.
  function buildVolumeChartCard(tabId, view, m, ctx) {
    const { separated, perVol, seriesByMetric, grain, splitBy, segmentValues, filters } = ctx;
    if (separated) {
      // Stacked bars: each segment's contribution to that period's total, so
      // the same bar shows both the portfolio total (height) and the mix
      // (segment colors) at once. Defaults to one segment per included
      // product; when a segmentation filter's "Split by" checkbox is active
      // instead, each stack segment is one value of that dimension (summed
      // across all included products), matching whatever the paired rate
      // chart above is splitting its lines by.
      let stacks;
      if (splitBy === "product") {
        stacks = view.included.map((pid) => {
          const windowed = perVol[pid][m.id].slice(view.startIdx);
          const g = toGrain(view.weeks, windowed, grain);
          return { label: PRODUCT_BY_ID[pid].short, color: COLORS[pid], values: g.values };
        });
      } else if (tabId === "portfolio") {
        stacks = segmentValues.map((v, i) => {
          const f2 = filtersPinned(filters, splitBy, v);
          const summed = WEEKS.map((w, idx) => view.included.reduce((s, pid) => s + volumeSeriesForFilters(pid, f2)[m.id][idx], 0));
          const g = toGrain(view.weeks, summed.slice(view.startIdx), grain);
          return { label: v, color: DRIVER_TREND_PALETTE[i % DRIVER_TREND_PALETTE.length], values: g.values };
        });
      } else {
        // Product tab, split by a segmentation dimension: one stack segment
        // per value of that dimension, for this one product only.
        stacks = segmentValues.map((v, i) => {
          const full = volumeSeriesForFilters(tabId, filtersPinned(filters, splitBy, v))[m.id];
          const g = toGrain(view.weeks, full.slice(view.startIdx), grain);
          return { label: v, color: DRIVER_TREND_PALETTE[i % DRIVER_TREND_PALETTE.length], values: g.values };
        });
      }
      const labels = toGrain(view.weeks, view.weeks.map(() => 0), grain).labels;
      const svg = buildBarSVG({ labels, stacks, axisLabel: m.axisLabel, deltaUnit: deltaUnitFor(grain) });
      return `
        <div class="chart-card">
          <div class="chart-card-title">${m.label}${m.definition ? chartInfoIcon(m.definition) : ""}</div>
          ${svg}
          <div class="chart-legend">
            ${stacks.map((s) => `<span><i class="legend-swatch" style="background:${s.color}"></i>${s.label}</span>`).join("")}
          </div>
        </div>`;
    }
    const full = seriesByMetric[m.id];
    const windowed = full.slice(view.startIdx);
    const g = toGrain(view.weeks, windowed, grain);
    const svg = buildBarSVG({ labels: g.labels, bars: g.values, axisLabel: m.axisLabel, deltaUnit: deltaUnitFor(grain) });
    return `
      <div class="chart-card">
        <div class="chart-card-title">${m.label}${m.definition ? chartInfoIcon(m.definition) : ""}</div>
        ${svg}
      </div>`;
  }

  // Four paired pillar rows -- each rate KPI chart sits directly next to its
  // own absolute-count companion (Activation | Newly Activated Customers,
  // Core Job Completion | Complete Core Task, Habit Formation | Active 3+
  // Months, Deepening Rate | Deepened 2+ Products), rather than all four
  // rate charts in one block and all four volume charts in a separate one
  // below -- so the ratio and the underlying scale for the same pillar read
  // together. KPIS and VOLUME_METRICS are already defined in the same
  // pillar order, so row i just pairs KPIS[i] with VOLUME_METRICS[i].
  function renderPillars(tabId, view) {
    const filters = view.filters;
    const grain = filters ? filters.viewGrain : "Weekly";
    const isPortfolio = tabId === "portfolio";
    // Portfolio always has an active split concept ("product" by default,
    // or a segmentation dimension); a product tab only has the four
    // segmentation choices and no split at all by default (single bar).
    const splitBy = isPortfolio ? (filters && filters.splitBy ? filters.splitBy : "product") : filters && filters.splitBy;
    const separated = !!(filters && filters.trendDisplay === "Separated" && (isPortfolio || splitBy));
    let seriesByMetric,
      perVol = null,
      segmentValues = null;
    if (isPortfolio) {
      perVol = {};
      view.included.forEach((pid) => {
        perVol[pid] = volumeSeriesForFilters(pid, filters);
      });
      seriesByMetric = {};
      VOLUME_METRICS.forEach((m) => {
        seriesByMetric[m.id] = WEEKS.map((w, i) => view.included.reduce((s, pid) => s + perVol[pid][m.id][i], 0));
      });
      if (separated && splitBy !== "product") {
        const dim = FILTER_DIMS[splitBy];
        const allValues = dim.options.map((o) => o.v);
        const sel = filters[splitBy] || [];
        segmentValues = sel.length === 0 || sel.length === allValues.length ? allValues : sel;
      }
    } else {
      seriesByMetric = volumeSeriesForFilters(tabId, filters);
      if (separated) {
        const dim = dimDef(tabId, splitBy);
        const allValues = dim.options.map((o) => o.v);
        const sel = filters[splitBy] || [];
        segmentValues = sel.length === 0 || sel.length === allValues.length ? allValues : sel;
      }
    }
    const ctx = { separated, perVol, seriesByMetric, grain, splitBy, segmentValues, filters };
    return KPIS.map((k, i) => {
      const rateCard = buildRateChartCard(tabId, view, k.id);
      const volCard = buildVolumeChartCard(tabId, view, VOLUME_METRICS[i], ctx);
      return `<div class="chart-grid">${rateCard}${volCard}</div>`;
    }).join("");
  }

  // Product-tab step trend lines don't carry a per-step color from the data
  // model (there's no natural product-color mapping for a funnel step), so
  // this reuses the same 5-color fallback palette buildRateTargetSVG itself
  // defaults to when a series omits `color` -- keeping the legend swatches
  // and the plotted lines guaranteed to match.
  const DRIVER_TREND_PALETTE = [COLORS.accounting, COLORS.expert, COLORS.payments, COLORS.billpay, COLORS.watch];

  // Fifth pillar row: Workflow Falloff on the left, its absolute-count
  // companion ("customers lost to falloff") on the right -- same pairing
  // idea as renderPillars() above, plus the per-product ranking breakdown
  // underneath. Per 2026-07-20 feedback, the ranking now always renders
  // (previously Separated-only) -- only the two charts above it switch
  // between the blended/combined view and the per-product breakdown.
  const FALLOFF_RATE_DEF =
    "Abandon rate at each workflow step, calculated from the actual counts: customers who entered the step vs. customers who dropped off (see the count chart alongside it) -- tracked over time, each period its own snapshot, not cumulative.";
  const FALLOFF_VOL_DEF = "Count of customers who dropped off the workflow this period -- the actual customer count behind the abandon rate chart alongside it (abandon rate = this count / customers who entered the step).";

  function renderFalloffSection(tabId, view) {
    const grain = view.filters ? view.filters.viewGrain : "Weekly";
    // Shared horizontal step-card box, used for every falloff ranking on
    // both Portfolio and the four product tabs (2026-07-20: hoisted out of
    // the Portfolio-only branch below so product tabs can reuse the exact
    // same card instead of the older full-width .falloff-row list format).
    // frictionLabel is optional -- Portfolio's pooled/segment views span
    // multiple products (a single "friction point" pill wouldn't apply
    // across all of them the same way), so only the product-tab call site
    // passes it.
    const stepCardHtml = (r, i, showProduct, productId, frictionLabel) => `
      <div class="driver-col-step">
        <div class="driver-col-step-head">
          <span class="driver-col-step-rank">#${i + 1}</span>
          <span class="driver-col-step-name">${showProduct ? `${r.product} — ` : ""}${r.step}${falloffReasonNote(productId, r.step) ? chartInfoIcon(falloffReasonNote(productId, r.step)) : ""}${frictionLabel && r.step === frictionLabel ? ' <span class="friction-tag">friction point</span>' : ""}</span>
        </div>
        <div class="driver-col-step-rate ${SIG_CLASS[r.significance]}">${pct(r.abandonRate * 100)}</div>
        <div class="driver-col-step-stats">
          <span class="${r.vsWeek <= 0 ? "good" : "risk"}">wk ${fmtDeltaPts(r.vsWeek)}</span>
          <span class="${r.vsMonth != null && r.vsMonth <= 0 ? "good" : r.vsMonth != null ? "risk" : ""}">mo ${fmtDeltaPts(r.vsMonth)}</span>
          <span>${compactNum(r.abandoned)} lost</span>
        </div>
      </div>`;
    if (tabId === "portfolio") {
      const filters = view.filters;
      const bd = view.bd;
      const separated = filters && filters.trendDisplay === "Separated";
      const splitBy = filters && filters.splitBy ? filters.splitBy : "product";
      const labels = toGrain(view.weeks, view.combinedTrend, grain).labels;

      // Segment values for the Separated + non-product Split by case, same
      // "narrow the filter's own selection, or show every value if it's
      // unfiltered" convention used for the KPI charts.
      let segmentValues = null;
      if (separated && splitBy !== "product") {
        const dim = FILTER_DIMS[splitBy];
        const allValues = dim.options.map((o) => o.v);
        const sel = filters[splitBy] || [];
        segmentValues = sel.length === 0 || sel.length === allValues.length ? allValues : sel;
      }

      let rateCard, volCard;
      if (!separated) {
        // Default: one blended rate line (weighted by funnel volume across
        // each product's own worst-friction step) and one combined count
        // bar -- "is the portfolio's falloff getting better or worse, and
        // how many customers does that represent" -- without asking the
        // reader to compare four lines first. Toggle Trend Display to
        // Separated for the per-product breakdown of both charts.
        const combinedSeries = [{ label: "Portfolio (blended)", color: COLORS.line, data: toGrain(view.weeks, view.combinedTrend, grain).values }];
        const svg = buildRateTargetSVG({ labels, lineSeriesList: combinedSeries, target: null, axisLabel: "Abandon Rate (%)", deltaUnit: deltaUnitFor(grain) });
        rateCard = `<div class="chart-card"><div class="chart-card-title">Workflow Falloff Trend (blended)${chartInfoIcon(FALLOFF_RATE_DEF)}</div>${svg}</div>`;

        const windowedVol = view.falloffVolumeCombined.slice(view.startIdx);
        const gVol = toGrain(view.weeks, windowedVol, grain);
        const volSvg = buildBarSVG({ labels: gVol.labels, bars: gVol.values, axisLabel: "Customers", deltaUnit: deltaUnitFor(grain) });
        volCard = `<div class="chart-card"><div class="chart-card-title">Customers Lost to Workflow Falloff${chartInfoIcon(FALLOFF_VOL_DEF)}</div>${volSvg}</div>`;
      } else if (splitBy === "product") {
        // 2026-07-20 fix: each line is now that product's own overall
        // blended falloff rate (productFalloffTrendFor -- weighted across
        // its own funnel steps), not just its single worst step's trend.
        // Matches every other Split by option's "one blended number per
        // line" convention instead of narrating one specific step.
        const trendSeries = view.included.map((pid) => ({
          label: PRODUCT_BY_ID[pid].short,
          color: COLORS[pid],
          data: toGrain(view.weeks, productFalloffTrendFor(pid, filters, bd), grain).values,
        }));
        const trendSvg = buildRateTargetSVG({ labels, lineSeriesList: trendSeries, target: null, axisLabel: "Abandon Rate (%)", deltaUnit: deltaUnitFor(grain) });
        rateCard = `
          <div class="chart-card">
            <div class="chart-card-title">Workflow Falloff Trend (by product)${chartInfoIcon(FALLOFF_RATE_DEF)}</div>
            ${trendSvg}
            <div class="chart-legend">
              ${trendSeries.map((s) => `<span><i class="legend-swatch" style="background:${s.color}"></i>${s.label}</span>`).join("")}
            </div>
          </div>`;

        const stacks = view.included.map((pid) => {
          const windowed = view.falloffVolumeByProduct[pid].slice(view.startIdx);
          const g = toGrain(view.weeks, windowed, grain);
          return { label: PRODUCT_BY_ID[pid].short, color: COLORS[pid], values: g.values };
        });
        const volLabels = toGrain(view.weeks, view.weeks.map(() => 0), grain).labels;
        const volSvg = buildBarSVG({ labels: volLabels, stacks, axisLabel: "Customers", deltaUnit: deltaUnitFor(grain) });
        volCard = `
          <div class="chart-card">
            <div class="chart-card-title">Customers Lost to Workflow Falloff${chartInfoIcon(FALLOFF_VOL_DEF)}</div>
            ${volSvg}
            <div class="chart-legend">
              ${stacks.map((s) => `<span><i class="legend-swatch" style="background:${s.color}"></i>${s.label}</span>`).join("")}
            </div>
          </div>`;
      } else {
        // Split by a segmentation dimension (Company Size / Tenure /
        // Industry / Country): a segment value cuts across products, so
        // each line/stack here is the same blended-across-products
        // computation the Combined default uses, just recomputed once per
        // segment value with that one dimension pinned (see
        // combinedFalloffTrendFor / falloffVolumeFor above).
        const dimLabel = FILTER_DIMS[splitBy].label;
        const trendSeries = segmentValues.map((v, i) => ({
          label: v,
          color: DRIVER_TREND_PALETTE[i % DRIVER_TREND_PALETTE.length],
          data: toGrain(view.weeks, combinedFalloffTrendFor(view.included, filtersPinned(filters, splitBy, v), bd), grain).values,
        }));
        const trendSvg = buildRateTargetSVG({ labels, lineSeriesList: trendSeries, target: null, axisLabel: "Abandon Rate (%)", deltaUnit: deltaUnitFor(grain) });
        rateCard = `
          <div class="chart-card">
            <div class="chart-card-title">Workflow Falloff Trend (by ${dimLabel})${chartInfoIcon(FALLOFF_RATE_DEF)}</div>
            ${trendSvg}
            <div class="chart-legend">
              ${trendSeries.map((s) => `<span><i class="legend-swatch" style="background:${s.color}"></i>${s.label}</span>`).join("")}
            </div>
          </div>`;

        const stacks = segmentValues.map((v, i) => {
          const windowed = falloffVolumeFor(view.included, filtersPinned(filters, splitBy, v), bd).slice(view.startIdx);
          const g = toGrain(view.weeks, windowed, grain);
          return { label: v, color: DRIVER_TREND_PALETTE[i % DRIVER_TREND_PALETTE.length], values: g.values };
        });
        const volLabels = toGrain(view.weeks, view.weeks.map(() => 0), grain).labels;
        const volSvg = buildBarSVG({ labels: volLabels, stacks, axisLabel: "Customers", deltaUnit: deltaUnitFor(grain) });
        volCard = `
          <div class="chart-card">
            <div class="chart-card-title">Customers Lost to Workflow Falloff${chartInfoIcon(FALLOFF_VOL_DEF)}</div>
            ${volSvg}
            <div class="chart-legend">
              ${stacks.map((s) => `<span><i class="legend-swatch" style="background:${s.color}"></i>${s.label}</span>`).join("")}
            </div>
          </div>`;
      }

      let rankingHtml;
      if (!separated) {
        // Combined: pool every funnel step from every included product into
        // one list and rank by abandon rate, regardless of which product it
        // came from -- "what are the portfolio's worst 4 falloff reasons,"
        // not "here's each product's own breakdown." Flip to Separated for
        // the per-product grouping below.
        const pooled = view.driverColumns
          .flatMap((col) => col.rows.map((r) => ({ ...r, product: col.product, productId: col.productId })))
          .sort((a, b) => b.abandonRate - a.abandonRate)
          .slice(0, 4);
        rankingHtml = `
          <div class="driver-rank-sub">Top 4 falloff reasons across the portfolio, pooled across all products.</div>
          <div class="driver-col-grid">
            ${pooled.map((r, i) => stepCardHtml(r, i, true, r.productId)).join("")}
          </div>`;
      } else if (splitBy === "product") {
        rankingHtml = `
          <div class="driver-rank-sub">Falloff reasons ranked within each product — significance, movement, and customer impact.</div>
          <div class="driver-col-grid">
            ${view.driverColumns
              .map(
                (col) => `
              <div class="driver-col">
                <div class="driver-col-title" style="border-top-color:${COLORS[col.productId]}">${col.product}</div>
                ${col.rows.map((r, i) => stepCardHtml(r, i, false, col.productId)).join("")}
              </div>`
              )
              .join("")}
          </div>`;
      } else {
        // Split by a segmentation dimension: one column per segment value
        // instead of per product. A funnel step still belongs to a product,
        // not a segment, so each column pools the top 4 steps across all
        // included products (same pooling pooledFalloffSteps also does for
        // the Combined view above), just with that one segment value
        // pinned -- "what are this segment's worst 4 falloff reasons,"
        // product name shown on each row since the column itself no longer
        // identifies one.
        rankingHtml = `
          <div class="driver-rank-sub">Top 4 falloff reasons within each ${FILTER_DIMS[splitBy].label} value, pooled across included products.</div>
          <div class="driver-col-grid">
            ${segmentValues
              .map((v, i) => {
                const rows = pooledFalloffSteps(view.included, filtersPinned(filters, splitBy, v), bd).slice(0, 4);
                return `
              <div class="driver-col">
                <div class="driver-col-title" style="border-top-color:${DRIVER_TREND_PALETTE[i % DRIVER_TREND_PALETTE.length]}">${v}</div>
                ${rows.map((r, ri) => stepCardHtml(r, ri, true, r.productId)).join("")}
              </div>`;
              })
              .join("")}
          </div>`;
      }

      return `
        <div class="driver-card">
          <div class="chart-grid">${rateCard}${volCard}</div>
          ${rankingHtml}
        </div>`;
    }
    // Product tab — keep natural workflow (funnel) order rather than
    // re-sorting by magnitude, so the sequence of the customer job is
    // legible; the known friction step is called out by color, not by
    // re-ranking. That's the default (no split). Per 2026-07-19, on a
    // supported product tab (QBO Accounting) with Split by active, this
    // trades step-level detail for segment comparability -- the same trade
    // Portfolio's Split by makes trading product-level detail -- showing
    // one line/stack per segment value instead.
    const filters = view.filters;
    const splitBy = filters && filters.trendDisplay === "Separated" ? filters.splitBy : null;
    let segmentValues = null;
    if (splitBy) {
      const dim = dimDef(tabId, splitBy);
      const allValues = dim.options.map((o) => o.v);
      const sel = filters[splitBy] || [];
      segmentValues = sel.length === 0 || sel.length === allValues.length ? allValues : sel;
    }

    const steps = view.falloff;

    let rateCard, volCard, listHtml;
    if (!splitBy) {
      const trendLabels = toGrain(view.weeks, steps[0].trend, grain).labels;
      const trendSeries = steps.map((s, i) => ({
        label: s.step,
        color: DRIVER_TREND_PALETTE[i % DRIVER_TREND_PALETTE.length],
        data: toGrain(view.weeks, s.trend, grain).values,
      }));
      const trendSvg = buildRateTargetSVG({ labels: trendLabels, lineSeriesList: trendSeries, target: null, axisLabel: "Abandon Rate (%)", deltaUnit: deltaUnitFor(grain) });
      rateCard = `
        <div class="chart-card">
          <div class="chart-card-title">Workflow Falloff Trend — ${WORKFLOW_LABEL[tabId]}${chartInfoIcon(FALLOFF_RATE_DEF)}</div>
          ${trendSvg}
          <div class="chart-legend">
            ${trendSeries.map((s) => `<span><i class="legend-swatch" style="background:${s.color}"></i>${s.label}</span>`).join("")}
          </div>
        </div>`;

      const windowedVol = view.falloffVolumeFull.slice(view.startIdx);
      const gVol = toGrain(view.weeks, windowedVol, grain);
      const volSvg = buildBarSVG({ labels: gVol.labels, bars: gVol.values, axisLabel: "Customers", deltaUnit: deltaUnitFor(grain) });
      volCard = `
        <div class="chart-card">
          <div class="chart-card-title">Customers Lost to Workflow Falloff${chartInfoIcon(FALLOFF_VOL_DEF)}</div>
          ${volSvg}
        </div>`;

      // 2026-07-20: rearranged from a full-width row list (with its own
      // magnitude bar) into the same horizontal step-card box grid
      // Portfolio's Combined-toggle ranking uses (stepCardHtml/.driver-col-
      // grid), for a consistent ranking format across the whole dashboard.
      // Still kept in natural workflow order (not re-sorted by magnitude --
      // see note above), and the friction step still gets its "friction
      // point" pill; only the row-vs-box presentation changed.
      listHtml = `
        <div class="driver-rank-sub">${WORKFLOW_LABEL[tabId]} falloff steps, in workflow order.</div>
        <div class="driver-col-grid">
          ${steps.map((s, i) => stepCardHtml(s, i, false, tabId, FRICTION_LABEL[tabId])).join("")}
        </div>`;
    } else {
      const dimLabel = dimDef(tabId, splitBy).label;
      const trendLabels = toGrain(view.weeks, steps[0].trend, grain).labels;
      const trendSeries = segmentValues.map((v, i) => ({
        label: v,
        color: DRIVER_TREND_PALETTE[i % DRIVER_TREND_PALETTE.length],
        data: toGrain(view.weeks, worstStepTrendForProduct(tabId, filtersPinned(filters, splitBy, v)), grain).values,
      }));
      const trendSvg = buildRateTargetSVG({ labels: trendLabels, lineSeriesList: trendSeries, target: null, axisLabel: "Abandon Rate (%)", deltaUnit: deltaUnitFor(grain) });
      rateCard = `
        <div class="chart-card">
          <div class="chart-card-title">Workflow Falloff Trend (by ${dimLabel})${chartInfoIcon(FALLOFF_RATE_DEF)}</div>
          ${trendSvg}
          <div class="chart-legend">
            ${trendSeries.map((s) => `<span><i class="legend-swatch" style="background:${s.color}"></i>${s.label}</span>`).join("")}
          </div>
        </div>`;

      const stacks = segmentValues.map((v, i) => {
        const windowed = falloffVolumeForProduct(tabId, filtersPinned(filters, splitBy, v)).slice(view.startIdx);
        const g = toGrain(view.weeks, windowed, grain);
        return { label: v, color: DRIVER_TREND_PALETTE[i % DRIVER_TREND_PALETTE.length], values: g.values };
      });
      const volLabels = toGrain(view.weeks, view.weeks.map(() => 0), grain).labels;
      const volSvg = buildBarSVG({ labels: volLabels, stacks, axisLabel: "Customers", deltaUnit: deltaUnitFor(grain) });
      volCard = `
        <div class="chart-card">
          <div class="chart-card-title">Customers Lost to Workflow Falloff${chartInfoIcon(FALLOFF_VOL_DEF)}</div>
          ${volSvg}
          <div class="chart-legend">
            ${stacks.map((s) => `<span><i class="legend-swatch" style="background:${s.color}"></i>${s.label}</span>`).join("")}
          </div>
        </div>`;

      // 2026-07-20: same box-card format as the unsplit case above and as
      // Portfolio's own per-segment columns -- each segment's steps are now
      // stacked .driver-col-step boxes directly inside its .driver-col
      // (matching Portfolio's product-split pattern), not a nested
      // .falloff-list of full-width rows.
      listHtml = `
        <div class="driver-rank-sub">Falloff steps for ${WORKFLOW_LABEL[tabId]}, in workflow order within each ${dimLabel} value.</div>
        <div class="driver-col-grid">
          ${segmentValues
            .map((v, i) => {
              const segSteps = falloffStepsForProduct(tabId, filtersPinned(filters, splitBy, v));
              return `
            <div class="driver-col">
              <div class="driver-col-title" style="border-top-color:${DRIVER_TREND_PALETTE[i % DRIVER_TREND_PALETTE.length]}">${v}</div>
              ${segSteps.map((s, si) => stepCardHtml(s, si, false, tabId, FRICTION_LABEL[tabId])).join("")}
            </div>`;
            })
            .join("")}
        </div>`;
    }

    return `
      <div class="driver-card">
        <div class="chart-grid">${rateCard}${volCard}</div>
        ${listHtml}
      </div>`;
  }

  function suggestedQuestions(tabId) {
    if (tabId === "portfolio")
      return ["What changed across the portfolio this month?", "Which product needs the most attention?", "What's our Q3 revenue guidance?"];
    if (tabId === "billpay") return ["Why did Bill Pay habit formation miss target in June?", "What is driving vendor verification falloff?"];
    if (tabId === "accounting") return ["Why did bank connection falloff increase?", "How is QBO Accounting activation trending vs target?"];
    if (tabId === "expert") return ["What is driving the appointment scheduling drop?", "How is core job completion trending?"];
    if (tabId === "payments") return ["Why is first paid invoice conversion low?", "What's our customer's account number?"];
    return [];
  }

  function seedChat(tabId, view) {
    const q = tabId === "billpay" ? "Why did Bill Pay habit formation miss target in June?" : suggestedQuestions(tabId)[0];
    const a = answerQuestion(tabId, view, q);
    return [{ role: "user", text: q }, { role: "ai", text: a.text, cites: a.cites, boundary: a.boundary }];
  }

  function renderChat(tabId, view) {
    if (!state.chatByTab[tabId]) state.chatByTab[tabId] = seedChat(tabId, view);
    // 2026-07-19: while a scope clarification is open on THIS tab's thread,
    // swap the usual suggested-question chips for one-click scope answers
    // (Portfolio + each product) -- so resolving "portfolio or which
    // product?" doesn't require typing, just clicking, the same way a
    // suggested question does.
    const pendingHere = state.pendingClarification && state.pendingClarification.tabId === tabId;
    const chips = pendingHere ? ["Portfolio", ...PRODUCTS.map((p) => p.short)] : suggestedQuestions(tabId);
    const messages = state.chatByTab[tabId];
    const isOpen = !!state.chatOpenByTab[tabId];
    return `
      <div class="ai-chat-card">
        <button type="button" class="ai-chat-toggle" data-chat-toggle="1">
          <span class="chart-card-title">Ask the Dashboard — Governed AI Q&amp;A</span>
          <span class="ai-chat-toggle-hint">${isOpen ? "Hide ▴" : `${messages.length / 2} exchange${messages.length > 2 ? "s" : ""} · Open ▾`}</span>
        </button>
        <div class="ai-chat-body" ${isOpen ? "" : "hidden"}>
          <div class="chip-row">
            ${chips.map((c) => `<button type="button" class="chip${pendingHere ? " chip-scope" : ""}" data-chip="${encodeURIComponent(c)}">${c}</button>`).join("")}
          </div>
          <div class="chat-thread" id="chat-thread">
            ${messages
              .map(
                (m, i) => `
              <div class="chat-msg chat-${m.role}">
                <div class="chat-bubble ${m.boundary ? "chat-boundary" : ""} ${m.clarification ? "chat-clarify" : ""}">${m.text}</div>
                ${m.role === "ai" && !m.boundary && !m.clarification ? `<div class="chat-cite">${m.cites || ""}</div>` : ""}
                ${m.role === "ai" ? `<div class="chat-fb" data-fb-idx="${i}"><button type="button" class="fb-btn" data-fb="up">\u{1F44D}</button><button type="button" class="fb-btn" data-fb="down">\u{1F44E}</button></div>` : ""}
              </div>`
              )
              .join("")}
          </div>
          <form class="chat-input-row" id="chat-form">
            <input type="text" id="chat-input" placeholder="Ask about activation, job completion, habit formation, deepening, or falloff…" autocomplete="off"/>
            <button type="submit" class="chat-send">Ask</button>
          </form>
        </div>
      </div>`;
  }

  function renderTrustFooter() {
    return `
      <div class="trust-footer">
        <span>✓ Certified metric layer</span>
        <span>✓ Superglue refresh: passed</span>
        <span>✓ AI reconciliation: 100%</span>
        <span>Validation run: ${REFRESH_TS}</span>
      </div>`;
  }

  function renderTrustBadgePanel() {
    return `
      <div class="trust-badge-panel" id="trust-badge-panel" hidden>
        <div class="trust-badge-title">Validation passed</div>
        <div class="trust-badge-row">Data refresh: <b>passed</b></div>
        <div class="trust-badge-row">Metric definitions: <b>no unexpected changes</b></div>
        <div class="trust-badge-row">Dashboard version: <b>v1.4 unchanged</b></div>
        <div class="trust-badge-row">AI tools: <b>approved version</b></div>
        <div class="trust-badge-row">Layout check: <b>passed</b></div>
        <div class="trust-badge-row muted">Refreshed ${REFRESH_TS}</div>
      </div>`;
  }

  // Clickable, not just hover-on-a-tooltip -- safe to open and read out loud
  // during a live screen-share where hover states don't always translate.
  function renderDataGuidePanel(tabId) {
    const isOpen = state.dataGuideOpen;
    let body;
    if (tabId === "portfolio") {
      body = KPIS.map((k) => {
        const reg = METRIC_REGISTRY[k.id];
        return `
          <div class="data-guide-row">
            <div class="data-guide-row-head">
              <span class="data-guide-kpi-name">${k.name}</span>
              <span class="essence-tag">${reg.essence}</span>
            </div>
            <div class="data-guide-formula-detail">${reg.focus}</div>
            <div class="data-guide-formula-detail muted">Portfolio value is a weighted average of each product's rate below, weighted by active-engaged customers (not a pooled numerator/denominator sum).</div>
          </div>`;
      }).join("");
    } else {
      body = KPIS.map((k) => {
        const reg = METRIC_REGISTRY[k.id];
        const f = METRIC_FORMULAS[tabId][k.id];
        return `
          <div class="data-guide-row">
            <div class="data-guide-row-head">
              <span class="data-guide-kpi-name">${k.name}</span>
              <span class="essence-tag">${reg.essence}</span>
              <span class="source-badge source-${f.source}">${SOURCE_LABEL[f.source]}</span>
            </div>
            <div class="data-guide-formula-name">${f.name}</div>
            <div class="data-guide-formula-detail">Numerator: ${f.numerator}</div>
            <div class="data-guide-formula-detail">Denominator: ${f.denominator}</div>
            <div class="data-guide-formula-detail muted">Owner: ${f.owner}${f.note ? ` · ${f.note}` : ""}</div>
          </div>`;
      }).join("");
    }
    return `
      <div class="data-guide-panel" id="data-guide-panel" ${isOpen ? "" : "hidden"}>
        <div class="data-guide-title">Metric Definitions — ${tabId === "portfolio" ? "Portfolio" : PRODUCT_BY_ID[tabId].short}</div>
        ${body}
      </div>`;
  }

  function renderApp() {
    const tabId = state.tab;
    const filters = state.filtersByTab[tabId];
    const view =
      tabId === "portfolio" ? computePortfolioTab(filters) : computeProductTab(tabId, filters);
    view.filters = filters;
    view.filtersRaw = filters;

    const summary = buildAiSummary(tabId, view);

    root.innerHTML = `
      <header class="app-header">
        <div class="header-left">
          <img class="header-logo" src="intuit-logo.svg" alt="Intuit" />
          <h1 class="app-title">Product Engagement Dashboard</h1>
        </div>
        <div class="header-right">
          <div class="refresh-ts">Data refreshed ${REFRESH_TS}</div>
          <div class="header-right-btns">
            <button type="button" class="data-guide-btn" id="data-guide-btn">Data Guide</button>
            <button type="button" class="trust-badge" id="trust-badge-btn">
              <span class="trust-dot"></span> Validated
            </button>
          </div>
          ${renderDataGuidePanel(tabId)}
          ${renderTrustBadgePanel()}
        </div>
      </header>

      <nav class="tab-strip">
        ${TABS.map((t) => `<button type="button" class="tab-btn ${t.id === tabId ? "active" : ""}" data-tab="${t.id}">${t.label}</button>`).join("")}
      </nav>

      <main class="tab-content">
        ${renderFilterBand(tabId, filters)}
        ${renderAiSummary(summary)}
        <div class="kpi-row">${view.kpiCards.map((c) => kpiCardHtml(c)).join("")}</div>
        ${renderPillars(tabId, view)}
        ${renderFalloffSection(tabId, view)}
        ${renderChat(tabId, view)}
      </main>

      ${renderTrustFooter()}
    `;

    wireEvents(tabId, filters, view);
  }

  /* ---------------- event wiring ---------------- */

  function wireEvents(tabId, filters, view) {
    root.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.tab = btn.getAttribute("data-tab");
        renderApp();
      });
    });

    root.querySelectorAll("[data-filter]").forEach((sel) => {
      sel.addEventListener("change", () => {
        filters[sel.getAttribute("data-filter")] = sel.value;
        renderApp();
      });
    });

    root.querySelectorAll("[data-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-toggle");
        filters[key] = filters[key] === "Combined" ? "Separated" : "Combined";
        renderApp();
      });
    });

    root.querySelectorAll("[data-ms-toggle]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-ms-toggle");
        const panel = root.querySelector(`[data-ms-panel="${id}"]`);
        const wasHidden = panel.hasAttribute("hidden");
        root.querySelectorAll(".filter-ms-panel").forEach((p) => p.setAttribute("hidden", ""));
        Object.keys(state.msPanelOpen).forEach((k) => (state.msPanelOpen[k] = false));
        if (wasHidden) {
          panel.removeAttribute("hidden");
          state.msPanelOpen[id] = true;
        }
      });
    });
    document.addEventListener("click", () => {
      root.querySelectorAll(".filter-ms-panel").forEach((p) => p.setAttribute("hidden", ""));
      Object.keys(state.msPanelOpen).forEach((k) => (state.msPanelOpen[k] = false));
    });
    // A checkbox click fires a native "click" (bubbles to document, before
    // "change") in addition to the "change" event the input handler below
    // listens for -- without stopping that bubble, the outside-click
    // listener above would close the panel on every checkbox click, right
    // before the change handler even runs.
    root.querySelectorAll(".filter-ms-panel").forEach((panel) => {
      panel.addEventListener("click", (e) => e.stopPropagation());
    });

    // "Split by" checkboxes are mutually exclusive: checking one just sets
    // the single shared filters.splitBy value, so re-rendering naturally
    // leaves every other checkbox unchecked (only the one matching
    // filters.splitBy renders as checked) without any explicit uncheck
    // logic here. Unchecking the active one falls back to Portfolio's
    // default ("product," splitting by product) or, on a product tab
    // (which has no product dimension of its own to fall back to), to null
    // -- no split, single line/bar.
    root.querySelectorAll("[data-splitby]").forEach((input) => {
      input.addEventListener("change", () => {
        const key = input.getAttribute("data-splitby");
        filters.splitBy = input.checked ? key : tabId === "portfolio" ? "product" : null;
        renderApp();
      });
    });

    root.querySelectorAll("[data-ms-input]").forEach((input) => {
      input.addEventListener("change", () => {
        const id = input.getAttribute("data-ms-input");
        const panel = root.querySelector(`[data-ms-panel="${id}"]`);
        const checked = Array.from(panel.querySelectorAll("input:checked")).map((i) => i.value);
        const all = Array.from(panel.querySelectorAll("input")).map((i) => i.value);
        if (id === "productView") {
          const values = checked.length === 0 ? all : checked;
          filters.productView = values.map((short) => PRODUCTS.find((p) => p.short === short).id);
        } else if (id === "bundleProducts") {
          // empty = no bundle requirement; fully checked = must have all other products bundled
          filters.bundleProducts = checked;
        } else {
          filters[id] = checked.length === all.length ? [] : checked;
        }
        renderApp();
      });
    });

    const moreToggle = root.querySelector("[data-more-toggle]");
    if (moreToggle) {
      moreToggle.addEventListener("click", () => {
        state.moreFiltersOpenByTab[tabId] = !state.moreFiltersOpenByTab[tabId];
        renderApp();
      });
    }
    const chatToggle = root.querySelector("[data-chat-toggle]");
    if (chatToggle) {
      chatToggle.addEventListener("click", () => {
        state.chatOpenByTab[tabId] = !state.chatOpenByTab[tabId];
        renderApp();
      });
    }

    const trustBtn = root.querySelector("#trust-badge-btn");
    const trustPanel = root.querySelector("#trust-badge-panel");
    if (trustBtn) {
      trustBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        trustPanel.toggleAttribute("hidden");
      });
    }

    const dataGuideBtn = root.querySelector("#data-guide-btn");
    if (dataGuideBtn) {
      dataGuideBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        state.dataGuideOpen = !state.dataGuideOpen;
        renderApp();
      });
    }

    root.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const q = decodeURIComponent(chip.getAttribute("data-chip"));
        askAndRender(tabId, view, q);
      });
    });

    const form = root.querySelector("#chat-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = root.querySelector("#chat-input");
        const q = input.value.trim();
        if (!q) return;
        input.value = "";
        askAndRender(tabId, view, q);
      });
    }

    root.querySelectorAll("[data-fb-idx] .fb-btn, .ai-feedback .fb-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.parentElement.querySelectorAll(".fb-btn").forEach((b) => b.classList.remove("fb-active"));
        btn.classList.add("fb-active");
      });
    });
  }

  function scrollChatThread() {
    const thread = document.getElementById("chat-thread");
    if (thread) thread.scrollTop = thread.scrollHeight;
  }

  // Compute a fresh view for a resolved scope ("portfolio" or a product id),
  // the same way the mentioned-product switch below does -- shared so the
  // clarification-resolution path and the direct-mention path build the
  // view identically.
  function viewForScope(scope) {
    const filters = state.filtersByTab[scope];
    return scope === "portfolio" ? computePortfolioTab(filters) : computeProductTab(scope, filters);
  }

  function scopeLabelFor(scope) {
    return scope === "portfolio" ? "Portfolio" : PRODUCT_BY_ID[scope].short;
  }

  function pushExchange(chatTabId, userText, aiMsg) {
    if (!state.chatByTab[chatTabId]) state.chatByTab[chatTabId] = seedChat(chatTabId, viewForScope(chatTabId));
    state.chatByTab[chatTabId].push({ role: "user", text: userText });
    state.chatByTab[chatTabId].push({ role: "ai", text: aiMsg.text, cites: aiMsg.cites, boundary: aiMsg.boundary, clarification: aiMsg.clarification });
  }

  function askAndRender(tabId, view, question) {
    // --- Resolve a pending "portfolio or which product?" clarification, if
    // one is currently open (2026-07-19). This runs before any other
    // routing, since this message is a reply to the assistant's own
    // question, not a fresh one on its own. ---
    if (state.pendingClarification) {
      const pc = state.pendingClarification;
      const scope = resolveScopeReply(question);
      if (scope) {
        // Resolved -- switch to that scope's tab (same "what's cited must
        // be what's on screen" rule the direct-mention path already
        // follows) and answer the ORIGINAL question, not this reply.
        state.pendingClarification = null;
        state.tab = scope;
        const answerView = viewForScope(scope);
        const a = answerQuestion(scope, answerView, pc.originalQuestion);
        const switchNote = scope !== pc.tabId ? `Switched to the ${scopeLabelFor(scope)} tab to answer this. ` : "";
        pushExchange(scope, question, Object.assign({}, a, { text: switchNote + a.text }));
        renderApp();
        scrollChatThread();
        return;
      }
      // Didn't resolve to a scope. Distinguish "unclear attempt at
      // answering the clarification" from "the user moved on and asked
      // something else entirely" -- a reasonably long message that itself
      // names a different recognized topic is treated as a new question
      // (falls through below); anything shorter/unrecognized is treated as
      // a failed clarification attempt.
      const looksLikeNewQuestion = detectMetricTopic(question.toLowerCase()) != null && question.trim().split(/\s+/).length > 4;
      if (!looksLikeNewQuestion) {
        if (pc.attempts < 1) {
          state.pendingClarification = Object.assign({}, pc, { attempts: pc.attempts + 1 });
          pushExchange(pc.tabId, question, scopeClarificationRetryResponse());
        } else {
          // Gave it two tries -- fall back to the tab that was open when
          // the original question was asked, same as the pre-2026-07-19
          // default (silent open-tab fallback), just now explicitly named
          // instead of silent.
          state.pendingClarification = null;
          const a = answerQuestion(pc.tabId, viewForScope(pc.tabId), pc.originalQuestion);
          const fallbackNote = `Defaulting to the ${scopeLabelFor(pc.tabId)} view since I couldn't confirm a scope. `;
          pushExchange(pc.tabId, question, Object.assign({}, a, { text: fallbackNote + a.text }));
        }
        renderApp();
        scrollChatThread();
        return;
      }
      // Falls through: treat as a fresh question, abandoning the old
      // clarification silently (the user moved on).
      state.pendingClarification = null;
    }

    // --- Out-of-scope check, ahead of everything else below (mirrors
    // answerQuestion's own first check -- needed here too so an
    // out-of-scope question never gets mistaken for a scope-ambiguous
    // metric question). ---
    const qLower = question.toLowerCase();
    if (OUT_OF_SCOPE_KEYWORDS.some((kw) => qLower.includes(kw))) {
      pushExchange(tabId, question, { text: OUT_OF_SCOPE_RESPONSE, cites: null, boundary: true });
      renderApp();
      scrollChatThread();
      return;
    }

    // If the question names a specific product that isn't the open tab,
    // switch to that product's tab and answer from its own (freshly
    // computed) view -- so the visible KPI cards/falloff table always match
    // what the AI just cited, instead of answering off-screen data.
    const mentioned = detectMentionedProduct(question);

    // 2026-07-19: a recognized metric/topic question that names neither a
    // specific product nor "portfolio" explicitly gets a scope
    // clarification instead of silently answering for whatever tab is
    // open -- see detectPortfolioMention/resolveScopeReply above.
    const topic = detectMetricTopic(qLower);
    const scopeAlreadyNamed = !!mentioned || detectPortfolioMention(question);
    if (topic && !scopeAlreadyNamed) {
      state.pendingClarification = { originalQuestion: question, tabId, attempts: 0 };
      pushExchange(tabId, question, scopeClarificationResponse());
      renderApp();
      scrollChatThread();
      return;
    }

    let answerTabId = tabId;
    let answerView = view;
    let switchNote = "";
    if (mentioned && mentioned !== tabId) {
      answerTabId = mentioned;
      state.tab = mentioned;
      const mentionedFilters = state.filtersByTab[mentioned];
      answerView = computeProductTab(mentioned, mentionedFilters);
      switchNote = `Switched to the ${PRODUCT_BY_ID[mentioned].short} tab to answer this -- you were viewing ${tabId === "portfolio" ? "Portfolio" : PRODUCT_BY_ID[tabId].short}. `;
    }
    const a = answerQuestion(answerTabId, answerView, question);
    pushExchange(answerTabId, question, Object.assign({}, a, { text: switchNote + a.text }));
    renderApp();
    scrollChatThread();
  }

  /* ---------------- chart hover tooltip ---------------- */
  // A single shared tooltip element + one delegated mousemove/mouseout
  // listener pair on `document`, wired once here (NOT inside renderApp/
  // wireEvents, which re-run on every re-render and would otherwise stack
  // up a fresh listener each time). Every bar segment and line point
  // carries data-tip-label/data-tip-value attributes (see buildBarSVG /
  // buildRateTargetSVG) instead of a native <title>, so hover feedback is
  // instant and consistently styled, closer to a BI tool like QuickSight
  // than the browser's built-in (slow, unstyled) title tooltip.
  function initChartTooltip() {
    const tip = document.createElement("div");
    tip.className = "chart-tooltip";
    tip.hidden = true;
    document.body.appendChild(tip);

    function place(x, y) {
      const vw = window.innerWidth || 1200,
        vh = window.innerHeight || 800;
      const w = tip.offsetWidth || 140,
        h = tip.offsetHeight || 40;
      let left = x + 14,
        top = y + 14;
      if (left + w > vw - 8) left = x - w - 14;
      if (top + h > vh - 8) top = y - h - 14;
      tip.style.left = `${Math.max(4, left)}px`;
      tip.style.top = `${Math.max(4, top)}px`;
    }

    document.addEventListener("mousemove", (e) => {
      const target = e.target.closest && e.target.closest("[data-tip-value]");
      if (!target) {
        tip.hidden = true;
        return;
      }
      const label = target.getAttribute("data-tip-label");
      const value = target.getAttribute("data-tip-value");
      const delta = target.getAttribute("data-tip-delta");
      tip.innerHTML = `${label ? `<div class="chart-tooltip-label">${label}</div>` : ""}<div class="chart-tooltip-value">${value}</div>${
        delta ? `<div class="chart-tooltip-delta ${delta.startsWith("▲") ? "good" : "risk"}">${delta}</div>` : ""
      }`;
      tip.hidden = false;
      place(e.clientX, e.clientY);
    });
    document.addEventListener(
      "mouseout",
      (e) => {
        if (!e.relatedTarget || !(e.relatedTarget.closest && e.relatedTarget.closest("[data-tip-value]"))) tip.hidden = true;
      },
      true
    );
  }

  renderApp();
  initChartTooltip();
})();
