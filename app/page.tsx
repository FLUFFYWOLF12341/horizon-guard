"use client";

import { useEffect, useMemo, useState } from "react";

type Scenario = {
  id: string;
  label: string;
  protocol: string;
  action: string;
  asset: string;
  amount: string;
  risk: number;
  verdict: string;
  summary: string;
  factors: Array<{ name: string; detail: string; level: "high" | "medium" | "low" }>;
  simulation: Array<{ time: string; value: string; note: string; tone: "safe" | "warn" | "danger" }>;
  safeAction: string;
};

type ChainStatus = {
  connected: boolean;
  chainId?: number;
  blockNumber?: number;
  gasPriceGwei?: number;
};

type BrowserWallet = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown>[] }) => Promise<unknown>;
};

type AddressAnalysis = {
  address: string;
  blockNumber: number;
  isContract: boolean;
  codeSize: number;
  isProxy: boolean;
  implementation: string | null;
  balanceHSK: number;
  callType: string;
  unlimitedApproval: boolean;
  risk: number;
  verdict: "HIGH" | "MEDIUM" | "LOW";
  factors: string[];
  explorerUrl: string;
};

const VERIFIED_REGISTRY_ADDRESS = "0xc0043c0ecdc68401366d92bb46fd5721a4096153";

const scenarios: Scenario[] = [
  {
    id: "approval",
    label: "Unlimited approval",
    protocol: "Unknown Yield Vault",
    action: "Approve token spending",
    asset: "USDT",
    amount: "Unlimited",
    risk: 86,
    verdict: "High risk · Do not sign yet",
    summary:
      "This contract could move every USDT in your wallet, not just the 500 USDT you plan to deposit. The contract is new and its owner can still change critical settings.",
    factors: [
      { name: "Unlimited allowance", detail: "Requested limit is far above the intended deposit.", level: "high" },
      { name: "Upgradeable contract", detail: "The owner can replace important contract logic.", level: "high" },
      { name: "Limited history", detail: "Only 19 days of activity and few independent users.", level: "medium" },
    ],
    simulation: [
      { time: "Now", value: "$500.00", note: "Planned deposit", tone: "safe" },
      { time: "+24h", value: "$491.20", note: "Normal market movement", tone: "warn" },
      { time: "+72h", value: "$0–$487", note: "Full wallet balance remains exposed", tone: "danger" },
    ],
    safeAction: "Limit approval to 500 USDT",
  },
  {
    id: "rwa",
    label: "RWA pool deposit",
    protocol: "Tokyo Treasury Pool",
    action: "Deposit into tokenized T-bills",
    asset: "USDC",
    amount: "1,000 USDC",
    risk: 44,
    verdict: "Medium risk · Review restrictions",
    summary:
      "The pool has a stronger operating history, but redemptions may take up to three business days. Your wallet also needs to meet the pool's allowlist requirements.",
    factors: [
      { name: "Redemption delay", detail: "Funds may not be available immediately.", level: "medium" },
      { name: "Allowlist required", detail: "Access can depend on eligibility checks.", level: "medium" },
      { name: "Capped approval", detail: "The contract asks only for the deposit amount.", level: "low" },
    ],
    simulation: [
      { time: "Now", value: "$1,000.00", note: "Deposit submitted", tone: "safe" },
      { time: "+24h", value: "$1,000.11", note: "Estimated yield accrual", tone: "safe" },
      { time: "+72h", value: "$1,000.34", note: "Withdrawal may still be pending", tone: "warn" },
    ],
    safeAction: "Continue with a 100 USDC test",
  },
  {
    id: "swap",
    label: "Stablecoin swap",
    protocol: "HSK Stable Swap",
    action: "Swap USDT for USDC",
    asset: "USDT → USDC",
    amount: "250 USDT",
    risk: 18,
    verdict: "Low risk · Looks reasonable",
    summary:
      "The approval matches this trade, liquidity is healthy, and the expected price difference is small. Check the final wallet prompt before signing.",
    factors: [
      { name: "Exact approval", detail: "Spending is limited to this transaction.", level: "low" },
      { name: "Healthy liquidity", detail: "Current pool depth limits price impact.", level: "low" },
      { name: "Price movement", detail: "Maximum slippage is set to 0.3%.", level: "low" },
    ],
    simulation: [
      { time: "Now", value: "249.84 USDC", note: "Estimated received", tone: "safe" },
      { time: "+24h", value: "249.79 USDC", note: "Normal peg movement", tone: "safe" },
      { time: "+72h", value: "249.93 USDC", note: "Position remains liquid", tone: "safe" },
    ],
    safeAction: "Proceed to wallet review",
  },
];

