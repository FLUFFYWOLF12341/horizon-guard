"use client";

import { useState } from "react";
import Link from "next/link";
import { HORIZON_RISK_REGISTRY_BYTECODE } from "./bytecode";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown>[] }) => Promise<unknown>;
};

type Receipt = {
  contractAddress?: string;
  status?: string;
  transactionHash?: string;
};

const MAINNET = {
  chainId: "0xb1",
  chainName: "HashKey Chain",
  nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
  rpcUrls: ["https://mainnet.hsk.xyz"],
  blockExplorerUrls: ["https://hashkey.blockscout.com"],
};

const VERIFIED_REGISTRY_ADDRESS = "0xc0043c0ecdc68401366d92bb46fd5721a4096153";

const waitForReceipt = async (ethereum: EthereumProvider, hash: string) => {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const receipt = await ethereum.request({
      method: "eth_getTransactionReceipt",
      params: [hash],
    }) as Receipt | null;
    if (receipt) return receipt;
    await new Promise((resolve) => window.setTimeout(resolve, 4000));
  }
  return null;
};

export default function DeployPage() {
  const [lang, setLang] = useState<"zh" | "en">("zh");
  const [address, setAddress] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [status, setStatus] = useState("尚未连接钱包");
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [contractAddress, setContractAddress] = useState("");

  const getProvider = () => (window as Window & { ethereum?: EthereumProvider }).ethereum;

  const connect = async () => {
    const ethereum = getProvider();
    if (!ethereum) {
      setStatus(lang === "zh" ? "没有检测到钱包扩展。请用安装了 MetaMask 或 OKX Wallet 的浏览器打开本页。" : "No wallet extension found. Open this page in a browser with MetaMask or OKX Wallet.");
      return;
    }
    setBusy(true);
    try {
      const accounts = await ethereum.request({ method: "eth_requestAccounts" }) as string[];
      const account = accounts[0];
      if (!account) throw new Error("No account");
      const currentChain = await ethereum.request({ method: "eth_chainId" }) as string;
      if (currentChain !== MAINNET.chainId) {
        try {
          await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: MAINNET.chainId }] });
        } catch (error) {
          if ((error as { code?: number }).code !== 4902) throw error;
          await ethereum.request({ method: "wallet_addEthereumChain", params: [MAINNET] });
        }
      }
      const balanceHex = await ethereum.request({ method: "eth_getBalance", params: [account, "latest"] }) as string;
      const hskBalance = Number(BigInt(balanceHex)) / 1e18;
      setAddress(account);
      setBalance(hskBalance);
      setStatus(lang === "zh" ? "钱包已连接到 HashKey Chain 主网。部署前请确认地址和余额。" : "Wallet connected to HashKey Chain mainnet. Check the address and balance before deployment.");
    } catch {
      setStatus(lang === "zh" ? "连接已取消，没有进行任何交易。" : "Connection cancelled. No transaction was made.");
    } finally {
      setBusy(false);
    }
  };

  const deploy = async () => {
    const ethereum = getProvider();
    if (!ethereum || !address) {
      setStatus(lang === "zh" ? "请先连接钱包。" : "Connect a wallet first.");
      return;
    }
    setBusy(true);
    setStatus(lang === "zh" ? "请在钱包中核对网络、部署费用和发送地址。只有你确认后才会广播交易。" : "Review the network, deployment fee and sender in your wallet. The transaction is broadcast only after you confirm.");
    try {
      const hash = await ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from: address, data: `0x${HORIZON_RISK_REGISTRY_BYTECODE}` }],
      }) as string;
      setTxHash(hash);
      setStatus(lang === "zh" ? "交易已提交，正在等待主网确认…" : "Transaction submitted. Waiting for mainnet confirmation…");
      const receipt = await waitForReceipt(ethereum, hash);
      if (!receipt) {
        setStatus(lang === "zh" ? "等待时间较长，请在区块浏览器中查看交易状态。" : "Confirmation is taking longer than expected. Check the explorer.");
      } else if (receipt.status === "0x0") {
        setStatus(lang === "zh" ? "部署交易失败，没有生成合约。请查看浏览器中的失败原因。" : "Deployment failed and no contract was created. Check the explorer.");
      } else if (receipt.contractAddress) {
        setContractAddress(receipt.contractAddress);
        window.localStorage.setItem("horizonGuardRegistry", receipt.contractAddress);
        setStatus(lang === "zh" ? "部署成功！请保存下面的合约地址。" : "Deployment succeeded. Save the contract address below.");
      }
    } catch {
      setStatus(lang === "zh" ? "部署已取消或钱包拒绝了交易，没有产生新的合约。" : "Deployment was cancelled or rejected. No contract was created.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="deploy-shell">
      <header className="deploy-header">
        <Link href="/">← Horizon Guard</Link>
        <div className="language-switch">
          <button className={lang === "zh" ? "active" : ""} onClick={() => setLang("zh")}>中文</button>
          <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>EN</button>
        </div>
      </header>
      <section className="deploy-hero">
        <p className="eyebrow">{lang === "zh" ? "主网部署助手" : "Mainnet deployment assistant"}</p>
        <h1>{lang === "zh" ? "把风险验证合约部署到 HashKey Chain" : "Deploy the risk registry to HashKey Chain"}</h1>
        <p>{lang === "zh" ? "本页部署已编译并审核过的 HorizonRiskRegistry。它只登记报告指纹，不保管代币、不获取授权，也不能转移你的资金。" : "This page deploys the reviewed HorizonRiskRegistry bytecode. It only anchors report fingerprints and cannot hold tokens, request approvals or move your funds."}</p>
      </section>
      <section className="deploy-grid">
        <div className="deploy-card">
          <span className="deploy-step">1</span>
          <h2>{lang === "zh" ? "连接主网钱包" : "Connect a mainnet wallet"}</h2>
          <p>{lang === "zh" ? "网络：HashKey Chain · Chain ID 177 · 手续费代币 HSK" : "Network: HashKey Chain · Chain ID 177 · Gas token HSK"}</p>
          <button onClick={connect} disabled={busy}>{address ? (lang === "zh" ? "重新检查钱包" : "Recheck wallet") : (lang === "zh" ? "连接钱包" : "Connect wallet")}</button>
          {address && <dl><div><dt>{lang === "zh" ? "地址" : "Address"}</dt><dd>{address}</dd></div><div><dt>{lang === "zh" ? "余额" : "Balance"}</dt><dd>{balance?.toFixed(6)} HSK</dd></div></dl>}
        </div>
        <div className="deploy-card">
          <span className="deploy-step">2</span>
          <h2>{lang === "zh" ? "确认合约部署" : "Confirm contract deployment"}</h2>
          <p>{lang === "zh" ? "点击后钱包会显示预计费用。请亲自核对并确认；拒绝不会产生费用。" : "Your wallet will show the estimated fee. Review and confirm it yourself; rejecting costs nothing."}</p>
          <button className="deploy-primary" onClick={deploy} disabled={busy || !address || Boolean(contractAddress)}>{busy ? (lang === "zh" ? "处理中…" : "Working…") : (lang === "zh" ? "打开钱包确认部署" : "Open wallet to confirm")}</button>
        </div>
        <div className="deploy-card">
          <span className="deploy-step">3</span>
          <h2>{lang === "zh" ? "保存主网凭证" : "Save mainnet proof"}</h2>
          <p>{lang === "zh" ? "成功后会显示交易和合约地址，它们是参赛资格与演示中的公开证明。" : "After confirmation, the transaction and contract addresses become public proof for submission and judging."}</p>
          {txHash && <a className="deploy-proof" href={`https://hashkey.blockscout.com/tx/${txHash}`} target="_blank" rel="noreferrer">{lang === "zh" ? "查看部署交易 ↗" : "View deployment transaction ↗"}</a>}
          {contractAddress && <a className="deploy-proof success" href={`https://hashkey.blockscout.com/address/${contractAddress}`} target="_blank" rel="noreferrer">{contractAddress}</a>}
        </div>
      </section>
      <div className="deploy-status" role="status"><i />{status}</div>
      <div className="deploy-status verified-status" role="note"><i />{lang === "zh" ? "已确认主网部署：" : "Confirmed mainnet deployment: "}<a href={`https://hashkey.blockscout.com/address/${VERIFIED_REGISTRY_ADDRESS}`} target="_blank" rel="noreferrer">{VERIFIED_REGISTRY_ADDRESS}</a></div>
      <aside className="deploy-warning">{lang === "zh" ? "安全提醒：不要向任何人发送助记词或私钥。此页面只通过钱包标准接口请求连接和部署确认。" : "Safety: never share a seed phrase or private key. This page only uses the wallet's standard connection and transaction confirmation interface."}</aside>
    </main>
  );
}
