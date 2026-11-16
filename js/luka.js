/* Luka Film 字幕工具（直接做進網站）：畫面是 Luka_film/V2 的介面搬過來，資料來自你 Mac 上跑的工具（http://127.0.0.1:8766）。
   影片 / 原稿 / 辨識都在你的 Mac 本機處理，這個網站只負責顯示進度與按鈕，不上傳任何東西。 */
(() => {
  "use strict";
  const API = "http://127.0.0.1:8766";
  const CSS = ":host,.lk{\n  --bg:#fff7ec; --ink:#2b2340; --card:#ffffff; --line:#2b2340;\n  --red:#ff5a5f; --yellow:#ffc93c; --green:#3ddc97; --blue:#4d96ff; --purple:#9b5de5;\n  --term:#1f1b2e; --term-ink:#e9e4ff; --muted:#8a82a6;\n}\n*{box-sizing:border-box}\n.lk{background:var(--bg);color:var(--ink);font-family:Fredoka,\"PingFang TC\",\"Noto Sans TC\",system-ui,sans-serif;\n  background-image:radial-gradient(#ffe3c2 1.5px,transparent 1.5px);background-size:22px 22px;min-height:100vh}\nbutton{font:inherit;cursor:pointer}\n.wrap{max-width:820px;margin:0 auto;padding:78px 16px 0;display:flex;flex-direction:column;gap:22px}\n\n/* header */\n.top{display:flex;justify-content:space-between;align-items:center}\n.logo{font-weight:700;font-size:22px;display:flex;align-items:center;gap:10px}\n.logo-mark{width:36px;height:36px;border-radius:12px;background:var(--red);color:#fff;display:grid;place-items:center;\n  border:3px solid var(--line);box-shadow:3px 3px 0 var(--line);transform:rotate(-6deg)}\n.conn{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;background:#fff;padding:6px 12px;border-radius:99px;border:2.5px solid var(--line)}\n.conn i{width:10px;height:10px;border-radius:50%;background:#ccc}\n.conn i.on{background:var(--green);animation:pulse 1.4s infinite}\n\n/* cards */\n.card{background:var(--card);border:3px solid var(--line);border-radius:22px;box-shadow:6px 6px 0 var(--line);padding:18px}\n.input{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:stretch}\n.pickers{display:grid;grid-template-columns:1fr 1fr;gap:12px}\n.pick{display:flex;align-items:center;gap:12px;text-align:left;background:#fff4d6;border:2.5px dashed var(--line);border-radius:16px;padding:12px 14px;\n  transition:transform .15s,background .15s;min-width:0;color:var(--ink)}\n.pick:hover{transform:translateY(-2px) rotate(-.5deg);background:#ffe9a8}\n.pick.ok{background:#d8fbe9;border-style:solid}\n.pick-icon{font-size:28px;flex:none}\n.pick-text{display:flex;flex-direction:column;min-width:0}\n.pick-text b{font-size:16px}\n.pick-text small{font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:\"JetBrains Mono\",monospace}\n.pick.ok small{color:#138a57}\n.go,.stop{border:3px solid var(--line);border-radius:18px;font-size:22px;font-weight:700;padding:0 28px;color:#fff;\n  box-shadow:4px 4px 0 var(--line);transition:transform .1s,box-shadow .1s}\n.go{background:var(--red)}\n.stop{background:var(--purple)}\n.go:hover:not(:disabled){transform:translate(-1px,-1px) scale(1.03);box-shadow:6px 6px 0 var(--line)}\n.go:active,.stop:active{transform:translate(3px,3px);box-shadow:1px 1px 0 var(--line)}\n.go:disabled{background:#c9c3d8;cursor:not-allowed}\n.go[hidden],.stop[hidden]{display:none}\n\n/* track */\n.track{position:relative;padding:138px 6px 4px}\n.rail{position:absolute;left:16.6%;right:16.6%;top:168px;height:12px;background:#fff;border:3px solid var(--line);border-radius:99px;overflow:hidden}\n.rail span{display:block;height:100%;width:0;background:repeating-linear-gradient(45deg,var(--yellow) 0 10px,#ffb100 10px 20px);\n  transition:width .8s cubic-bezier(.3,1.4,.5,1);animation:stripes 1s linear infinite}\n.stations{display:grid;grid-template-columns:repeat(3,1fr);position:relative}\n.st{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}\n.st-dot{width:72px;height:72px;border-radius:50%;background:#fff;border:3px solid var(--line);display:grid;place-items:center;font-size:30px;\n  box-shadow:4px 4px 0 var(--line);position:relative;transition:transform .3s}\n.st-dot svg{position:absolute;inset:-3px;width:calc(100% + 6px);height:calc(100% + 6px);transform:rotate(-90deg)}\n.st-dot circle{fill:none;stroke-width:6;stroke-linecap:round;transition:stroke-dashoffset .6s}\n.st b{font-size:16px}\n.st small{font-size:13px;font-weight:600;padding:2px 10px;border-radius:99px;border:2px solid var(--line);background:#fff}\n.st.running .st-dot{background:#fff4d6;animation:wobble 1.2s ease-in-out infinite}\n.st.complete .st-dot{background:#d8fbe9}\n.st.review .st-dot{background:#fff1c2}\n.st.error .st-dot,.st.interrupted .st-dot{background:#ffe0e0}\n.st.complete small{background:var(--green)}\n.st.review small{background:var(--yellow)}\n.st.running small{background:var(--blue);color:#fff}\n.st.error small,.st.interrupted small{background:var(--red);color:#fff}\n\n/* buddy mascot */\n.buddy{position:absolute;top:50px;left:16.6%;width:64px;margin-left:-32px;transition:left 1s cubic-bezier(.4,1.6,.5,1);z-index:2}\n.buddy .body{width:64px;height:56px;background:var(--blue);border:3px solid var(--line);border-radius:50% 50% 44% 44%;position:relative;box-shadow:inset -6px -6px 0 rgba(0,0,0,.12)}\n.eye{position:absolute;top:18px;width:9px;height:12px;background:var(--line);border-radius:50%;animation:blink 4s infinite}\n.eye.l{left:17px}.eye.r{right:17px}\n.mouth{position:absolute;left:50%;top:33px;width:16px;height:8px;margin-left:-8px;border:3px solid var(--line);border-top:0;border-radius:0 0 12px 12px}\n.feet{position:absolute;left:0;right:0;bottom:-11px;display:flex;justify-content:center;gap:12px;z-index:-1}\n.feet span{width:14px;height:8px;background:var(--line);border-radius:6px}\n.bubble{position:absolute;bottom:94px;left:50%;transform:translateX(-50%);background:#fff;border:2.5px solid var(--line);border-radius:14px;\n  padding:4px 10px;font-size:13px;font-weight:600;white-space:nowrap;box-shadow:3px 3px 0 var(--line)}\n.bubble:after{content:\"\";position:absolute;bottom:-8px;left:50%;margin-left:-6px;border:6px solid transparent;border-top-color:var(--line);border-bottom:0}\n.buddy.idle .body{animation:breathe 2.6s ease-in-out infinite}\n.buddy.idle .eye{height:3px;top:22px;animation:none}\n.buddy.work .body{animation:hop .5s ease-in-out infinite;background:var(--yellow)}\n.buddy.work .feet span{animation:step .25s infinite alternate}\n.buddy.work .mouth{width:10px;height:10px;margin-left:-5px;border:3px solid var(--line);border-radius:50%}\n.buddy.done .body{background:var(--green);animation:jump .7s ease-in-out infinite}\n.buddy.done .mouth{width:22px;height:11px;margin-left:-11px;background:var(--line)}\n.buddy.oops .body{background:var(--red);animation:shake .4s infinite}\n.buddy.oops .mouth{border-top:3px solid var(--line);border-bottom:0;border-radius:12px 12px 0 0;top:36px}\n\n/* terminal */\n.term{background:var(--term);border:3px solid var(--line);border-radius:22px;box-shadow:6px 6px 0 var(--line);overflow:hidden}\n.term-bar{display:flex;align-items:center;gap:12px;padding:10px 14px;background:#2d2742;border-bottom:3px solid var(--line)}\n.dots{display:flex;gap:7px}\n.dots i{width:13px;height:13px;border-radius:50%;border:2px solid #0006}\n.dots i:nth-child(1){background:var(--red)}.dots i:nth-child(2){background:var(--yellow)}.dots i:nth-child(3){background:var(--green)}\n.term-title{flex:1;color:#b9b2d6;font-family:\"JetBrains Mono\",monospace;font-size:13px}\n.mini{background:#fff;border:2px solid var(--line);border-radius:10px;padding:3px 10px;font-size:13px;font-weight:600}\n.term-body{height:340px;overflow:auto;padding:14px 16px;font-family:\"JetBrains Mono\",monospace;font-size:13px;line-height:1.7;color:var(--term-ink)}\n.ln{display:flex;gap:10px;align-items:flex-start;animation:pop .35s cubic-bezier(.3,1.6,.5,1) both}\n.ln .tag{flex:none;font-weight:600;font-size:11px;padding:1px 8px;border-radius:99px;margin-top:3px;color:var(--term)}\n.ln .tag.s0{background:#b9b2d6}.ln .tag.s1{background:var(--blue);color:#fff}.ln .tag.s2{background:var(--purple);color:#fff}.ln .tag.s3{background:var(--yellow)}\n.ln .msg{word-break:break-word}\n.ln.success .msg{color:var(--green)}\n.ln.warning .msg{color:var(--yellow)}\n.ln.error .msg{color:#ff8c8f}\n.cursor{display:inline-block;width:9px;height:16px;background:var(--green);vertical-align:-3px;animation:blinkc 1s steps(1) infinite}\n\n/* outputs */\n.outs{display:flex;flex-wrap:wrap;gap:10px}\n.outs a{background:#fff;border:2.5px solid var(--line);border-radius:14px;padding:8px 14px;color:var(--ink);text-decoration:none;font-weight:600;\n  box-shadow:3px 3px 0 var(--line);transition:transform .15s}\n.outs a:hover{transform:translateY(-2px) rotate(-1deg)}\n\n.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ink);color:#fff;padding:10px 18px;border-radius:14px;\n  font-weight:600;border:3px solid var(--line);box-shadow:4px 4px 0 #0003;animation:pop .3s both;max-width:calc(100% - 32px)}\n.toast.err{background:var(--red)}\n\n.confetti{position:fixed;top:-10px;width:10px;height:14px;z-index:9;pointer-events:none;animation:fall linear forwards}\n\n@keyframes pulse{50%{box-shadow:0 0 0 6px rgba(61,220,151,.25)}}\n@keyframes stripes{to{background-position:28px 0}}\n@keyframes wobble{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg) scale(1.06)}}\n@keyframes breathe{50%{transform:scaleY(.94) translateY(3px)}}\n@keyframes hop{50%{transform:translateY(-10px)}}\n@keyframes step{to{transform:translateY(-3px)}}\n@keyframes jump{0%,100%{transform:translateY(0)}40%{transform:translateY(-22px) rotate(-8deg)}60%{transform:translateY(-22px) rotate(8deg)}}\n@keyframes shake{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}\n@keyframes blink{0%,94%,100%{transform:scaleY(1)}97%{transform:scaleY(.1)}}\n@keyframes blinkc{50%{opacity:0}}\n@keyframes pop{from{opacity:0;transform:translateY(8px) scale(.96)}}\n@keyframes fall{to{transform:translateY(105vh) rotate(720deg)}}\n\n@media (max-width:640px){\n  .input{grid-template-columns:1fr}\n  .pickers{grid-template-columns:1fr}\n  .go,.stop{padding:14px}\n  .st-dot{width:58px;height:58px;font-size:24px}\n  .rail{top:161px}\n  .term-body{height:300px;font-size:12px}\n}\n@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}\n.lk:not(.ready) .buddy,.lk:not(.ready) .rail span{transition:none}\n\n/* hammer while running */\n.cursor-ln{animation:none;align-items:flex-end;min-height:78px;padding-top:14px}\n.forge,.working{display:none}\n.cursor-ln.busy .forge{display:inline-block}\n.cursor-ln.busy .working{display:inline;margin-bottom:6px}\n.forge{position:relative;width:100px;height:64px;margin-left:10px;flex:none}\n.anvil{position:absolute;left:8px;bottom:6px;width:44px;height:12px;background:#9a93b8;border:2px solid #0009;border-radius:5px 5px 2px 2px;animation:anvil .7s infinite}\n.anvil:after{content:\"\";position:absolute;left:12px;right:12px;bottom:-8px;height:6px;background:#6b6488;border:2px solid #0009;border-top:0;border-radius:0 0 3px 3px}\n.hammer{position:absolute;left:48px;top:-14px;width:44px;height:50px;transform-origin:22px 50px;animation:hammer .7s cubic-bezier(.55,0,.45,1) infinite}\n.hammer .head{position:absolute;left:2px;top:0;width:40px;height:18px;background:linear-gradient(#e9e6f7,#a8a1c6);border:2.5px solid #0009;border-radius:5px;z-index:1}\n.hammer .handle{position:absolute;left:18px;top:14px;width:8px;height:36px;background:#ffb86b;border:2px solid #0009;border-radius:4px}\n.spark{position:absolute;left:28px;bottom:16px;color:var(--yellow);font-size:16px;opacity:0;animation:spark .7s infinite}\n.spark.s2{color:#ff9f43;animation-name:spark2}\n.spark.s3{color:#fff;animation-name:spark3}\n.working{margin-left:8px;color:var(--yellow);font-family:Fredoka,\"PingFang TC\",sans-serif;font-weight:600;font-size:15px;animation:bob .7s infinite}\n@keyframes hammer{0%{transform:rotate(15deg)}45%{transform:rotate(32deg)}70%{transform:rotate(-90deg)}80%{transform:rotate(-82deg)}100%{transform:rotate(15deg)}}\n@keyframes anvil{0%,69%{transform:none}74%{transform:translateY(2px) scaleX(1.05)}88%,100%{transform:none}}\n@keyframes spark{0%,69%{opacity:0;transform:none}73%{opacity:1}100%{opacity:0;transform:translate(-18px,-16px) scale(.6)}}\n@keyframes spark2{0%,69%{opacity:0;transform:none}73%{opacity:1}100%{opacity:0;transform:translate(4px,-22px) scale(.6)}}\n@keyframes spark3{0%,69%{opacity:0;transform:none}73%{opacity:1}100%{opacity:0;transform:translate(-30px,-4px) scale(.5)}}\n@keyframes bob{75%{transform:translateY(2px)}}\n.st-time{font-family:\"JetBrains Mono\",monospace;font-size:13px;font-weight:600;color:var(--muted)}\n.st.running .st-time{color:var(--blue);animation:bob 1s infinite}\n\n/* gift box thrown out when done */\n.gift{display:none;position:relative;width:64px;height:60px;margin-left:16px;flex:none;cursor:pointer;text-decoration:none}\n.cursor-ln.gift-ready{min-height:96px}\n.cursor-ln.gift-ready .gift{display:inline-block;animation:giftOut .9s cubic-bezier(.3,1.5,.5,1) both,giftWiggle 1.8s 1.2s ease-in-out infinite}\n.gift .box{position:absolute;left:6px;bottom:0;width:52px;height:36px;background:var(--red);border:2.5px solid #0009;border-radius:6px;\n  background-image:linear-gradient(90deg,transparent 21px,var(--yellow) 21px,var(--yellow) 31px,transparent 31px)}\n.gift .lid{position:absolute;left:2px;bottom:33px;width:60px;height:14px;background:#ff7b7f;border:2.5px solid #0009;border-radius:5px;z-index:1;\n  background-image:linear-gradient(90deg,transparent 23px,var(--yellow) 23px,var(--yellow) 33px,transparent 33px);transition:transform .45s cubic-bezier(.3,1.6,.5,1)}\n.gift .bow{position:absolute;top:-14px;width:18px;height:14px;background:var(--yellow);border:2.5px solid #0009;border-radius:50% 50% 10% 50%}\n.gift .bow.l{left:12px;transform:rotate(-20deg)}\n.gift .bow.r{right:12px;transform:scaleX(-1) rotate(-20deg)}\n.gift-tag{position:absolute;left:72px;bottom:10px;white-space:nowrap;background:var(--yellow);color:var(--ink);font-family:Fredoka,\"PingFang TC\",sans-serif;\n  font-weight:700;font-size:14px;padding:4px 12px;border-radius:99px;border:2.5px solid #0009;animation:bob 1s infinite}\n.gift:hover .lid{transform:translateY(-6px) rotate(-6deg)}\n.gift.opened{animation:none}\n.gift.opened .lid{transform:translate(18px,-30px) rotate(35deg)}\n.gift.opened .gift-tag{background:var(--green)}\n@keyframes giftOut{0%{transform:translate(-60px,70px) scale(.2) rotate(-90deg);opacity:0}50%{transform:translate(0,-46px) scale(1.15) rotate(15deg);opacity:1}\n  70%{transform:translate(0,0) scale(1.1,.85)}85%{transform:translateY(-10px) scale(.97,1.04)}100%{transform:none}}\n@keyframes giftWiggle{0%,70%,100%{transform:rotate(0)}76%{transform:rotate(-8deg)}82%{transform:rotate(7deg)}88%{transform:rotate(-4deg)}94%{transform:rotate(2deg)}}\n\n\n/* ===== Christmas ===== */\n.lk{overflow-x:clip}\n.lk{position:relative}\n.lights{position:absolute;top:0;left:0;right:0;height:90px;pointer-events:none;z-index:5}\n.lights svg{position:absolute;inset:0 auto auto 0;overflow:visible}\n.lights path{fill:none;stroke:#2f5d3a;stroke-width:3;stroke-linecap:round}\n.bulb{position:absolute;width:12px;height:18px;margin-left:-6px;border-radius:50% 50% 50% 50%/60% 60% 40% 40%;background:var(--c);\n  border:2px solid #0006;transform-origin:50% 0;animation:twinkle 1.4s ease-in-out infinite alternate}\n.bulb:before{content:\"\";position:absolute;top:-6px;left:1px;width:6px;height:6px;background:#2f5d3a;border-radius:2px}\n@keyframes twinkle{from{opacity:.45;box-shadow:none;filter:saturate(.7)}to{opacity:1;box-shadow:0 0 12px 3px var(--c);filter:none}}\n.orn{position:absolute;width:2px;height:22px;background:#2f5d3a;transform-origin:50% 0;animation:swing 3s ease-in-out infinite alternate}\n.orn i{position:absolute;top:20px;left:-10px;width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff9 0 4px,var(--c) 5px);border:2.5px solid var(--line)}\n.orn i:before{content:\"\";position:absolute;top:-7px;left:5px;width:8px;height:6px;background:#ffc93c;border:2px solid var(--line);border-radius:2px}\n@keyframes swing{from{transform:rotate(-8deg)}to{transform:rotate(8deg)}}\n\n/* santa hat on the buddy */\n.hat{position:absolute;left:10px;top:-24px;width:40px;height:26px;background:#e63946;border:3px solid var(--line);border-bottom:0;\n  border-radius:60% 40% 0 0/100% 100% 0 0;transform:rotate(-14deg);z-index:2}\n.hat:after{content:\"\";position:absolute;left:-7px;right:-7px;bottom:-6px;height:11px;background:#fff;border:3px solid var(--line);border-radius:8px}\n.hat .pom{position:absolute;right:-12px;top:-6px;width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid var(--line)}\n\n/* floor scene */\n.floor{position:relative;display:flex;align-items:flex-end;justify-content:flex-end;gap:14px;height:230px;margin-top:8px;padding:0 24px 22px}\n.floor:after{content:\"\";position:absolute;left:calc(50% - 50vw);width:100vw;bottom:0;height:30px;background:#fff;border-top:3px solid var(--line);\n  border-radius:50% 50% 0 0/26px 26px 0 0;z-index:0}\n.gifts{display:flex;align-items:flex-end;gap:8px;position:relative;z-index:2;margin-bottom:-6px}\n.fg{position:relative;display:block;background:var(--c);border:2.5px solid var(--line);border-radius:5px;\n  background-image:linear-gradient(90deg,transparent calc(50% - 4px),var(--r) calc(50% - 4px),var(--r) calc(50% + 4px),transparent calc(50% + 4px));\n  box-shadow:3px 3px 0 var(--line);animation:dropIn .9s cubic-bezier(.3,1.5,.5,1) both}\n.fg.still{animation:none}\n.fg-lid{position:absolute;left:-5px;right:-5px;top:-4px;height:10px;background:var(--c);border:2.5px solid var(--line);border-radius:4px;filter:brightness(1.12)}\n.fg-bow{position:absolute;left:50%;top:-16px;width:18px;height:12px;margin-left:-9px;border:3px solid var(--r);border-radius:50% 50% 10% 10%;\n  filter:drop-shadow(0 0 0 var(--line))}\n@keyframes dropIn{0%{transform:translateY(-260px) rotate(-25deg);opacity:0}55%{transform:translateY(0) rotate(4deg);opacity:1}\n  70%{transform:translateY(-14px) scale(1.04,.96)}85%{transform:translateY(0) scale(.98,1.02)}100%{transform:none}}\n\n.tree{position:relative;width:160px;height:206px;z-index:1;flex:none}\n.leaves{position:absolute;inset:0;filter:drop-shadow(3px 0 0 var(--line)) drop-shadow(-3px 0 0 var(--line)) drop-shadow(0 3px 0 var(--line)) drop-shadow(0 -3px 0 var(--line))}\n.layer{position:absolute;left:50%;transform:translateX(-50%);background:#2f9e5b;clip-path:polygon(50% 0,100% 100%,0 100%)}\n.layer.t1{top:20px;width:74px;height:60px}\n.layer.t2{top:52px;width:116px;height:74px;background:#2a8f52}\n.layer.t3{top:92px;width:158px;height:88px;background:#26834b}\n.trunk{position:absolute;left:50%;bottom:4px;width:28px;height:28px;margin-left:-14px;background:#8b5a2b;border:3px solid var(--line);border-top:0;border-radius:0 0 4px 4px}\n.star{position:absolute;left:50%;top:-14px;transform:translateX(-50%);font-size:36px;color:#ffc93c;z-index:3;\n  -webkit-text-stroke:2px var(--line);animation:starGlow 2s ease-in-out infinite}\n@keyframes starGlow{50%{text-shadow:0 0 18px #ffe066;transform:translateX(-50%) scale(1.12) rotate(8deg)}}\n.ball{position:absolute;width:15px;height:15px;border-radius:50%;border:2.5px solid var(--line);z-index:2;\n  background:radial-gradient(circle at 35% 35%,#fff9 0 3px,var(--bc) 4px)}\n.b1{--bc:#ff5a5f;left:62px;top:62px}.b2{--bc:#4d96ff;left:44px;top:110px}.b3{--bc:#ffc93c;left:96px;top:100px}\n.b4{--bc:#9b5de5;left:30px;top:152px}.b5{--bc:#ff5a5f;left:112px;top:146px}\n.tl{position:absolute;width:7px;height:7px;border-radius:50%;background:#fff6c2;z-index:2;animation:twinkle 1.1s ease-in-out infinite alternate;--c:#ffe066}\n.l1{left:84px;top:44px}.l2{left:70px;top:90px;animation-delay:.3s}.l3{left:82px;top:126px;animation-delay:.6s}\n.l4{left:60px;top:166px;animation-delay:.2s}.l5{left:100px;top:168px;animation-delay:.8s}.l6{left:126px;top:122px;animation-delay:.5s}\n\n@media (max-width:640px){\n  .wrap{padding-top:70px}\n  .floor{padding:0 8px 22px;height:210px}\n  .tree{transform:scale(.85);transform-origin:bottom right}\n}\n\n/* ---- idle Santa (before work starts) ---- */\n.santa,.santa-say{display:none}\n.cursor-ln.idle{min-height:104px}\n.cursor-ln.idle .santa{display:inline-block;position:relative;width:62px;height:76px;margin-left:14px;flex:none;animation:santaHop 2.4s ease-in-out infinite;transform-origin:50% 100%}\n.cursor-ln.idle .santa-say{display:inline-block;position:relative;margin:0 0 34px 12px;padding:7px 13px;background:#fff;color:#2b2233;border:2.5px solid #0009;border-radius:16px;\n  font:600 15px Fredoka,\"PingFang TC\",sans-serif;white-space:nowrap;animation:sayPop .5s cubic-bezier(.3,1.6,.5,1) both,bob 2.4s 1s ease-in-out infinite}\n.santa-say:before{content:\"\";position:absolute;left:-11px;bottom:8px;border:7px solid transparent;border-right:9px solid #0009}\n.santa-say:after{content:\"\";position:absolute;left:-6px;bottom:9px;border:6px solid transparent;border-right:7px solid #fff}\n.s-hat{position:absolute;left:12px;top:0;width:0;height:0;border-left:19px solid transparent;border-right:19px solid transparent;border-bottom:26px solid var(--red);transform:rotate(14deg);transform-origin:50% 100%;filter:drop-shadow(0 0 1.5px #000a)}\n.s-pom{position:absolute;left:4px;top:-6px;width:11px;height:11px;border-radius:50%;background:#fff;border:2px solid #0008}\n.s-brim{position:absolute;left:7px;top:22px;width:48px;height:11px;border-radius:7px;background:#fff;border:2.5px solid #0009;z-index:2}\n.s-face{position:absolute;left:12px;top:29px;width:38px;height:26px;border-radius:12px 12px 8px 8px;background:#ffd9c2;border:2.5px solid #0009;z-index:1}\n.s-eye{position:absolute;top:8px;width:5px;height:6px;border-radius:50%;background:#2b2233;animation:blink 3.6s infinite}\n.s-eye.l{left:9px}.s-eye.r{right:9px}\n.s-cheek{position:absolute;top:14px;width:7px;height:4px;border-radius:50%;background:#ff8a8a}\n.s-cheek.l{left:3px}.s-cheek.r{right:3px}\n.s-beard{position:absolute;left:6px;top:45px;width:50px;height:30px;background:#fff;border:2.5px solid #0009;border-radius:10px 10px 26px 26px;z-index:2}\n.s-mouth{position:absolute;left:18px;top:2px;width:10px;height:6px;border-radius:0 0 8px 8px;background:#c0392b}\n@keyframes santaHop{0%,100%{transform:translateY(0) rotate(0)}40%{transform:translateY(-5px) rotate(-4deg)}60%{transform:translateY(-5px) rotate(4deg)}}\n@keyframes sayPop{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}\n\n.lk-hint{background:#fff;border:3px solid #2b2340;border-radius:14px;padding:10px 14px;font-size:14px;box-shadow:0 4px 0 #2b2340}\n";
  const HTML = "\n<div class=\"lights\" id=\"lights\" aria-hidden=\"true\"></div>\n<main class=\"wrap\">\n  <div id=\"lkHint\" class=\"lk-hint\" hidden>尚未連線：請在 Mac 執行 <b>START_LUKA_FILM.command</b>（工具更新過，要重新啟動一次），啟動後這裡會自動連上。若瀏覽器跳出「連線到本機網路裝置」，請按<b>允許</b>。</div>\n  <header class=\"top\">\n    <div class=\"logo\"><span class=\"logo-mark\">L</span>Luka Film</div>\n    <div class=\"conn\"><i id=\"connDot\"></i><span id=\"connText\">連線中</span></div>\n  </header>\n\n  <!-- INPUT -->\n  <section class=\"card input\">\n    <div class=\"pickers\">\n      <button class=\"pick\" data-kind=\"video\">\n        <span class=\"pick-icon\">🎬</span>\n        <span class=\"pick-text\"><b>影片</b><small id=\"videoName\">點我選擇 MXF</small></span>\n      </button>\n      <button class=\"pick\" data-kind=\"reference\">\n        <span class=\"pick-icon\">📄</span>\n        <span class=\"pick-text\"><b>日文原稿</b><small id=\"refName\">點我選擇 CSV</small></span>\n      </button>\n    </div>\n    <button id=\"goBtn\" class=\"go\">▶ 開始</button>\n    <button id=\"stopBtn\" class=\"stop\" hidden>■ 停止</button>\n  </section>\n\n  <!-- STEP TRACK -->\n  <section class=\"track\">\n    <div class=\"rail\"><span id=\"railFill\"></span></div>\n    <div class=\"stations\" id=\"stations\"></div>\n    <div class=\"buddy\" id=\"buddy\">\n      <div class=\"bubble\" id=\"bubble\">嗨！</div>\n      <div class=\"body\"><span class=\"hat\"><i class=\"pom\"></i></span><span class=\"eye l\"></span><span class=\"eye r\"></span><span class=\"mouth\"></span><div class=\"feet\"><span></span><span></span></div></div>\n    </div>\n  </section>\n\n  <!-- TERMINAL -->\n  <section class=\"term\">\n    <div class=\"term-bar\">\n      <span class=\"dots\"><i></i><i></i><i></i></span>\n      <span class=\"term-title\">luka@mac ~ log</span>\n      <button id=\"copyBtn\" class=\"mini\">複製</button>\n    </div>\n    <div class=\"term-body\" id=\"termBody\"></div>\n  </section>\n\n  <!-- FLOOR: tree + gifts (one per finished step) -->\n  <section class=\"floor\" aria-hidden=\"true\">\n    <div class=\"gifts\" id=\"gifts\"></div>\n    <div class=\"tree\">\n      <span class=\"star\">★</span>\n      <div class=\"leaves\">\n        <span class=\"layer t1\"></span><span class=\"layer t2\"></span><span class=\"layer t3\"></span>\n      </div>\n      <span class=\"trunk\"></span>\n      <i class=\"ball b1\"></i><i class=\"ball b2\"></i><i class=\"ball b3\"></i><i class=\"ball b4\"></i><i class=\"ball b5\"></i>\n      <i class=\"tl l1\"></i><i class=\"tl l2\"></i><i class=\"tl l3\"></i><i class=\"tl l4\"></i><i class=\"tl l5\"></i><i class=\"tl l6\"></i>\n    </div>\n  </section>\n\n  <div class=\"toast\" id=\"toast\" hidden></div>\n</main>\n";
  function LukaMain(R, LK, API) {
  'use strict';
  const $ = id => R.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const base = p => (p || '').split('/').pop();
  const STEPS = [
    {icon:'👂', name:'聽日文'},
    {icon:'🔍', name:'對原稿'},
    {icon:'⏱️', name:'填時間'},
  ];
  const LABEL = {pending:'等待', running:'進行中', complete:'完成', review:'待確認', error:'出錯', interrupted:'中斷', waiting:'等待'};
  const CURSOR = `<div class="ln cursor-ln" id="cursorLn"><span class="msg">$ <span class="cursor"></span></span>
    <span class="forge"><span class="hammer"><i class="head"></i><i class="handle"></i></span><span class="anvil"></span>
    <span class="spark s1">✦</span><span class="spark s2">✦</span><span class="spark s3">✧</span></span><span class="working">敲敲打打中…</span>
    <span class="santa"><span class="s-hat"><i class="s-pom"></i></span><span class="s-brim"></span><span class="s-face"><i class="s-eye l"></i><i class="s-eye r"></i><i class="s-cheek l"></i><i class="s-cheek r"></i></span><span class="s-beard"><i class="s-mouth"></i></span></span><span class="santa-say" id="santaSay">準備好影片了嗎？</span>
    <a class="gift" id="gift" title="在 Finder 打開字幕資料夾"><span class="lid"><i class="bow l"></i><i class="bow r"></i></span><span class="box"></span><span class="gift-tag">🎁 打開字幕資料夾</span></a></div>`;
  let lastRun;
  let state = null, connected = false, shownLogs = 0, lastSeq = null, celebrated = false;

  function toast(msg, err = false) {
    const t = $('toast'); t.hidden = false; t.textContent = msg; t.classList.toggle('err', err);
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 3200);
  }

  function ring(progress, status) {
    const r = 33, c = 2 * Math.PI * r, off = c * (1 - Math.min(100, progress || 0) / 100);
    const color = {complete:'#3ddc97', review:'#ffc93c', error:'#ff5a5f', interrupted:'#ff5a5f'}[status] || '#4d96ff';
    return `<svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="${r}" stroke="${color}" stroke-dasharray="${c}" stroke-dashoffset="${off}"/></svg>`;
  }

  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  }
  function dur(p) {
    if (!p.started_at) return '⏱ --:--';
    const end = p.ended_at || (p.status === 'running' ? Date.now() / 1000 : p.started_at);
    return `⏱ ${fmt(end - p.started_at)}`;
  }

  function renderTrack() {
    const ph = state.phases;
    $('stations').innerHTML = ph.map((p, i) => `
      <div class="st ${esc(p.status)}">
        <div class="st-dot">${ring(p.progress, p.status)}${STEPS[i].icon}</div>
        <b>${STEPS[i].name}</b>
        <small>${p.status === 'running' ? `${Math.round(p.progress || 0)}%` : (LABEL[p.status] || p.status)}</small>
        <span class="st-time">${dur(p)}</span>
      </div>`).join('');
    const total = ph.reduce((s, p) => s + (Number(p.progress) || 0), 0) / 3;
    $('railFill').style.width = `${Math.min(100, Math.max(0, (total - 33.3) * 1.5))}%`;

    let idx = ph.findIndex(p => ['running', 'error', 'interrupted'].includes(p.status));
    if (idx < 0) { const last = ph.map(p => p.status !== 'pending').lastIndexOf(true); idx = Math.max(0, last); }
    const p = ph[idx], allDone = ph.every(x => x.status === 'complete' || x.status === 'review');
    const buddy = $('buddy');
    buddy.style.left = `${16.6 + idx * 33.3}%`;
    let mood = 'idle', say = '選好檔案就按開始！';
    if (state.running) { mood = 'work'; say = ['努力聽中…', '逐句比對中…', '填時間中…'][idx]; }
    else if (state.error || ['error', 'interrupted'].includes(p.status)) { mood = 'oops'; say = '哎呀，看下面 Log'; }
    else if (allDone) {
      mood = 'done';
      const n = state.job?.alignment_summary?.review;
      say = n ? `完成！${n} 句待確認` : '全部完成！';
      if (!celebrated && lastSeq !== null) confetti();
      celebrated = true;
    } else if (!state.config?.video) say = '先選影片 🎬';
    if (!allDone) celebrated = false;
    buddy.className = `buddy ${mood}`;
    $('bubble').textContent = say;
  }

  function renderLogs() {
    const logs = state.logs || [];
    const body = $('termBody');
    if (state.run_id !== lastRun || logs.length < shownLogs) { body.innerHTML = ''; shownLogs = 0; lastRun = state.run_id; }
    const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 60;
    if (logs.length > shownLogs) body.querySelector('.ph')?.remove();
    let cur = $('cursorLn');
    if (!cur) { body.insertAdjacentHTML('beforeend', CURSOR); cur = $('cursorLn'); }
    const fresh = logs.slice(shownLogs).filter(e => !/^=+$/.test(e.message.trim()));
    const start = Math.max(0, fresh.length - 200);
    cur.insertAdjacentHTML('beforebegin', fresh.slice(start).map(e => {
      const ph = Number(e.phase) || 0;
      let raw = e.message;
      for (const k of ['video', 'reference']) { const f = state.config?.[k]; if (f) raw = raw.split(f).join(base(f)); }
      const msg = raw.replace(/^\[STEP \d\/3\]\s*/, '').replace(/(?:~|\/)[^\s:]*\/([^\/\s]+\.[A-Za-z0-9]+)/g, '$1');
      return `<div class="ln ${esc(e.level)}"><span class="tag s${ph}">${ph ? 'STEP ' + ph : 'SYS'}</span><span class="msg">${esc(msg)}</span></div>`;
    }).join(''));
    shownLogs = logs.length;
    while (body.children.length > 400) body.firstElementChild.remove();
    cur.classList.toggle('busy', !!state.running);
    const ph = state.phases || [];
    const srt = srtLink();
    const ready = !state.running && ph.length && ph.every(p => p.status === 'complete' || p.status === 'review') && !!srt;
    const gift = $('gift');
    if (ready && gift.dataset.srt !== srt) { gift.dataset.srt = srt; gift.classList.remove('opened'); }
    if (ready && !cur.classList.contains('gift-ready')) body.scrollTop = body.scrollHeight;
    cur.classList.toggle('gift-ready', !!ready);
    const idle = !state.running && !ready;
    cur.classList.toggle('idle', idle);
    if (idle) { const c = state.config || {}; $('santaSay').textContent = c.video && c.reference ? '準備好了嗎？按 ▶ 開始！' : '準備好影片了嗎？'; }
    if (body.children.length === 1) cur.insertAdjacentHTML('beforebegin', '<div class="ln ph"><span class="tag s0">SYS</span><span class="msg">等待開始…</span></div>');
    if (atBottom || fresh.length) body.scrollTop = body.scrollHeight;
  }

  function renderInput() {
    const v = state.config?.video, r = state.config?.reference;
    $('videoName').textContent = v ? base(v) : '點我選擇 MXF';
    $('refName').textContent = r ? base(r) : '點我選擇 CSV';
    R.querySelector('[data-kind=video]').classList.toggle('ok', !!v);
    R.querySelector('[data-kind=reference]').classList.toggle('ok', !!r);
    R.querySelectorAll('.pick').forEach(b => b.disabled = !!state.running);
    $('goBtn').hidden = !!state.running;
    $('goBtn').disabled = !(v && r);
    $('stopBtn').hidden = !state.running;
  }

  function srtLink() {
    return state.job?.final_srt || '';
  }


  function confetti() {
    const colors = ['#ff5a5f', '#ffc93c', '#3ddc97', '#4d96ff', '#9b5de5'];
    for (let i = 0; i < 60; i++) {
      const c = document.createElement('i');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = 1.8 + Math.random() * 1.6 + 's';
      c.style.animationDelay = Math.random() * .4 + 's';
      LK.appendChild(c);
      setTimeout(() => c.remove(), 4000);
    }
  }

  // ---- Christmas: string lights with a few hanging ornaments ----
  function buildLights() {
    const el = $('lights'), W = (LK.clientWidth || innerWidth), span = 140, top = 4, sag = 46;
    const n = Math.max(2, Math.round(W / span)), step = W / n, colors = ['#ff5a5f', '#ffc93c', '#3ddc97', '#4d96ff'];
    let d = `M0 ${top}`, html = '', k = 0;
    for (let i = 0; i < n; i++) {
      const x0 = i * step, x1 = x0 + step, xm = x0 + step / 2;
      d += ` Q${xm} ${top + sag} ${x1} ${top}`;
      for (const t of [0.3, 0.7]) {
        const x = x0 + t * step, y = (1 - t) ** 2 * top + 2 * t * (1 - t) * (top + sag) + t * t * top;
        html += `<span class="bulb" style="left:${x}px;top:${y}px;--c:${colors[k % 4]};animation-delay:${(k % 4) * .35}s"></span>`;
        k++;
      }
      if (i % 3 === 1 && i < n - 1) {
        html += `<span class="orn" style="left:${x1 - 1}px;top:${top}px;--c:${colors[(i + 1) % 4]};animation-delay:${i * .3}s"><i></i></span>`;
      }
    }
    el.innerHTML = `<svg width="${W}" height="${top + sag}"><path d="${d}"/></svg>${html}`;
  }
  buildLights();
  let lt; const onRs = () => { clearTimeout(lt); lt = setTimeout(buildLights, 150); }; addEventListener('resize', onRs);

  // ---- Floor gifts: one per finished step ----
  const GIFT_STYLE = [['#ff5a5f', '#ffc93c', 46, 38], ['#4d96ff', '#ffffff', 38, 30], ['#3ddc97', '#ff5a5f', 54, 44]];
  let giftCount = -1;
  function renderGifts() {
    const n = (state.phases || []).filter(p => p.status === 'complete' || p.status === 'review').length;
    if (n === giftCount) return;
    const box = $('gifts');
    if (n < giftCount || giftCount < 0) box.innerHTML = '';
    for (let i = box.children.length; i < n; i++) {
      const [c, r, w, h] = GIFT_STYLE[i % 3];
      box.insertAdjacentHTML('beforeend', `<span class="fg${giftCount < 0 ? ' still' : ''}" style="--c:${c};--r:${r};width:${w}px;height:${h}px"><i class="fg-lid"></i><i class="fg-bow"></i></span>`);
    }
    giftCount = n;
  }

  async function poll() {
    try {
      const r = await fetch(API + '/api/state', {cache: 'no-store'});
      if (!r.ok) throw Error();
      state = await r.json(); connected = true;
      $('connDot').classList.add('on'); $('lkHint').hidden = true;
      $('connText').textContent = state.running ? '處理中' : '本機已連線';
      renderInput(); renderTrack(); renderLogs(); renderGifts();
      lastSeq = state.seq;
      if (!LK.classList.contains('ready')) requestAnimationFrame(() => requestAnimationFrame(() => LK.classList.add('ready')));
    } catch {
      connected = false;
      $('connDot').classList.remove('on'); $('lkHint').hidden = false;
      $('connText').textContent = '未連線';
    }
  }

  async function api(path, data = {}) {
    if (!connected) throw Error('請先啟動 START_LUKA_FILM.command');
    const r = await fetch(API + path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
    const v = await r.json();
    if (!r.ok || !v.ok) throw Error(v.error || '失敗');
    return v;
  }
  const act = (fn, ok) => async () => { try { await fn(); if (ok) toast(ok); await poll(); } catch (e) { toast(e.message || String(e), true); } };

  R.querySelectorAll('.pick').forEach(b => b.addEventListener('click',
    act(() => api('/api/select', {kind: b.dataset.kind}))));
  $('goBtn').addEventListener('click', act(async () => {
    await api('/api/preflight');
    await api('/api/start');
  }, '出發！🚀'));
  $('stopBtn').addEventListener('click', act(() => api('/api/stop'), '已停止，進度有保存'));
  R.addEventListener('click', e => {
    const g = e.target.closest('#gift');
    if (!g || !g.dataset.srt) return;
    e.preventDefault();
    api('/api/reveal').then(r => { g.classList.add('opened'); confetti(); toast('已打開資料夾：' + r.name + ' 📂'); })
      .catch(err => toast(err.message || '打不開字幕', true));
  });
  $('copyBtn').addEventListener('click', async () => {
    const txt = (state?.logs || []).map(e => `${e.time} [${e.phase ? 'STEP ' + e.phase : 'SYS'}] ${e.message}`).join('\n');
    try { await navigator.clipboard.writeText(txt); toast('Log 已複製'); } catch { toast('複製失敗', true); }
  });

  poll(); const iv = setInterval(poll, 1000); setTimeout(buildLights, 60);
  return () => { clearInterval(iv); removeEventListener('resize', onRs); };
}

  let cur = null;
  function open() {
    if (cur) return;
    if (!document.getElementById("luka-font")) { const l = document.createElement("link"); l.id = "luka-font"; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap"; document.head.appendChild(l); }
    const host = document.createElement("div"); host.className = "luka-host";
    host.style.cssText = "position:fixed;inset:0;z-index:90;overflow:auto;background:#fff7ec;overscroll-behavior:contain";
    const sh = host.attachShadow({ mode: "open" });
    sh.innerHTML = `<style>${CSS}</style><div class="lk" id="lk">${HTML}</div>`;
    const x = document.createElement("button"); x.type = "button"; x.textContent = "✕ 關閉"; x.setAttribute("aria-label", "關閉 Luka Film 工具");
    x.style.cssText = "position:fixed;top:14px;right:16px;z-index:2;border:3px solid #2b2340;background:#ff5a5f;color:#fff;font:700 15px system-ui,sans-serif;padding:8px 16px;border-radius:999px;cursor:pointer;box-shadow:0 3px 0 #2b2340";
    sh.appendChild(x); document.body.appendChild(host); document.body.classList.add("robot-open");
    const stop = LukaMain(sh, sh.getElementById("lk"), API);
    const kd = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };
    const close = () => { stop(); host.remove(); document.body.classList.remove("robot-open"); window.removeEventListener("keydown", kd, true); cur = null; };
    window.addEventListener("keydown", kd, true); x.addEventListener("click", close); cur = { close };
  }
  window.LukaTool = { open };
})();