const zh: Record<string, string> = {
  "Unlimited approval": "无限额度授权",
  "Unknown Yield Vault": "未知收益金库",
  "Approve token spending": "授权代币支出",
  "Unlimited": "无限额度",
  "High risk · Do not sign yet": "高风险 · 暂时不要签名",
  "This contract could move every USDT in your wallet, not just the 500 USDT you plan to deposit. The contract is new and its owner can still change critical settings.": "这个合约可以转走你钱包中的全部 USDT，而不只是你计划存入的 500 USDT。该合约上线时间较短，而且所有者仍能修改关键设置。",
  "Unlimited allowance": "无限授权额度",
  "Requested limit is far above the intended deposit.": "请求的额度远高于你计划存入的金额。",
  "Upgradeable contract": "可升级合约",
  "The owner can replace important contract logic.": "合约所有者可以替换重要的运行逻辑。",
  "Limited history": "运行历史较短",
  "Only 19 days of activity and few independent users.": "只有 19 天活动记录，独立用户数量较少。",
  "Planned deposit": "计划存入金额",
  "Normal market movement": "正常市场波动",
  "Full wallet balance remains exposed": "钱包全部余额仍处于风险中",
  "Limit approval to 500 USDT": "把授权限制为 500 USDT",
  "RWA pool deposit": "RWA 资金池存款",
  "Tokyo Treasury Pool": "东京国债资金池",
  "Deposit into tokenized T-bills": "存入代币化国债",
  "Medium risk · Review restrictions": "中等风险 · 请查看限制条件",
  "The pool has a stronger operating history, but redemptions may take up to three business days. Your wallet also needs to meet the pool's allowlist requirements.": "这个资金池的运行记录较稳定，但赎回最多可能需要三个工作日，你的钱包还必须满足白名单条件。",
  "Redemption delay": "赎回延迟",
  "Funds may not be available immediately.": "资金可能无法立即取出。",
  "Allowlist required": "需要白名单资格",
  "Access can depend on eligibility checks.": "能否进入可能取决于资格审核。",
  "Capped approval": "限定额度授权",
  "The contract asks only for the deposit amount.": "合约只请求本次存款金额。",
  "Deposit submitted": "存款已提交",
  "Estimated yield accrual": "预计收益累计",
  "Withdrawal may still be pending": "提现可能仍在处理中",
  "Continue with a 100 USDC test": "先用 100 USDC 小额测试",
  "Stablecoin swap": "稳定币兑换",
  "HSK Stable Swap": "HSK 稳定币兑换",
  "Swap USDT for USDC": "将 USDT 兑换为 USDC",
  "Low risk · Looks reasonable": "低风险 · 看起来较合理",
  "The approval matches this trade, liquidity is healthy, and the expected price difference is small. Check the final wallet prompt before signing.": "授权额度与本次交易一致，流动性充足，预计价格偏差较小。签名前仍请检查钱包中的最终提示。",
  "Exact approval": "精确额度授权",
  "Spending is limited to this transaction.": "可支出金额仅限本次交易。",
  "Healthy liquidity": "流动性充足",
  "Current pool depth limits price impact.": "当前资金池深度可以降低价格冲击。",
  "Price movement": "价格波动",
  "Maximum slippage is set to 0.3%.": "最大滑点设置为 0.3%。",
  "Estimated received": "预计收到",
  "Normal peg movement": "正常锚定价格波动",
  "Position remains liquid": "资产仍可随时兑换",
  "Proceed to wallet review": "进入钱包最终确认",
  "Demo mode · No real funds": "演示模式 · 不使用真钱",
  "Pre-transaction AI risk copilot": "签名前 AI 风险助手",
  "Understand the risk": "在签名前",
  "before": "先看懂风险",
  "you sign.": "再决定是否签名。",
  "Horizon Guard turns contract signals and transaction simulation into one clear decision for everyday DeFi users.": "Horizon Guard 把复杂的合约信号和交易模拟，转化为普通 DeFi 用户能够理解的清晰决定。",
  "Preview": "预览",
  "Simulate": "模拟",
  "Act safely": "安全操作",
  "Demo scenarios": "演示场景",
  "Choose a transaction": "选择一笔交易",
  "5 signals checked": "已检查 5 类信号",
  "Contract, allowance, liquidity, holder activity, and simulation": "合约、授权、流动性、用户活动和交易模拟",
  "Transaction preview": "交易预览",
  "Protocol": "协议",
  "Asset": "资产",
  "Amount / allowance": "金额 / 授权额度",
  "Network": "网络",
  "HSK Chain Testnet": "HSK Chain 测试网",
  "AI risk assessment": "AI 风险评估",
  "Your wallet could be fully exposed": "你的钱包余额可能全部暴露",
  "Manageable, with conditions": "风险可控，但需要满足条件",
  "No major warning signs detected": "未发现主要危险信号",
  "Why this score": "评分原因",
  "72h sandbox": "72 小时沙盒",
  "high": "高",
  "medium": "中",
  "low": "低",
  "Simulation, not a prediction": "模拟结果，不是价格预测",
  "We replay liquidity and permission stress to show a range of possible outcomes.": "我们模拟流动性和权限压力，展示一系列可能发生的结果。",
  "Now": "现在",
  "Cancel transaction": "取消交易",
  "Risk Copilot": "风险助手",
  "In plain language": "用大白话解释",
  "My recommendation:": "我的建议：",
  "This keeps the demo intent while reducing the largest avoidable risk.": "这样可以保留原来的操作意图，同时消除最大的可避免风险。",
  "Guardrail": "安全护栏",
  "Signature blocked in Safe Mode": "安全模式已阻止签名",
  "Extra confirmation required": "需要额外确认",
  "Standard wallet confirmation": "使用标准钱包确认",
  "Institutional context": "机构级参考信息",
  "Demo": "演示",
  "Contract reputation": "合约信誉",
  "Unverified": "未验证",
  "Observed": "已有观察记录",
  "Wallet eligibility": "钱包资格",
  "Check required": "需要检查",
  "Not required": "不需要",
  "Approval scope": "授权范围",
  "Too broad": "范围过大",
  "Capped": "已限定",
  "Copy judge-ready summary": "复制评委版摘要",
  "Educational prototype. Not financial advice. Data shown is simulated for the hackathon demo.": "教育性质的原型，不构成投资建议。页面数据为黑客松演示模拟数据。",
  "Built for HSK Chain Horizon Hackathon · Japan": "为 HSK Chain Horizon Hackathon · Japan 打造",
  "AI × DeFi · Transaction safety · Beginner onboarding": "AI × DeFi · 交易安全 · 新手引导",
  "Demo wallet connected": "演示钱包已连接",
};

