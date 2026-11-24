/* Interior Design App — 示範資料（全部為虛構，不含真實客戶資料）。
   之後整合進 Gallery 或接後端時，只要換掉這個檔案。 */
window.DEMO_VERSION = 1;
window.DEMO = {
  user: "設計師",
  projects: [
    {
      id: "demo-1", name: "示範宅 A", city: "台北", owner: "示範屋主 王小姐", designer: "Allen",
      status: "done", progress: 100, due: "2026/08/03", art: "art-hero",
      contract: 2000000, payType: "B .收款比例分配",
      installments: [
        { name: "簽約完成", pct: 30, billed: "", received: "2026-04-21", done: true },
        { name: "泥作磁磚鋪貼完成", pct: 30, billed: "2026-06-05", received: "2026-06-09", done: true },
        { name: "油漆進場", pct: 30, billed: "", received: "2026-07-28", done: true },
        { name: "驗收完成", pct: 10, billed: "", received: "2026-09-17", done: true },
      ],
      progressItems: [
        { id: "e1", type: "work", date: "2026-07-16", title: "泥作貼磚", text: "泥作貼磚工程", art: "art-tile", n: 4 },
        { id: "e2", type: "work", date: "2026-07-03", title: "油漆工程", text: "全室油漆進場，批土與第一道底漆完成。", art: "art-paint", n: 3 },
        { id: "e3", type: "work", date: "2026-06-20", title: "木地板鋪設", text: "全室木地板鋪設完成，待收邊。", art: "art-wood", n: 3 },
        { id: "e4", type: "design", date: "2026-06-16", title: "木作天花板完工後追加施作調整", text: "目前已完成設計內天花板，並再需追加木作天花板調整內容：\n1. 客廳入門上方包樑上升（依管線能過為主）\n2. 餐廳燈具位置微調", art: "art-room", n: 2 },
      ],
      memos: [],
      buys: [],
      checks: [
        { id: "c1", title: "主要材質型號", sub: "主要裝修材質之品牌、型號或規格紀錄。", date: "2026-07-24", done: true, art: "art-wood", n: 3,
          text: "櫃體材質及油漆色號確認版\n系統櫃\n中島：JM515 胡桃木紋\n中島檯面：BQ2088 白皓石\n廚具下櫃：Y-32J 亞麻珍珠絨　踢腳：Y09J 淺灰\n廚具吊櫃：JM515 胡桃木紋\n廚具檯面：BQ2088 白皓石\n沙發旁電器高櫃：Y-32J 亞麻珍珠絨\n浴室浴櫃：Y-22 摩卡柚木\n浴室鏡櫃：Y-22 摩卡柚木\n全室油漆：白色（示範色號）\n全室木地板：超耐磨 WRLLS（示範型號）" },
        { id: "c2", title: "水電配置確認", sub: "插座、開關、管線位置確認。", date: "2026-05-10", done: true, art: "art-room", n: 2, text: "客廳、餐廳、主臥插座與開關位置已與屋主確認。" },
        { id: "c3", title: "木作尺寸確認", sub: "天花板、櫃體尺寸與高度。", date: "2026-06-02", done: true, art: "art-wood", n: 2, text: "天花板高度 2.5m，包樑尺寸確認。" },
        { id: "c4", title: "衛浴磁磚確認", sub: "磁磚規格與貼法。", date: "2026-06-12", done: true, art: "art-tile", n: 2, text: "浴室牆面 30×60 灰色石紋磚，橫貼。" },
        { id: "c5", title: "燈具位置確認", sub: "主燈、嵌燈、間接照明。", date: "2026-07-01", done: true, art: "art-room", n: 1, text: "餐廳吊燈高度離桌面 75cm。" },
        { id: "c6", title: "公共空間既有缺失紀錄", sub: "拆除前、施工前的空間現況紀錄：公共空間既有缺失、損壞與髒污。", date: "", done: false, art: "art-blank", n: 0, text: "" },
      ],
    },
    {
      id: "demo-2", name: "示範宅 B", city: "新北", owner: "示範屋主 陳先生", designer: "Allen",
      status: "doing", progress: 45, due: "2026/12/20", art: "art-hero2",
      contract: 1500000, payType: "B .收款比例分配",
      installments: [
        { name: "簽約完成", pct: 30, billed: "", received: "2026-09-05", done: true },
        { name: "泥作磁磚鋪貼完成", pct: 30, billed: "", received: "", done: false },
        { name: "油漆進場", pct: 30, billed: "", received: "", done: false },
        { name: "驗收完成", pct: 10, billed: "", received: "", done: false },
      ],
      progressItems: [
        { id: "e5", type: "work", date: "2026-11-10", title: "水電配管", text: "水電配管完成，待屋主確認插座位置。", art: "art-room", n: 2 },
        { id: "e6", type: "work", date: "2026-10-28", title: "拆除工程", text: "室內拆除完成。", art: "art-paint", n: 2 },
      ],
      memos: [{ id: "m1", date: "2026-11-12", title: "確認浴室磁磚色號", text: "請屋主在 11/20 前回覆。" }],
      buys: [{ id: "b1", date: "2026-11-12", title: "廚房水龍頭", text: "預算 $8,000，屋主自購。" }],
      checks: [
        { id: "c7", title: "主要材質型號", sub: "主要裝修材質之品牌、型號或規格紀錄。", date: "", done: false, art: "art-blank", n: 0, text: "" },
        { id: "c8", title: "公共空間既有缺失紀錄", sub: "拆除前、施工前的空間現況紀錄。", date: "2026-10-26", done: true, art: "art-room", n: 2, text: "電梯與走廊牆面既有刮痕已拍照留存。" },
      ],
    },
  ],
};
