const RPC_URL = "https://testnet.hsk.xyz";
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

type RpcResult = { id: number; result?: string; error?: { message?: string } };

function parseCallData(data: string) {
  const normalized = data.trim().toLowerCase();
  if (!normalized || normalized === "0x") return { callType: "none", unlimitedApproval: false };
  if (!/^0x[a-f0-9]+$/.test(normalized) || normalized.length < 10) return { callType: "invalid", unlimitedApproval: false };

  const selector = normalized.slice(0, 10);
  if (selector === "0x095ea7b3" && normalized.length >= 138) {
    const spender = `0x${normalized.slice(34, 74)}`;
    const amount = BigInt(`0x${normalized.slice(74, 138)}`);
    return {
      callType: "approve",
      unlimitedApproval: amount >= (1n << 255n),
      spender,
      rawAmount: amount.toString(),
    };
  }
  if (selector === "0xa9059cbb") return { callType: "transfer", unlimitedApproval: false };
  if (selector === "0x23b872dd") return { callType: "transferFrom", unlimitedApproval: false };
  return { callType: "unknown", unlimitedApproval: false, selector };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { address?: string; calldata?: string };
    const address = body.address?.trim();
    if (!address || !ADDRESS_PATTERN.test(address)) {
      return Response.json({ error: "INVALID_ADDRESS" }, { status: 400 });
    }

    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([
        { jsonrpc: "2.0", method: "eth_getCode", params: [address, "latest"], id: 1 },
        { jsonrpc: "2.0", method: "eth_getTransactionCount", params: [address, "latest"], id: 2 },
        { jsonrpc: "2.0", method: "eth_getBalance", params: [address, "latest"], id: 3 },
        { jsonrpc: "2.0", method: "eth_getStorageAt", params: [address, IMPLEMENTATION_SLOT, "latest"], id: 4 },
        { jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 5 },
      ]),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`RPC returned ${response.status}`);
    const results = (await response.json()) as RpcResult[];
    const value = (id: number) => results.find((item) => item.id === id)?.result;
    const code = value(1) ?? "0x";
    const nonceHex = value(2) ?? "0x0";
    const balanceHex = value(3) ?? "0x0";
    const implementationSlot = value(4) ?? "0x0";
    const blockHex = value(5) ?? "0x0";

    const isContract = code !== "0x" && code !== "0x0";
    const codeSize = isContract ? (code.length - 2) / 2 : 0;
    const implementationRaw = implementationSlot.replace(/^0x/, "").padStart(64, "0");
    const implementation = `0x${implementationRaw.slice(-40)}`;
    const isProxy = !/^0x0{40}$/.test(implementation);
    const call = parseCallData(body.calldata ?? "");
    const factors: string[] = [];
    let risk = 20;

    if (!isContract) {
      risk = 78;
      factors.push("NO_CONTRACT_CODE");
    } else {
      factors.push("CONTRACT_CODE_FOUND");
      if (codeSize < 160) { risk += 18; factors.push("MINIMAL_CODE"); }
      if (codeSize > 18000) { risk += 10; factors.push("HIGH_COMPLEXITY"); }
    }
    if (isProxy) { risk += 25; factors.push("UPGRADEABLE_PROXY"); }
    else factors.push("NO_STANDARD_PROXY_SLOT");
    if (call.callType === "approve") factors.push("APPROVAL_CALL");
    if (call.unlimitedApproval) { risk += 50; factors.push("UNLIMITED_APPROVAL"); }
    if (call.callType === "unknown") { risk += 8; factors.push("UNKNOWN_FUNCTION"); }
    risk = Math.min(100, risk);

    return Response.json({
      address,
      chainId: 133,
      blockNumber: Number.parseInt(blockHex, 16),
      isContract,
      codeSize,
      isProxy,
      implementation: isProxy ? implementation : null,
      contractNonce: Number.parseInt(nonceHex, 16),
      balanceHSK: Number(BigInt(balanceHex)) / 1e18,
      callType: call.callType,
      unlimitedApproval: call.unlimitedApproval,
      spender: "spender" in call ? call.spender : null,
      risk,
      verdict: risk >= 70 ? "HIGH" : risk >= 40 ? "MEDIUM" : "LOW",
      factors,
      explorerUrl: `https://testnet-explorer.hsk.xyz/address/${address}`,
      limitations: "Structural RPC analysis only; not a security audit.",
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "ANALYSIS_FAILED" }, { status: 503 });
  }
}
