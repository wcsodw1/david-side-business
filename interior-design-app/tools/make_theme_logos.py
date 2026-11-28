"""五款風格的客製化 Logo 與 App 圖示（沿用 ENLIGHT 細線條構圖，左側換成各風格的主題插畫）。
執行（在 interior-design-app/ 底下）：python3 tools/make_theme_logos.py → img/brand/themes/<key>-logo.svg / -icon.svg / -icon-maskable.svg
插畫全部是原創線條畫：京都＝五重塔＋夕陽、工業風＝工字鋼＋愛迪生籠燈＋水管＋紅磚、歐風＝拱窗＋水晶吊燈＋菱格地磚、
Tropical＝棕櫚樹＋太陽＋海浪、無印（MINIMAL）＝和紙燈籠＋木長凳＋一枝花。"""
import math, os
os.chdir(os.path.join(os.path.dirname(__file__), ".."))
OUT = "img/brand/themes"; os.makedirs(OUT, exist_ok=True)

# ---------- 線條字母（高 1） ----------
def arcG(w):
    rx, ry, cx = w/2, .5, w/2; a = math.radians(40); b = math.asin(.2)
    return f"M{cx+rx*math.cos(a):.4f},{.5-ry*math.sin(a):.4f} A{rx},{ry} 0 1 0 {cx+rx*math.cos(b):.4f},{.5+ry*math.sin(b):.4f} H{w*.56:.4f}"
def arcC(w):
    rx, ry, cx = w/2, .5, w/2; a = math.radians(42); sx, sy = cx+rx*math.cos(a), .5-ry*math.sin(a)
    return f"M{sx:.4f},{sy:.4f} A{rx},{ry} 0 1 0 {sx:.4f},{1-sy:.4f}"
GL = {
  "E": (.54, "M.54,0 H0 V1 H.54 M0,.5 H.46"), "N": (.72, "M0,1 V0 L.72,1 V0"), "L": (.5, "M0,0 V1 H.5"), "I": (0, "M0,0 V1"),
  "G": (.92, arcG(.92)), "H": (.66, "M0,0 V1 M.66,0 V1 M0,.5 H.66"), "T": (.64, "M0,0 H.64 M.32,0 V1"),
  "S": (.56, "M.53,.13 A.27,.25 0 1 0 .28,.5 A.28,.25 0 1 1 .02,.87"), "P": (.54, "M0,1 V0 H.29 A.25,.25 0 0 1 .29,.5 H0"),
  "A": (.7, "M0,1 L.35,0 L.7,1"), "C": (.84, arcC(.84)), "D": (.7, "M0,0 V1 H.22 A.48,.5 0 0 0 .22,0 Z"),
  "U": (.62, "M0,0 V.62 A.31,.38 0 0 0 .62,.62 V0"), "R": (.56, "M0,1 V0 H.3 A.25,.25 0 0 1 .3,.5 H0 M.28,.5 L.56,1"),
  "O": (.9, "M.45,0 A.45,.5 0 1 0 .45,1 A.45,.5 0 1 0 .45,0"), "K": (.58, "M0,0 V1 M.58,0 L0,.58 M.2,.4 L.58,1"),
  "Y": (.62, "M0,0 L.31,.5 L.62,0 M.31,.5 V1"), "M": (.8, "M0,1 V0 L.4,.62 L.8,0 V1"),
}
def word(text, x, y, h, track, sw):
    out, cx = [], x
    for i, ch in enumerate(text):
        if ch == " ": cx += h*.55; continue
        w, d = GL[ch]
        out.append(f'<path transform="translate({cx:.2f},{y:.2f}) scale({h})" d="{d}" stroke-width="{sw/h:.5f}"/>')
        cx += w*h + (track*h if i < len(text)-1 else 0)
    return "".join(out), cx
def width(text, h, track): return word(text, 0, 0, h, track, 1)[1]
def fit(text, h, target):
    lo, hi = 0, 3
    for _ in range(40):
        m = (lo+hi)/2
        if width(text, h, m) < target: lo = m
        else: hi = m
    return lo

