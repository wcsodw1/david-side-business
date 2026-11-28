"""產生五款風格 App（只換背景色與文字顏色）：themes/<key>/index.html + manifest + 圖示 + 風格總覽頁。
執行（在 interior-design-app/ 底下）：python3 tools/make_themes.py
圖示與 Logo 由 tools/make_theme_logos.py 產生（img/brand/themes/），再轉成 icons/themes/*.png。
顏色定義在 style.css 的 [data-theme=...] 區塊；這裡的色票只用在圖示、manifest 與總覽頁。"""
import json, os, re, io
ROOT = os.path.join(os.path.dirname(__file__), "..")
os.chdir(ROOT)
BASE_URL = "https://wcsodw1.github.io/david-side-business/interior-design-app/"
THEMES = [
  # key, 中文名, 英文名, 說明, bg, surface, ink, primary(按鈕), accent(強調字)
  ("industrial", "工業風", "Industrial", "清水模深灰、鏽鐵、黃銅", "#1e1f21", "#2a2b2e", "#ecebe6", "#a65428", "#d9a35b"),
  ("european", "歐風", "European Classic", "象牙白、酒紅、古典金", "#f7f2e8", "#fffdf8", "#2e2620", "#6b2735", "#94701f"),
  ("tropical", "美式 Tropical", "American Tropical", "薄荷白、棕櫚綠、珊瑚橘", "#f2faf6", "#ffffff", "#183a32", "#1d6b58", "#c9492f"),
  ("muji", "日系無印良品", "Japanese Muji", "牛皮紙米色、暖灰、低彩度紅", "#f3f0e9", "#fbfaf6", "#3b3833", "#5a524a", "#8e3b35"),
  ("kyoto", "日系京都", "Japanese Kyoto", "和紙、抹茶綠、朱紅", "#f2ece1", "#faf6ee", "#2b2622", "#45552f", "#b03c26"),
]
src = open("index.html").read()
icon_svg = open("img/brand/icon.svg").read()
icon_mask = open("img/brand/icon-maskable.svg").read()
os.makedirs("icons/themes", exist_ok=True); os.makedirs("img/brand/themes", exist_ok=True)

def recolor(svg, bg, fg):
    return svg.replace('fill="#000"', f'fill="{bg}"').replace('stroke="#fff"', f'stroke="{fg}"')

