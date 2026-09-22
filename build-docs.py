from pathlib import Path
import re, json, html
P=Path(__file__).parent
ids=['jelly','kitchen','bubble','magnet','hockey','racer']
posts=[]
for key in ids:
    raw=(P/f'docs/{key}.md').read_text(encoding='utf-8')
    title=raw.splitlines()[0].lstrip('# ')
    sections=re.split(r'^##\s+(.+)$',raw,flags=re.M)
    blocks={sections[i]:sections[i+1].strip() for i in range(1,len(sections),2)}
    tweet=next(v for k,v in blocks.items() if '推文' in k).replace('**','')
    prompt=next(v for k,v in blocks.items() if '提示词' in k)
    prompt=re.sub(r'^```(?:text)?\n|\n```$','',prompt).strip()
    posts.append({'id':key,'title':title,'tweet':tweet,'prompt':prompt})
intro='把小时候的街机快乐，做成了一整个浏览器游戏厅。\n\n这次一口气做了 6 款：\n🟢 果冻擂台：撞朋友出圈\n🍜 午夜外卖：双人接力出餐\n🫧 泡泡爆破：连锁爆破整活\n🧲 磁力双星：同步开机关收星\n🏒 霓虹气垫球：60 秒攻防\n🏎️ 微缩拉力赛：氮气超车\n\n同屏双人、单人陪练都能玩，还加了同一 Wi-Fi 的手机手柄。\n\n源码和制作提示词都整理好了。你最想拉谁来开一局？'
posts.insert(0,{'id':'collection','title':'合集推文','tweet':intro,'prompt':''})
(P/'docs/publish.json').write_text(json.dumps(posts,ensure_ascii=False,indent=2),encoding='utf-8')
md='# 街机口袋 · 推文与完整复现提示词\n\n所有推文为可复制草稿，未发布。六款为已实现的原创浏览器小游戏，手机手柄限定同一 Wi-Fi，没有公网游戏服务。\n\n'
for item in posts:
    md+=f'## {item["title"]}\n\n{item["tweet"]}\n\n'
    if item['prompt']:md+='### 制作提示词\n\n```text\n'+item['prompt']+'\n```\n\n'
(P/'推文与复现提示词.md').write_text(md,encoding='utf-8')
cards=[]
for i,item in enumerate(posts):
    play=f'<a href="../play.html?game={item["id"]}">试玩这款 ↗</a>' if i else '<a href="../index.html">回到大厅 ↗</a>'
    prompt=f'<details><summary>展开完整制作提示词</summary><pre id="prompt-{i}">{html.escape(item["prompt"])}</pre><button class="copy" data-kind="prompt" data-index="{i}">复制提示词</button></details>' if i else ''
    cards.append(f'<article class="post" id="{item["id"]}"><div class="post-top"><span>{i:02d} / {html.escape(item["title"])}</span>{play}</div><div class="tweet" id="tweet-{i}">{html.escape(item["tweet"])}</div><button class="copy" data-kind="tweet" data-index="{i}">复制推文</button>{prompt}</article>')
page='''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>推文与提示词 · 街机口袋</title><link rel="stylesheet" href="../style.css"><link rel="icon" href="../favicon.svg" type="image/svg+xml"><style>.publish{max-width:920px;margin:auto;padding:40px 24px}.publish h1{font-size:40px;letter-spacing:-1.5px;margin:20px 0 15px}.publish>.intro{font-size:14px;color:#62695d;line-height:1.9;max-width:700px}.jump{display:flex;gap:8px;flex-wrap:wrap;margin:25px 0}.jump a{padding:10px 13px;border:1px solid #ced2c3;border-radius:24px;font-size:12px}.post{background:#fffcf5;border:1px solid #d6dacd;border-radius:16px;padding:27px;margin:20px 0}.post-top{display:flex;justify-content:space-between;gap:15px;align-items:center;font-size:12px;font-weight:750;padding-bottom:20px;border-bottom:1px solid #e0e4d6}.post-top a{font-weight:500;color:#a74324}.tweet{white-space:pre-wrap;font-size:16px;line-height:1.95;padding:22px 0}.copy{background:#253021;border:0;border-radius:7px;padding:12px 20px;min-height:44px;color:#fff;font-size:12px}.post details{margin-top:22px;padding-top:20px;border-top:1px solid #e0e4d6}.post summary{cursor:pointer;font-size:13px;font-weight:700;min-height:30px}.post pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eef0e6;border-radius:10px;padding:18px;font:13px/1.85 "Microsoft YaHei",sans-serif}.publish>.foot{font-size:12px;line-height:1.9;color:#62695d}.publish>.foot a{text-decoration:underline}@media(max-width:540px){.publish h1{font-size:31px}.post{padding:20px}.tweet{font-size:14px}}</style></head><body><main class="publish"><a href="../index.html">← 回到游戏大厅</a><p class="eyebrow" style="margin-top:34px;color:#a54b2d">BUILD. PLAY. SHARE.</p><h1>作品做好了，<br>文案也备好了。</h1><p class="intro">一条合集推文，六条单款推文，六份完整制作提示词。直接复制后按自己的语气调整即可；这里不会自动发布。提示词可用于重新生成同类游戏，当前成品请使用源码包复现。</p>'''
page+='<nav class="jump" aria-label="文案目录">'+''.join(f'<a href="#{x["id"]}">{html.escape(x["title"])}</a>' for x in posts)+'</nav>'+''.join(cards)
page+='''<p class="foot">玩法参考：<a href="https://store.steampowered.com/app/3527290/PEAK/">PEAK 的多人协作方向</a>、<a href="https://www.nintendo.com/us/store/products/f-zero-99-switch/">F-ZERO 99 的复古竞速方向</a>及常见街机类型。这里是原创小型实现，不是原作移植，也没有实时热榜或真人在线人数宣称。</p></main><script src="publish.js" type="module"></script></body></html>'''
(P/'docs/publish.html').write_text(page,encoding='utf-8')
print('Built 7 tweets and 6 reproducible prompts.')
