/* Interior Design App — 示範資料（依 UI 截圖建立；標「示意」的項目是截圖沒有、為了讓流程完整而補的）。
   之後接後端或整合進 Gallery 時，只要換掉這個檔案。 */
window.DEMO_VERSION = 2;
const IMG = {
  tile: "img/tile.jpg", paint: "img/paint.jpg", ceiling: "img/ceiling.jpg", floor: "img/floor.jpg",
};
const slides = (src, n) => [[src, "50% 50%", 1], [src, "15% 30%", 1.5], [src, "85% 70%", 1.5], [src, "50% 90%", 1.25]].slice(0, n);
window.DEMO = {
  user: "Joseph",
  projects: [
    {
      id: "p1", name: "文山萬芳林宅", city: "台北", owner: "文山萬芳 黃小姐", designer: "Allen",
      status: "done", progress: 100, due: "2026/08/03", hero: "img/hero.jpg",
      contract: 2000000, payType: "B .收款比例分配",
      installments: [
        { name: "簽約完成", pct: 30, billed: "", received: "2026-04-21", done: true, note: "" },
        { name: "泥作磁磚鋪貼完成", pct: 30, billed: "2026-06-05", received: "2026-06-09", done: true, note: "" },
        { name: "油漆進場", pct: 30, billed: "", received: "2026-07-28", done: true, note: "" },
        { name: "驗收完成", pct: 10, billed: "", received: "2026-09-17", done: true, note: "" },
      ],
      design: [], extras: [],
      progressItems: [
        { id: "e1", type: "work", date: "2026-07-16", title: "泥作貼磚", text: "泥作貼磚工程", imgs: slides(IMG.tile, 4) },
        { id: "e2", type: "work", date: "2026-07-03", title: "油漆工程", text: "油漆工程", imgs: slides(IMG.paint, 3) },
        { id: "e3", type: "work", date: "2026-06-24", title: "木作天花板完工", text: "木作天花板施作完成（示意）", imgs: slides(IMG.ceiling, 2) },
        { id: "e4", type: "work", date: "2026-06-12", title: "泥作防水", text: "浴室泥作防水測試完成（示意）", imgs: slides(IMG.tile, 2) },
        { id: "e5", type: "work", date: "2026-06-05", title: "水電配管完成", text: "水電配管完成，待確認插座位置（示意）", imgs: slides(IMG.paint, 2) },
        { id: "e6", type: "work", date: "2026-05-28", title: "水電配管", text: "水電配管施工中（示意）", imgs: slides(IMG.paint, 2) },
        { id: "e7", type: "work", date: "2026-05-18", title: "拆除工程", text: "室內拆除完成（示意）", imgs: slides(IMG.ceiling, 2) },
        { id: "e8", type: "work", date: "2026-05-12", title: "現場保護工程", text: "電梯與公共空間保護完成（示意）", imgs: slides(IMG.floor, 2) },
        { id: "e9", type: "work", date: "2026-05-05", title: "開工前現場確認", text: "與屋主確認開工前現況（示意）", imgs: slides(IMG.floor, 2) },
        { id: "e10", type: "design", date: "2026-06-16", title: "木作天花板完工後追加施作調整",
          text: "目前已完成設計內天花板，並再需追加木作天花板調整內容\n1.客廳入門上方包樑上升（依管線能過為主）\n2.餐廳燈具位置微調（示意）", imgs: slides(IMG.ceiling, 1) },
      ],
      memos: [], buys: [],
      checks: [
        { id: "c1", title: "主要材質型號", sub: "主要裝修材質之品牌、型號或規格紀錄。", date: "2026-07-24", done: true, imgs: slides(IMG.floor, 3),
          text: "櫃體材質及油漆色號確認版\n系統櫃\n中島：JM515傑克森山胡桃\n中島檯面：BQ2088白皓石\n廚具下櫃：Y-32J亞麻珍珠絨 踢腳：Y09J淺灰\n廚具吊櫃：JM515傑克森山胡桃\n廚具檯面：BQ2088白皓石\n沙發旁電器高櫃：Y-32J亞麻珍珠絨\n浴室浴櫃：Y-22摩卡柚木\n浴室鏡櫃：Y-22摩卡柚木\n全室油漆：得利I白\n全室木地板：Bausen超耐磨 WRLLS" },
        { id: "c2", title: "水電配置確認", sub: "插座、開關、管線位置確認。（示意）", date: "2026-05-30", done: true, imgs: slides(IMG.paint, 2), text: "客廳、餐廳、主臥插座與開關位置已與屋主確認。" },
        { id: "c3", title: "防水測試確認", sub: "浴室泥作防水與試水紀錄。（示意）", date: "2026-06-14", done: true, imgs: slides(IMG.tile, 2), text: "浴室試水 48 小時，無滲漏。" },
        { id: "c4", title: "木作尺寸確認", sub: "天花板、櫃體尺寸與高度。（示意）", date: "2026-06-20", done: true, imgs: slides(IMG.ceiling, 2), text: "天花板高度與包樑尺寸確認完成。" },
        { id: "c5", title: "燈具位置確認", sub: "主燈、嵌燈、間接照明位置。（示意）", date: "2026-07-08", done: true, imgs: slides(IMG.ceiling, 1), text: "餐廳吊燈高度離桌面 75cm。" },
        { id: "c6", title: "公共空間既有缺失紀錄", sub: "拆除前、施工前的空間現況紀錄：公共空間既有缺失、損壞與髒污。", date: "", done: false, imgs: [], text: "" },
      ],
    },
  ],
};