# ---------- 版面（與主 Logo 相同） ----------
W, H = 780, 300
L, T, R, B, F = 24, 26, 756, 274, 238
POLE, BOX, CX = 176, 228, 100
P = lambda d, extra="": f'<path d="{d}" {extra}/>'

# ---------- 各風格插畫（座標在左側框 24..176 × 26..238） ----------
def kyoto(ln, ac):
    g = [f'<circle cx="{CX+42}" cy="62" r="15" fill="{ac}" stroke="none"/>']
    ys, ws = [214, 182, 151, 122, 95], [128, 108, 90, 74, 60]
    for i, (y, w) in enumerate(zip(ys, ws)):
        hb = w*.2
        g.append(P(f"M{CX-w/2},{y-11} Q{CX-w*.42},{y+1} {CX-w*.3},{y+1} H{CX+w*.3} Q{CX+w*.42},{y+1} {CX+w/2},{y-11} "
                   f"Q{CX+w*.3},{y-9} {CX+hb+3},{y-17} H{CX-hb-3} Q{CX-w*.3},{y-9} {CX-w/2},{y-11} Z"))
        bot = 228 if i == 0 else ys[i-1]-16
        g.append(P(f"M{CX-hb},{y+1} V{bot} M{CX+hb},{y+1} V{bot}"))
    g.append(P(f"M{CX-58},{F} V228 H{CX+58} V{F}"))                       # 基壇
    top = ys[-1]-16
    g.append(P(f"M{CX},{top} V44"))                                          # 相輪
    g.append(P("".join(f"M{CX-5},{yy} H{CX+5} " for yy in (70, 64, 58, 52)), 'stroke-width="2"'))
    g.append(f'<circle cx="{CX}" cy="40" r="3.5" fill="{ln}" stroke="none"/>')
    return "".join(g)

def industrial(ln, ac):
    g = [P(f"M{L},40 H{POLE} M{L},54 H{POLE}"), P("".join(f"M{x},40 V54 " for x in range(44, 176, 26)), 'stroke-width="2"')]
    g.append(P(f"M{CX},54 V96 M{CX-8},96 H{CX+8} V112 H{CX-8} Z"))
    g.append(P(f"M{CX-12},112 C{CX-30},120 {CX-30},160 {CX},168 C{CX+30},160 {CX+30},120 {CX+12},112"))
    g.append(P(f"M{CX},112 V168 M{CX-6},113 Q{CX-20},140 {CX},168 M{CX+6},113 Q{CX+20},140 {CX},168 M{CX-23},132 H{CX+23} M{CX-24},150 H{CX+24}", 'stroke-width="2"'))
    g.append(P(f"M{CX-7},126 L{CX-3.5},138 L{CX},126 L{CX+3.5},138 L{CX+7},126", f'stroke="{ac}" stroke-width="2"'))
    g.append(P("M40,66 V188 Q40,204 56,204 H74 V238", 'stroke-width="5"'))
    g.append(P("M34,104 H46 M34,150 H46 M68,198 V210", f'stroke="{ac}" stroke-width="3"'))
    bricks = ""
    for r, y in enumerate((192, 208, 224)):
        bricks += f"M128,{y} H176 "
        off = 0 if r % 2 == 0 else 12
        for x in range(128+off, 176, 24): bricks += f"M{x},{y} V{y+14} " if y+14 <= F else ""
    g.append(P(bricks, 'stroke-width="1.6" opacity=".8"'))
    return "".join(g)

