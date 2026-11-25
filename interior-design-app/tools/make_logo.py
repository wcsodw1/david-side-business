"""ENLIGHT SPACE DESIGN 標誌產生器（細線條、黑底白線的室內透視風格）。
執行：python3 tools/make_logo.py  → 產出 img/brand/*.svg
字母全部用線條路徑畫（不依賴字型），任何裝置顯示都一樣。"""
import math, os

OUT = os.path.join(os.path.dirname(__file__), "..", "img", "brand")
os.makedirs(OUT, exist_ok=True)

# ---- 字母（單位方塊：高 1，y 向下；回傳 (寬度, path)） ----
def G_(w):
    rx, ry, cx = w / 2, .5, w / 2
    a = math.radians(40)
    sx, sy = cx + rx * math.cos(a), .5 - ry * math.sin(a)
    b = math.asin(.2)
    ex, ey = cx + rx * math.cos(b), .5 + ry * math.sin(b)
    return f"M{sx:.4f},{sy:.4f} A{rx},{ry} 0 1 0 {ex:.4f},{ey:.4f} H{w*.56:.4f}"
def C_(w):
    rx, ry, cx = w / 2, .5, w / 2
    a = math.radians(42)
    sx, sy = cx + rx * math.cos(a), .5 - ry * math.sin(a)
    return f"M{sx:.4f},{sy:.4f} A{rx},{ry} 0 1 0 {sx:.4f},{1-sy:.4f}"
GL = {
    "E": (.54, "M.54,0 H0 V1 H.54 M0,.5 H.46"),
    "N": (.72, "M0,1 V0 L.72,1 V0"),
    "L": (.5, "M0,0 V1 H.5"),
    "I": (0, "M0,0 V1"),
    "G": (.92, G_(.92)),
    "H": (.66, "M0,0 V1 M.66,0 V1 M0,.5 H.66"),
    "T": (.64, "M0,0 H.64 M.32,0 V1"),
    "S": (.56, "M.53,.13 A.27,.25 0 1 0 .28,.5 A.28,.25 0 1 1 .02,.87"),
    "P": (.54, "M0,1 V0 H.29 A.25,.25 0 0 1 .29,.5 H0"),
    "A": (.7, "M0,1 L.35,0 L.7,1"),          # 無橫槓的 Λ，呼應極簡線條
    "C": (.84, C_(.84)),
    "D": (.7, "M0,0 V1 H.22 A.48,.5 0 0 0 .22,0 Z"),
}

def word(text, x, y, h, track, sw):
    """回傳 (svg 片段, 結束 x)。track = 字距（以字高為單位）"""
    parts, cx = [], x
    for i, ch in enumerate(text):
        if ch == " ":
            cx += h * .55; continue
        w, d = GL[ch]
        parts.append(f'<path transform="translate({cx:.2f},{y:.2f}) scale({h})" d="{d}" stroke-width="{sw/h:.5f}"/>')
        cx += w * h + (track * h if i < len(text) - 1 else 0)
    return "".join(parts), cx

def width(text, h, track):
    return word(text, 0, 0, h, track, 1)[1]

def fit_track(text, h, target):
    lo, hi = 0, 3
    for _ in range(40):
        m = (lo + hi) / 2
        if width(text, h, m) < target: lo = m
        else: hi = m
    return lo

SW = 3   # 線寬（與外框一致）