FONTS = {
  "industrial": "family=Oswald:wght@500;600&family=IBM+Plex+Mono:wght@500&family=Noto+Sans+TC:wght@400;500;700",
  "european": "family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Noto+Serif+TC:wght@400;600;700",
  "tropical": "family=Poppins:wght@400;500;600;700;800&family=Noto+Sans+TC:wght@400;500;700;900",
  "muji": "family=Noto+Sans+TC:wght@300;400;500",
  "kyoto": "family=Noto+Serif+TC:wght@400;600;700",
}
SPLASH = {"industrial": "#1e1f21", "european": "#6b2735", "tropical": "#1d6b58", "muji": "#f3f0e9", "kyoto": "#2b2622"}
SHORT = {"industrial": "工業", "european": "歐風", "tropical": "熱帶", "muji": "無印", "kyoto": "京都"}
for key, zh, en, desc, bg, surface, ink, pri, acc in THEMES:
    d = f"themes/{key}"; os.makedirs(d, exist_ok=True)
    h = src
    h = h.replace('<html lang="zh-Hant">', f'<html lang="zh-Hant" data-theme="{key}">')
    h = h.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<base href="../../">', 1)
    h = h.replace('<meta name="theme-color" content="#fcfcfc">', f'<meta name="theme-color" content="{bg}">')
    h = h.replace('href="manifest.webmanifest"', f'href="themes/{key}/manifest.webmanifest"')
    h = h.replace('href="icons/apple-touch-icon.png"', f'href="icons/themes/{key}-180.png"')
    h = h.replace('href="icons/favicon.png"', f'href="icons/themes/{key}-64.png"')
    h = h.replace('<meta name="apple-mobile-web-app-title" content="ENLIGHT">', f'<meta name="apple-mobile-web-app-title" content="ENLIGHT {SHORT[key]}">')
    h = h.replace('<title>ENLIGHT SPACE DESIGN</title>', f'<title>ENLIGHT SPACE DESIGN · {zh}</title>')
    h = h.replace('POC Demo · 手機版介面', f'{zh} · POC Demo · 手機版介面')
    h = h.replace('<link rel="stylesheet" href="style.css">', '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
                  f'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?{FONTS[key]}&display=swap">\n<link rel="stylesheet" href="style.css">\n<link rel="stylesheet" href="themes.css">')
    # 開啟畫面：換成這款風格的客製化 Logo
    h = h.replace('<img src="img/brand/logo-white.svg" alt="">', f'<img src="img/brand/themes/{key}-logo.svg" alt="">')
    h = h.replace('<div id="splash" aria-hidden="true">', f'<div id="splash" aria-hidden="true" style="background:{SPLASH[key]}">')
    open(f"{d}/index.html", "w").write(h)
    man = json.load(open("manifest.webmanifest"))
    man.update(name=f"ENLIGHT SPACE DESIGN · {zh}", short_name=f"ENLIGHT {SHORT[key]}", start_url="./", scope="./", id="./",
               background_color=SPLASH[key], theme_color=bg,
               icons=[{"src": f"../../icons/themes/{key}-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
                      {"src": f"../../icons/themes/{key}-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
                      {"src": f"../../icons/themes/{key}-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}])
    json.dump(man, open(f"{d}/manifest.webmanifest", "w"), ensure_ascii=False, indent=2)

# 風格總覽頁（選風格、預覽、QR Code）
import qrcode, qrcode.image.svg
def qr_svg(url):
    b = io.BytesIO(); qrcode.make(url, image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=1).save(b)
    s = b.getvalue().decode(); s = re.sub(r"<\?xml[^>]*\?>\s*", "", s)
    return re.sub(r'<svg width="[^"]*" height="[^"]*" version="1.1" viewBox', '<svg viewBox', s, count=1)
cards = []
for key, zh, en, desc, bg, surface, ink, pri, acc in THEMES:
    url = BASE_URL + f"themes/{key}/"
    sw = "".join(f'<i style="background:{c}"></i>' for c in (bg, surface, pri, acc, ink))
    cards.append(f'''<section class="t" style="--tb:{bg};--ti:{ink}">
  <img class="lg" src="../img/brand/themes/{key}-logo.svg" alt="ENLIGHT SPACE DESIGN {zh} Logo">
  <img class="pv" src="../img/themes/{key}.jpg" alt="{zh} 預覽" loading="lazy">
  <div class="info"><h2>{zh}<small>{en}</small></h2><p>{desc}</p><div class="sw">{sw}</div>
  <a class="btn" style="background:{pri}" href="{key}/">開啟 App</a>
  <div class="qr">{qr_svg(url)}<span>用 Safari 掃描開啟<br>→ 分享 → 加入主畫面</span></div></div></section>''')
page = f'''<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>五款風格 · ENLIGHT SPACE DESIGN</title><link rel="icon" type="image/png" href="../icons/favicon.png">
<style>
:root{{--bg:#fcfcfc;--card:#fff;--ink:#222;--mute:#6f7480;--line:#e6e8ec}}
@media(prefers-color-scheme:dark){{:root{{--bg:#111316;--card:#1b1e22;--ink:#eef0f3;--mute:#9aa2ae;--line:#2a2f36}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font-family:"PingFang TC","Noto Sans TC","Microsoft JhengHei",-apple-system,sans-serif;line-height:1.6}}
main{{max-width:1080px;margin:0 auto;padding:24px 16px 60px}}
.hd img{{width:100%;max-width:420px;display:block;border-radius:12px}}h1{{font-size:20px;margin:18px 0 4px}}.lead{{color:var(--mute);margin:0 0 8px;font-size:14px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-top:16px}}
.t{{background:var(--card);border:1px solid var(--line);border-radius:18px;overflow:hidden;display:flex;flex-direction:column}}
.lg{{width:100%;display:block;aspect-ratio:780/300}}.pv{{width:100%;aspect-ratio:390/560;object-fit:cover;object-position:top;display:block;background:var(--tb)}}
.info{{padding:14px 16px 16px}}h2{{margin:0;font-size:18px}}h2 small{{font-size:12px;color:var(--mute);font-weight:500;margin-left:8px}}.info p{{margin:2px 0 10px;color:var(--mute);font-size:13.5px}}
.sw{{display:flex;gap:6px}}.sw i{{width:26px;height:26px;border-radius:50%;border:1px solid rgba(127,127,127,.35)}}
.btn{{display:block;margin-top:14px;color:#fff;text-align:center;text-decoration:none;font-weight:700;border-radius:22px;padding:11px;font-size:15px}}
.qr{{display:flex;align-items:center;gap:12px;margin-top:12px;font-size:12.5px;color:var(--mute)}}.qr svg{{width:92px;height:92px;flex:none;background:#fff;border-radius:8px;padding:5px}}
.back{{display:inline-block;margin-top:24px;color:var(--mute);font-size:14px}}
</style></head><body><main>
<div class="hd"><img src="../img/brand/logo-dark.svg" alt="ENLIGHT SPACE DESIGN"></div>
<h1>五款風格 App</h1><p class="lead">功能、畫面流程與資料完全一樣，五種不同的 UI 風格（字體、形狀、線條、裝飾）。每一款都能各自安裝到主畫面（iPhone 用 Safari → 分享 → 加入主畫面）。</p>
<div class="grid">{"".join(cards)}</div>
<a class="back" href="../">← 原版（深藍）</a> · <a class="back" href="../install.html">安裝說明</a>
</main></body></html>'''
open("themes/index.html", "w").write(page)
print("ok", [t[0] for t in THEMES])