def european(ln, ac):
    g = [P(f"M44,{F} V132 A56,56 0 0 1 156,132 V{F}"), P(f"M52,{F} V132 A48,48 0 0 1 148,132 V{F}", 'stroke-width="2"')]
    g.append(P(f"M{CX-6},73 L{CX+6},73 L{CX+4},86 L{CX-4},86 Z", f'stroke="{ac}"'))
    g.append(P(f"M52,154 H148 M{CX},154 V{F}", 'stroke-width="2"'))
    g.append(P(f"M{CX},86 V100"))
    g.append(f'<circle cx="{CX}" cy="104" r="4" fill="none"/>')
    g.append(P(f"M{CX},108 Q{CX-18},126 {CX-30},110 M{CX},108 Q{CX+18},126 {CX+30},110 M{CX},110 Q{CX-9},120 {CX-15},112 M{CX},110 Q{CX+9},120 {CX+15},112 M{CX},112 V124", 'stroke-width="2"'))
    for x, y in ((CX-30, 110), (CX+30, 110), (CX-15, 112), (CX+15, 112)):
        g.append(P(f"M{x},{y} V{y-9}", 'stroke-width="2"'))
        g.append(f'<circle cx="{x}" cy="{y-12}" r="2.2" fill="{ac}" stroke="none"/>')
    g.append(f'<circle cx="{CX}" cy="127" r="2.5" fill="{ln}" stroke="none"/>')
    zz1 = "M24,256 " + " ".join(f"L{24+9*(i+1)},{F if i%2==0 else 256}" for i in range(16))
    zz2 = "M24,256 " + " ".join(f"L{24+9*(i+1)},{B if i%2==0 else 256}" for i in range(16))
    g.append(P(zz1+" "+zz2, 'stroke-width="1.6" opacity=".85"'))
    return "".join(g)

def tropical(ln, ac, ac2="#f6c35b"):
    g = [f'<circle cx="140" cy="70" r="20" fill="{ac}" stroke="none"/>', f'<circle cx="140" cy="70" r="27" fill="none" stroke="{ac2}" stroke-width="1.6" stroke-dasharray="3 5"/>']
    p0, p1, p2, p3 = (64, F), (70, 190), (78, 150), (104, 104)
    bz = lambda t: tuple((1-t)**3*a + 3*(1-t)**2*t*b + 3*(1-t)*t*t*c + t**3*d for a, b, c, d in zip(p0, p1, p2, p3))
    g.append(P(f"M{p0[0]},{p0[1]} C{p1[0]},{p1[1]} {p2[0]},{p2[1]} {p3[0]},{p3[1]}"))
    ticks = ""
    for t in (.15, .32, .49, .66, .82):
        x, y = bz(t); x2, y2 = bz(t+.01); dx, dy = x2-x, y2-y; n = math.hypot(dx, dy); nx, ny = -dy/n, dx/n
        ticks += f"M{x-nx*5:.1f},{y-ny*5:.1f} L{x+nx*5:.1f},{y+ny*5:.1f} "
    g.append(P(ticks, 'stroke-width="2"'))
    cx, cy = p3
    for ang, ln_, droop in ((-168, 58, 18), (-132, 50, 14), (-70, 46, -10), (-25, 54, 14), (12, 56, 20)):
        a = math.radians(ang); tx, ty = cx + math.cos(a)*ln_, cy + math.sin(a)*ln_ + droop
        mx, my = (cx+tx)/2, (cy+ty)/2 - 10; px, py = -math.sin(a)*8, math.cos(a)*8
        g.append(P(f"M{cx},{cy} Q{mx+px:.1f},{my+py:.1f} {tx:.1f},{ty:.1f} Q{mx-px:.1f},{my-py:.1f} {cx},{cy}"))
    g.append(f'<circle cx="{cx-5}" cy="{cy+8}" r="4" fill="none"/><circle cx="{cx+4}" cy="{cy+9}" r="4" fill="none"/>')
    for y in (206, 220):
        g.append(P(f"M112,{y} q8,-7 16,0 t16,0 t16,0 t16,0", 'stroke-width="2"'))
    return "".join(g)