def logo(fg, bg=None):
    W, H = 780, 300
    L, T, R, B, F = 24, 26, 756, 274, 238       # 左、上、右、下、地板線
    IN, POLE, BOX = 66, 176, 228               # 內牆線、燈桿（左框右緣）、文字框左緣
    g = []
    # 左側：室內透視角落
    g.append(f"M{L},{T} H{POLE} M{L},{T} V{B} H{R} M{IN},{T} V{F} M{IN},{F} H{R} V{T} H{BOX} V{F} M{POLE},{F} V{B}")
    diag = f'<path d="M{L},{B} L{IN},{F}" stroke-linecap="butt"/>'
    # 吊燈：從天花板垂下，燈罩 + 拉繩
    sy0, sy1, tw, bw = 104, 152, 20, 34
    g.append(f"M{POLE},{T} V{sy0} M{POLE-tw},{sy0} H{POLE+tw} L{POLE+bw},{sy1} H{POLE-bw} Z M{POLE},{sy1} V{F}")
    frame = "".join(f'<path d="{d}"/>' for d in g) + diag
    # 光：燈罩下方三道光線（ENLIGHT 的意象）
    rays = "".join(f'<path d="M{POLE+dx*0.4:.1f},{sy1+12} L{POLE+dx:.1f},{sy1+40}" stroke-width="2" opacity=".8"/>' for dx in (-32, 32))
    # 文字
    x0, x1 = BOX + 30, R - 30
    h1 = 74
    t1 = fit_track("ENLIGHT", h1, x1 - x0)
    w1, _ = word("ENLIGHT", x0, 64, h1, t1, SW)
    h2 = 25
    t2 = fit_track("SPACE DESIGN", h2, x1 - x0)
    w2, _ = word("SPACE DESIGN", x0, 174, h2, t2, SW * .85)
    bgr = f'<rect width="{W}" height="{H}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-label="ENLIGHT SPACE DESIGN">'
            f'<title>ENLIGHT SPACE DESIGN</title>{bgr}<g fill="none" stroke="{fg}" stroke-width="{SW}" stroke-linecap="square" stroke-linejoin="miter">{frame}{rays}{w1}{w2}</g></svg>')

def icon(fg, bg, size=512, pad=0.0):
    """App 圖示：室內角落 + 吊燈 + 光（小尺寸也清楚）。pad = maskable 安全區縮放"""
    s = size; k = 1 - pad; o = s * pad / 2
    def P(x, y): return f"{o + x*k*s/512:.1f},{o + y*k*s/512:.1f}"
    sw = 9 * k * s / 512
    L, T, R, B, F, IN = 92, 92, 420, 420, 356, 156
    d = [f"M{P(L,T)} L{P(R,T)} L{P(R,F)} M{P(L,T)} L{P(L,B)} L{P(R,B)} M{P(IN,T)} L{P(IN,F)} L{P(R,F)} M{P(R,F)} L{P(R,B)}"]
    diag = f'<path d="M{P(L,B)} L{P(IN,F)}" stroke-linecap="butt"/>'
    cx = 288
    d.append(f"M{P(cx,T)} L{P(cx,196)} M{P(cx-36,196)} L{P(cx+36,196)} L{P(cx+62,262)} L{P(cx-62,262)} Z")
    rays = f'<path d="M{P(cx-20,286)} L{P(cx-46,322)} M{P(cx,290)} L{P(cx,330)} M{P(cx+20,286)} L{P(cx+46,322)}" stroke-width="{sw*.7:.1f}" opacity=".8"/>'
    paths = "".join(f'<path d="{x}"/>' for x in d) + diag
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {s} {s}"><rect width="{s}" height="{s}" fill="{bg}"/>'
            f'<g fill="none" stroke="{fg}" stroke-width="{sw:.1f}" stroke-linecap="square" stroke-linejoin="miter">{paths}{rays}</g></svg>')

files = {
    "logo-dark.svg": logo("#fff", "#000"),      # 黑底白線（主要版本）
    "logo-white.svg": logo("#fff"),             # 透明底白線（放深色背景上）
    "logo-black.svg": logo("#111"),             # 透明底黑線（放淺色背景上）
    "icon.svg": icon("#fff", "#000"),
    "icon-maskable.svg": icon("#fff", "#000", pad=0.22),
}
for n, s in files.items():
    open(os.path.join(OUT, n), "w").write(s)
print("ok", list(files))
