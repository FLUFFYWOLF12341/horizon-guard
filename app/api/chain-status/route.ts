const RPC_URL = "https://testnet.hsk.xyz";

type RpcResult = { id: number; result?: string; error?: { message?: string } };

export async function GET() {
  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([
        { jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 },
        { jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 2 },
        { jsonrpc: "2.0", method: "eth_gasPrice", params: [], id: 3 },
      ]),
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`RPC returned ${response.status}`);
    const results = (await response.json()) as RpcResult[];
    const value = (id: number) => results.find((item) => item.id === id)?.result;
    const chainIdHex = value(1);
    const blockHex = value(2);
    const gasHex = value(3);
    if (!chainIdHex || !blockHex || !gasHex) throw new Error("Incomplete RPC response");

    const chainId = Number.parseInt(chainIdHex, 16);
    if (chainId !== 133) throw new Error("Unexpected chain ID");

    return Response.json({
      connected: true,
      chainId,
      blockNumber: Number.parseInt(blockHex, 16),
      gasPriceGwei: Number(BigInt(gasHex)) / 1_000_000_000,
      source: "HashKey Chain Testnet public RPC",
      readOnly: true,
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ connected: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