def minimal(ln, ac):
    g = [P(f"M{CX},{T} V68", 'stroke-width="1.6"')]
    cy, rx, ry = 108, 24, 40
    g.append(f'<ellipse cx="{CX}" cy="{cy}" rx="{rx}" ry="{ry}" fill="none"/>')
    ribs = ""
    for y in (84, 100, 116, 132):
        hw = rx*math.sqrt(max(0, 1-((y-cy)/ry)**2)); ribs += f"M{CX-hw:.1f},{y} H{CX+hw:.1f} "
    g.append(P(ribs, 'stroke-width="1.4" opacity=".75"'))
    g.append(P(f"M{CX-6},68 H{CX+6} M{CX-6},148 H{CX+6}"))
    g.append(P(f"M46,196 H154 M46,202 H154 M56,202 V{F} M144,202 V{F}"))
    g.append(P("M128,196 V186 Q128,180 131,180 Q134,180 134,186 V196", 'stroke-width="2"'))
    g.append(P("M131,180 Q127,160 140,146 M133,166 Q141,163 146,157", 'stroke-width="1.6"'))
    g.append(f'<circle cx="140" cy="145" r="3.2" fill="{ac}" stroke="none"/>')
    return "".join(g)

THEMES = {  # key: (插畫, 背景, 線條, 強調, 風格英文)
  "kyoto":      (kyoto,      "#2b2622", "#f2ece1", "#d2492f", "KYOTO"),
  "industrial": (industrial, "#1e1f21", "#ecebe6", "#d9a35b", "INDUSTRIAL"),
  "european":   (european,   "#6b2735", "#f7f2e8", "#d4b062", "EUROPEAN"),
  "tropical":   (tropical,   "#1d6b58", "#f2faf6", "#f08a5d", "TROPICAL"),
  "muji":       (minimal,    "#f3f0e9", "#3b3833", "#8e3b35", "MINIMAL"),
}

def logo(key, with_bg=True):
    fn, bg, ln, ac, label = THEMES[key]
    sw = 2.6 if key == "muji" else 3
    frame = P(f"M{L},{T} H{POLE} V{B} M{L},{T} V{B} H{R} M{L},{F} H{R} V{T} H{BOX} V{F}")
    x0, x1 = BOX+30, R-30
    w1, _ = word("ENLIGHT", x0, 64, 74, fit("ENLIGHT", 74, x1-x0), sw)
    w2, _ = word("SPACE DESIGN", x0, 174, 25, fit("SPACE DESIGN", 25, x1-x0), sw*.85)
    lh = 12; lw = width(label, lh, .7)
    w3, _ = word(label, R-16-lw, 256-lh/2, lh, .7, 1.8)
    bgr = f'<rect width="{W}" height="{H}" fill="{bg}"/>' if with_bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-label="ENLIGHT SPACE DESIGN {label}"><title>ENLIGHT SPACE DESIGN · {label}</title>{bgr}'
            f'<g fill="none" stroke="{ln}" stroke-width="{sw}" stroke-linecap="square" stroke-linejoin="miter">{frame}{fn(ln, ac)}{w1}{w2}</g>'
            f'<g fill="none" stroke="{ac}" stroke-linecap="square">{w3}</g></svg>')

def icon(key, pad=0.0, size=512):
    fn, bg, ln, ac, label = THEMES[key]
    # 取左側框（24..176 × 26..274），等比放進正方形
    bw, bh = POLE-L, F-T; k = (1-pad) * size * .8 / bh; ox = (size - bw*k)/2 - L*k; oy = (size - bh*k)/2 - T*k
    frame = P(f"M{L},{T} H{POLE} V{F} H{L} Z")
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}"><rect width="{size}" height="{size}" fill="{bg}"/>'
            f'<g transform="translate({ox:.1f},{oy:.1f}) scale({k:.4f})" fill="none" stroke="{ln}" stroke-width="{4.2 if key != "muji" else 3.6}" stroke-linecap="square" stroke-linejoin="miter">{frame}{fn(ln, ac)}</g></svg>')

for key in THEMES:
    open(f"{OUT}/{key}-logo.svg", "w").write(logo(key))
    open(f"{OUT}/{key}-icon.svg", "w").write(icon(key))
    open(f"{OUT}/{key}-icon-maskable.svg", "w").write(icon(key, pad=.2))
print("ok", list(THEMES))
