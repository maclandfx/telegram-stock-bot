const http = require("http");
const TG_TOKEN = "8612305607:AAEMzv4tQkVX390KdXABqgW5047X-bVnspM";
const USER_ID = 8673372605;

async function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: "POST",
      headers: { "Content-Type": "application/json" },
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ ok: false });
        }
      });
    });
    req.on("error", reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function sendMessage(text) {
  const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
  return await httpPost(url, { chat_id: USER_ID, parse_mode: "HTML", text });
}

async function checkSignals() {
  try {
    let turnover = "未知";
    try {
      const turnResp = await fetch(
        "https://push2.eastmoney.com/api/qt/stock/get?fields=f43&secid=1.000001&ut=fa13fd414d2e4b9a6a374793fc9703f0&fltt=2&invt=2"
      );
      const turnJson = await turnResp.json();
      const rawTurn = turnJson.data?.f43 || 0;
      turnover = (rawTurn / 100000000).toFixed(2) + "万亿";
    } catch (e) {}

    let shChange = 0,
      shPrice = 0,
      szChange = 0,
      cybChange = 0;
    try {
      const mkt = await fetch(
        "https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f2,f3,f4,f14&secids=1.000001,0.399001,0.399006"
      );
      const mktJson = await mkt.json();
      const stocks = mktJson.data?.diff || [];
      shChange = stocks[0]?.f3 || 0;
      shPrice = stocks[0]?.f2 || 0;
      szChange = stocks[1]?.f3 || 0;
      cybChange = stocks[2]?.f3 || 0;
    } catch (e) {}

    const sig1 = parseFloat(turnover) < 1.7 ? "✅" : "❌";
    const emoji1 = shChange > 0 ? "🔴" : "🔵";

    return `📊 <b>三重回调信号巡检</b>

⏰ ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}
📍 上证: ${shPrice} ${emoji1} ${shChange > 0 ? "+" : ""}${shChange}%
📍 深圳: ${szChange > 0 ? "🔴" : "🔵"} ${szChange > 0 ? "+" : ""}${szChange}%
📍 创业板: ${cybChange > 0 ? "🔴" : "🔵"} ${cybChange > 0 ? "+" : ""}${cybChange}%

📈 信号1（成交额<1.7万亿）: <b>${sig1}</b> ${turnover}
📈 信号2（宽基ETF净流入）: 🔍 需人工判断
📈 信号3（上证放量站上20日线）: 🔍 需人工判断

💡 发送 <code>帮助</code> 查看所有指令`;
  } catch (e) {
    return "⚠️ 信号检查失败";
  }
}

async function getMarketData() {
  try {
    const resp = await fetch(
      "https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f2,f3,f4,f14&secids=1.000001,0.399001,0.399006,1.399005"
    );
    const json = await resp.json();
    const stocks = json.data?.diff || [];
    let text = "📊 <b>A股实时行情</b>\n\n";
    for (const s of stocks) {
      const name = s.f14 || "未知";
      const price = s.f2 || "-";
      const change = s.f3 || 0;
      const emoji = change > 0 ? "🔴" : "🔵";
      text += `${emoji} ${name}: ${price}  ${change > 0 ? "+" : ""}${change}%\n`;
    }
    return text;
  } catch (e) {
    return "⚠️ 数据获取失败";
  }
}

async function handleCommand(text) {
  const cmd = text.trim().toLowerCase();
  if (cmd === "信号" || cmd === "signals") return await checkSignals();
  if (cmd === "大盘" || cmd === "行情" || cmd === "market") return await getMarketData();
  if (cmd === "帮助" || cmd === "help") {
    return `📖 <b>本子虾 · 可用指令</b>

<code>信号</code> - 三重回调信号巡检
<code>大盘</code> - 主要指数实时行情
<code>帮助</code> - 显示本帮助

💡 每个交易日下午会自动推送一次信号巡检结果`;
  }
  return `📝 收到: <code>${text}</code>

发送 <code>帮助</code> 查看可用指令`;
}

async function handleWebhook(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "POST" && url.pathname === "/webhook") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const data = JSON.parse(body);
          const message = data.message || data.edited_message;
          if (message && message.text) {
            const reply = await handleCommand(message.text);
            await sendMessage(reply);
          }
        } catch (e) {
          console.error("处理消息失败:", e);
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    } else {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("OK");
    }
  } catch (e) {
    console.error(e);
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
  }
}

const server = http.createServer(handleWebhook);
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`本子虾 Bot 运行中，端口 ${PORT}`);
});