function ShieldMark() {
  return <span className="shield-mark" aria-hidden="true">H</span>;
}

export default function Home() {
  const [lang, setLang] = useState<"zh" | "en">("zh");
  const [chainStatus, setChainStatus] = useState<ChainStatus>({ connected: false });
  const [walletAddress, setWalletAddress] = useState("");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [addressInput, setAddressInput] = useState("0x4200000000000000000000000000000000000015");
  const [calldataInput, setCalldataInput] = useState("");
  const [addressAnalysis, setAddressAnalysis] = useState<AddressAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [reportFingerprint, setReportFingerprint] = useState("");
  const [selectedId, setSelectedId] = useState("approval");
  const [tab, setTab] = useState<"overview" | "sandbox">("overview");
  const [notice, setNotice] = useState("演示钱包已连接");
  const selected = useMemo(
    () => scenarios.find((scenario) => scenario.id === selectedId) ?? scenarios[0],
    [selectedId],
  );

  const riskClass = selected.risk >= 70 ? "danger" : selected.risk >= 35 ? "warn" : "safe";
  const t = (text: string) => (lang === "zh" ? zh[text] ?? text : text);

  useEffect(() => {
    let active = true;
    const loadStatus = async () => {
      try {
        const response = await fetch("/api/chain-status", { cache: "no-store" });
        if (!response.ok) throw new Error("Network status unavailable");
        const data = (await response.json()) as ChainStatus;
        if (active) setChainStatus(data);
      } catch {
        if (active) setChainStatus({ connected: false });
      }
    };
    loadStatus();
    const timer = window.setInterval(loadStatus, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const connectWallet = async () => {
    const ethereum = (window as Window & { ethereum?: BrowserWallet }).ethereum;
    if (!ethereum) {
      setNotice(lang === "zh" ? "未检测到浏览器钱包，将继续使用演示模式" : "No browser wallet detected; staying in demo mode");
      return;
    }
    try {
      const accounts = await ethereum.request({ method: "eth_requestAccounts" }) as string[];
      const address = accounts[0];
      if (!address) throw new Error("No account returned");

      const currentChain = await ethereum.request({ method: "eth_chainId" }) as string;
      if (currentChain !== "0x85") {
        try {
          await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x85" }] });
        } catch (switchError) {
          const code = (switchError as { code?: number }).code;
          if (code !== 4902) throw switchError;
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x85",
              chainName: "HashKey Chain Testnet",
              nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
              rpcUrls: ["https://testnet.hsk.xyz"],
              blockExplorerUrls: ["https://testnet-explorer.hsk.xyz"],
            }],
          });
        }
      }

      const balanceHex = await ethereum.request({ method: "eth_getBalance", params: [address, "latest"] }) as string;
      setWalletAddress(address);
      setWalletBalance(Number(BigInt(balanceHex)) / 1e18);
      setNotice(lang === "zh" ? "测试钱包已连接：只读取余额，不会请求签名" : "Test wallet connected: balance read only, no signature requested");
    } catch {
      setNotice(lang === "zh" ? "钱包连接已取消，没有进行任何操作" : "Wallet connection cancelled; nothing was changed");
    }
  };

  const analyzeAddress = async () => {
    setAnalysisLoading(true);
    setReportFingerprint("");
    try {
      const response = await fetch("/api/analyze-address", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: addressInput, calldata: calldataInput }),
      });
      if (!response.ok) throw new Error("Analysis failed");
      const result = await response.json() as AddressAnalysis;
      setAddressAnalysis(result);
      setNotice(lang === "zh" ? `真实链上分析完成：风险分 ${result.risk}` : `Live on-chain analysis complete: score ${result.risk}`);
    } catch {
      setAddressAnalysis(null);
      setNotice(lang === "zh" ? "无法分析：请检查地址是否为 0x 开头的 42 位地址" : "Could not analyze: check the 42-character 0x address");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const createReportFingerprint = async () => {
    if (!addressAnalysis) {
      setNotice(lang === "zh" ? "请先完成一次真实链上分析" : "Run a live on-chain analysis first");
      return;
    }
    const report = JSON.stringify({
      version: "horizon-guard-v1",
      chainId: 133,
      address: addressAnalysis.address.toLowerCase(),
      blockNumber: addressAnalysis.blockNumber,
      risk: addressAnalysis.risk,
      verdict: addressAnalysis.verdict,
      factors: addressAnalysis.factors,
    });
    const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(report));
    const fingerprint = `0x${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    setReportFingerprint(fingerprint);
    setNotice(lang === "zh" ? "风险报告指纹已生成，可用于链上防篡改验证" : "Report fingerprint created for tamper-evident verification");
  };

  const factorLabel = (factor: string) => {
    const labels: Record<string, [string, string]> = {
      CONTRACT_CODE_FOUND: ["检测到智能合约代码", "Smart-contract code detected"],
      NO_CONTRACT_CODE: ["没有检测到合约代码，目标可能是普通钱包", "No contract code; target may be a normal wallet"],
      MINIMAL_CODE: ["合约代码非常短，需要检查是否为转发器", "Very short contract code; may be a forwarding contract"],
      HIGH_COMPLEXITY: ["合约代码体积较大，审计难度更高", "Large contract code increases review complexity"],
      UPGRADEABLE_PROXY: ["检测到标准可升级代理槽位", "Standard upgradeable-proxy slot detected"],
      NO_STANDARD_PROXY_SLOT: ["未检测到标准代理升级槽位", "No standard proxy implementation slot detected"],
      APPROVAL_CALL: ["交易意图是 ERC-20 授权", "Transaction intent is an ERC-20 approval"],
      UNLIMITED_APPROVAL: ["检测到近似无限额度授权", "Near-unlimited token approval detected"],
      UNKNOWN_FUNCTION: ["无法识别函数，需要人工复核", "Unknown function selector needs manual review"],
    };
    return labels[factor]?.[lang === "zh" ? 0 : 1] ?? factor;
  };

  const copyJudgeSummary = async () => {
    const summary = lang === "zh"
      ? `Horizon Guard 是面向 HashKey Chain 的 AI 签名前风险助手。本场景风险分为 ${selected.risk}/100：${t(selected.summary)} 建议操作：${t(selected.safeAction)}。风险分由确定性链上信号产生，AI 负责用大白话解释。`
      : `Horizon Guard is an AI pre-transaction risk copilot for HashKey Chain. This scenario scores ${selected.risk}/100: ${selected.summary} Recommended action: ${selected.safeAction}. The score comes from deterministic on-chain signals; AI explains the verified evidence.`;
    try {
      await navigator.clipboard.writeText(summary);
      setNotice(lang === "zh" ? "评委版摘要已复制" : "Judge summary copied");
    } catch {
      setNotice(lang === "zh" ? "浏览器未允许复制，请手动复制风险说明" : "Clipboard access was unavailable; copy the risk explanation manually");
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Horizon Guard home">
          <ShieldMark />
          <span>Horizon Guard</span>
          <span className="network-pill">HSK Chain</span>
        </a>
        <div className="header-actions">
          <div className="language-switch" aria-label="语言切换">
            <button className={lang === "zh" ? "active" : ""} onClick={() => { setLang("zh"); setNotice("已切换为中文"); }}>中文</button>
            <button className={lang === "en" ? "active" : ""} onClick={() => { setLang("en"); setNotice("Switched to English"); }}>EN</button>
          </div>
          <span className="demo-status"><i /> {t("Demo mode · No real funds")}</span>
          <span className={`live-chain ${chainStatus.connected ? "online" : "loading"}`} title={lang === "zh" ? "只读取公开区块链数据，不会发送交易" : "Reads public chain data only; never sends a transaction"}>
            <i /> {chainStatus.connected
              ? (lang === "zh" ? `HSK 测试网实时区块 #${chainStatus.blockNumber?.toLocaleString()}` : `Live HSK block #${chainStatus.blockNumber?.toLocaleString()}`)
              : (lang === "zh" ? "正在连接 HSK 测试网" : "Connecting to HSK testnet")}
          </span>
          <button className="wallet-button" onClick={connectWallet} title={walletBalance === null ? "" : `${walletBalance.toFixed(4)} HSK`}>
            {walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : (lang === "zh" ? "连接测试钱包" : "Connect wallet")}
          </button>
        </div>
      </header>

      <section id="top" className="intro-row">
        <div>
          <p className="eyebrow">{t("Pre-transaction AI risk copilot")}</p>
          {lang === "zh" ? <h1>在签名前，<span>先看懂风险</span>。</h1> : <h1>Understand the risk <span>before</span> you sign.</h1>}
          <p className="intro-copy">{t("Horizon Guard turns contract signals and transaction simulation into one clear decision for everyday DeFi users.")}</p>
        </div>
        <div className="steps" aria-label="Analysis steps">
          <span className="active"><b>1</b> {t("Preview")}</span>
          <span><b>2</b> {t("Simulate")}</span>
          <span><b>3</b> {t("Act safely")}</span>
        </div>
      </section>

      <section className="live-analyzer card" aria-label={lang === "zh" ? "真实测试网地址分析" : "Live testnet address analysis"}>
        <div className="analyzer-copy">
          <p className="kicker">{lang === "zh" ? "真实 HSK 测试网读取" : "Live HSK testnet read"}</p>
          <h2>{lang === "zh" ? "分析任意合约地址或交易数据" : "Analyze any contract address or transaction data"}</h2>
          <p>{lang === "zh" ? "只读取公开链上数据，不会发起交易。下方已填入一个测试网系统合约作为示例。" : "Reads public on-chain data only and never sends a transaction. A testnet system contract is prefilled as an example."}</p>
        </div>
        <div className="analyzer-form">
          <label>
            <span>{lang === "zh" ? "目标合约地址" : "Target contract address"}</span>
            <input value={addressInput} onChange={(event) => setAddressInput(event.target.value)} spellCheck={false} placeholder="0x…" />
          </label>
          <label>
            <span>{lang === "zh" ? "交易数据（可选）" : "Transaction calldata (optional)"}</span>
            <input value={calldataInput} onChange={(event) => setCalldataInput(event.target.value)} spellCheck={false} placeholder={lang === "zh" ? "留空则只分析合约结构" : "Leave blank for contract structure only"} />
          </label>
          <div className="analyzer-buttons">
            <button className="sample-button" onClick={() => setCalldataInput(`0x095ea7b3${"0".repeat(24)}1111111111111111111111111111111111111111${"f".repeat(64)}`)}>{lang === "zh" ? "填入无限授权示例" : "Use unlimited approval sample"}</button>
            <button className="analyze-button" onClick={analyzeAddress} disabled={analysisLoading}>{analysisLoading ? (lang === "zh" ? "分析中…" : "Analyzing…") : (lang === "zh" ? "开始链上分析" : "Run on-chain analysis")}</button>
          </div>
        </div>
        {addressAnalysis && (
          <div className={`analysis-result ${addressAnalysis.verdict.toLowerCase()}`}>
            <div className="analysis-score"><strong>{addressAnalysis.risk}</strong><span>/100</span></div>
            <div className="analysis-summary">
              <strong>{lang === "zh" ? `${addressAnalysis.verdict === "HIGH" ? "高" : addressAnalysis.verdict === "MEDIUM" ? "中" : "低"}风险结构分析` : `${addressAnalysis.verdict.toLowerCase()} structural risk`}</strong>
              <span>{addressAnalysis.isContract ? (lang === "zh" ? `合约代码 ${addressAnalysis.codeSize.toLocaleString()} 字节` : `${addressAnalysis.codeSize.toLocaleString()} bytes of contract code`) : (lang === "zh" ? "普通钱包地址或未部署地址" : "Wallet or undeployed address")}</span>
              <div className="factor-chips">{addressAnalysis.factors.map((factor) => <span key={factor}>{factorLabel(factor)}</span>)}</div>
            </div>
            <a href={addressAnalysis.explorerUrl} target="_blank" rel="noreferrer">{lang === "zh" ? "在官方浏览器中核对 ↗" : "Verify in explorer ↗"}</a>
          </div>
        )}
      </section>

      <section className="registry-card card" aria-label={lang === "zh" ? "链上风险报告验证" : "On-chain risk report verification"}>
        <div>
          <p className="kicker">{lang === "zh" ? "HorizonRiskRegistry 链上验证层" : "HorizonRiskRegistry verification layer"}</p>
          <h2>{lang === "zh" ? "让 AI 风险报告可以被公开核验" : "Make AI risk reports publicly verifiable"}</h2>
          <p>{lang === "zh" ? "系统为真实分析结果生成唯一指纹，并已部署登记合约到 HashKey Chain 主网，证明报告没有被事后修改。合约不会保管或转移资金。" : "A unique fingerprint is generated from each live analysis. The registry is deployed on HashKey Chain mainnet to anchor the evidence without holding or moving funds."}</p>
        </div>
        <div className="registry-flow" aria-label={lang === "zh" ? "验证步骤" : "Verification steps"}>
          <span><b>1</b>{lang === "zh" ? "分析" : "Analyze"}</span>
          <i>→</i>
          <span><b>2</b>{lang === "zh" ? "生成指纹" : "Fingerprint"}</span>
          <i>→</i>
          <span className="complete"><b>3</b>{lang === "zh" ? "主网登记已完成" : "Mainnet registered"}</span>
        </div>
        <div className="fingerprint-box">
          <button onClick={createReportFingerprint} disabled={!addressAnalysis}>{lang === "zh" ? "生成报告指纹" : "Create report fingerprint"}</button>
          <code>{reportFingerprint || (lang === "zh" ? "完成上方链上分析后生成" : "Generated after a live analysis")}</code>
          <a href="/deploy">{lang === "zh" ? "打开主网部署助手 →" : "Open mainnet deployment assistant →"}</a>
          <a href={`https://hashkey.blockscout.com/address/${VERIFIED_REGISTRY_ADDRESS}`} target="_blank" rel="noreferrer">{lang === "zh" ? "查看已核验主网合约 ↗" : "View verified mainnet registry ↗"}</a>
        </div>
      </section>

      <section className="workspace-grid">
        <aside className="scenario-panel card">
          <div className="section-heading">
            <div>
              <p className="kicker">{t("Demo scenarios")}</p>
              <h2>{t("Choose a transaction")}</h2>
            </div>
            <span className="count">3</span>
          </div>
          <div className="scenario-list">
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                className={`scenario-item ${selectedId === scenario.id ? "selected" : ""}`}
                onClick={() => { setSelectedId(scenario.id); setNotice(lang === "zh" ? `${t(scenario.label)}分析完成` : `${scenario.label} analyzed`); }}
                aria-pressed={selectedId === scenario.id}
              >
                <span className={`scenario-score ${scenario.risk >= 70 ? "danger" : scenario.risk >= 35 ? "warn" : "safe"}`}>{scenario.risk}</span>
                <span className="scenario-text"><strong>{t(scenario.label)}</strong><small>{t(scenario.protocol)}</small></span>
                <span className="chevron">›</span>
              </button>
            ))}
          </div>
          <div className="signal-box">
            <span className="signal-icon">◎</span>
            <div><strong>{t("5 signals checked")}</strong><span>{t("Contract, allowance, liquidity, holder activity, and simulation")}</span></div>
          </div>
        </aside>

        <section className="analysis-column">
          <div className="transaction-card card">
            <div className="transaction-topline">
              <div>
                <p className="kicker">{t("Transaction preview")}</p>
                <h2>{t(selected.action)}</h2>
              </div>
              <span className={`verdict ${riskClass}`}>{t(selected.verdict)}</span>
            </div>
            <div className="transaction-details">
              <div><span>{t("Protocol")}</span><strong>{t(selected.protocol)}</strong></div>
              <div><span>{t("Asset")}</span><strong>{selected.asset}</strong></div>
              <div><span>{t("Amount / allowance")}</span><strong>{t(selected.amount)}</strong></div>
              <div><span>{t("Network")}</span><strong><i className="network-dot" /> {t("HSK Chain Testnet")}{chainStatus.connected ? ` · ${chainStatus.gasPriceGwei?.toFixed(2)} Gwei` : ""}</strong></div>
            </div>
          </div>

          <div className="result-card card">
            <div className="result-header">
              <div className={`risk-ring ${riskClass}`} style={{ "--score": `${selected.risk * 3.6}deg` } as React.CSSProperties}>
                <div><strong>{selected.risk}</strong><span>/ 100</span></div>
              </div>
              <div className="result-title">
                <p className="kicker">{t("AI risk assessment")}</p>
                <h2>{t(selected.risk >= 70 ? "Your wallet could be fully exposed" : selected.risk >= 35 ? "Manageable, with conditions" : "No major warning signs detected")}</h2>
                <p>{t(selected.summary)}</p>
              </div>
            </div>

            <div className="tabs" role="tablist">
              <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")} role="tab">{t("Why this score")}</button>
              <button className={tab === "sandbox" ? "active" : ""} onClick={() => setTab("sandbox")} role="tab">{t("72h sandbox")}</button>
            </div>

            {tab === "overview" ? (
              <div className="risk-factors">
                {selected.factors.map((factor) => (
                  <div className="factor" key={factor.name}>
                    <span className={`factor-mark ${factor.level}`}>{factor.level === "high" ? "!" : factor.level === "medium" ? "~" : "✓"}</span>
                    <div><strong>{t(factor.name)}</strong><p>{t(factor.detail)}</p></div>
                    <span className={`level ${factor.level}`}>{t(factor.level)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="simulation">
                <div className="simulation-note"><span>{t("Simulation, not a prediction")}</span><p>{t("We replay liquidity and permission stress to show a range of possible outcomes.")}</p></div>
                <div className="timeline">
                  {selected.simulation.map((point) => (
                    <div className={`timeline-point ${point.tone}`} key={point.time}>
                      <span className="time">{t(point.time)}</span><i />
                      <strong>{point.value}</strong><small>{t(point.note)}</small>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="action-row">
              <button className="secondary-action" onClick={() => setNotice(lang === "zh" ? "交易已安全取消" : "Transaction cancelled safely")}>{t("Cancel transaction")}</button>
              <button className="primary-action" onClick={() => setNotice(lang === "zh" ? `${t(selected.safeAction)} — 安全操作已准备好` : `${selected.safeAction} — safe path prepared`)}>{t(selected.safeAction)}<span>→</span></button>
            </div>
          </div>
        </section>

        <aside className="copilot-panel card">
          <div className="copilot-heading"><span className="spark">✦</span><div><p className="kicker">{t("Risk Copilot")}</p><h2>{t("In plain language")}</h2></div></div>
          <div className="chat-bubble">
            <p>{t(selected.summary)}</p>
            <p className="recommendation"><strong>{t("My recommendation:")}</strong> {t(selected.safeAction)}{lang === "zh" ? "。" : ". "}{t("This keeps the demo intent while reducing the largest avoidable risk.")}</p>
          </div>
          <div className="guardrail">
            <span>{t("Guardrail")}</span>
            <strong>{t(selected.risk >= 70 ? "Signature blocked in Safe Mode" : selected.risk >= 35 ? "Extra confirmation required" : "Standard wallet confirmation")}</strong>
          </div>
          <div className="compliance-card">
            <div className="compliance-title"><span>{t("Institutional context")}</span><span className="experimental">{t("Demo")}</span></div>
            <div className="check-row"><span>{t("Contract reputation")}</span><strong>{t(selected.risk >= 70 ? "Unverified" : "Observed")}</strong></div>
            <div className="check-row"><span>{t("Wallet eligibility")}</span><strong>{t(selected.id === "rwa" ? "Check required" : "Not required")}</strong></div>
            <div className="check-row"><span>{t("Approval scope")}</span><strong>{t(selected.id === "approval" ? "Too broad" : "Capped")}</strong></div>
          </div>
          <button className="explain-button" onClick={copyJudgeSummary}>{t("Copy judge-ready summary")}</button>
          <p className="disclaimer">{t("Educational prototype. Not financial advice. Data shown is simulated for the hackathon demo.")}</p>
        </aside>
      </section>

      <footer>
        <span>{t("Built for HSK Chain Horizon Hackathon · Japan")}</span>
        <span>{t("AI × DeFi · Transaction safety · Beginner onboarding")}</span>
      </footer>
      <div className="toast" role="status">{notice}</div>
    </main>
  );
}
