# Builds client/src/data/career-path.json from careers.json and standings.json (see fetch-careers.py).
# Builds client/src/data/career-path.json: every PL player's season-by-season record,
# and the answer pools for the three daily tiers.
import json
REPO=__import__("os").path.abspath(__import__("os").path.join(__import__("os").path.dirname(__file__),"../.."))
C=json.load(open("careers.json"))
P={int(p["playerId"]):p for p in json.load(open(f"{REPO}/client/src/data/pl-players.json"))}
RENAME={"Boro":"Middlesbrough","Nott'm Forest":"Nottingham Forest","Sheff Weds":"Sheffield Wed","Spurs":"Tottenham"}
clubs=sorted({RENAME.get(r[0],r[0]) for p in C.values() for v in p["seasons"].values() for r in v})
ci={c:i for i,c in enumerate(clubs)}
players={}
for k,p in C.items():
    rows=[]
    for y,v in sorted(p["seasons"].items()):
        for c,a,g,ast in sorted(v,key=lambda r:-r[1]):
            rows.append([int(y),ci[RENAME.get(c,c)],a,g,ast])
    players[k]=rows
def windows(rows):
    by={}
    for y,c,a,g,ast in rows: by.setdefault(y,[]).append((c,a,g,ast))
    out=[]
    for y in sorted(by):
        w=[y+i for i in range(5)]
        if not all(x in by for x in w): continue
        cl={r[0] for x in w for r in by[x]}
        apps=sum(r[1] for x in w for r in by[x]); ga=sum(r[2]+r[3] for x in w for r in by[x])
        if len(cl)>=2 and apps>=100: out.append((ga,y))
    return out
tiers={"easy":[],"medium":[],"hard":[]}
for k,rows in players.items():
    pp=P[int(k)]
    if "Goalkeeper" in pp.get("position",""): continue
    W=windows(rows)
    if not W: continue
    ga,start=max(W)
    apps,goals=pp["totalAppearances"],pp["totalGoals"]
    if apps>=200 and goals>=50 and ga>=35: tiers["easy"].append([int(k),start])
    elif apps>=200 and ga>=20: tiers["medium"].append([int(k),start])
    elif apps>=150 and ga>=10: tiers["hard"].append([int(k),start])
json.dump({"clubs":clubs,"players":players,"tiers":tiers},open(f"{REPO}/client/src/data/career-path.json","w"),separators=(",",":"))
import os
print({t:len(v) for t,v in tiers.items()}, "size KB",os.path.getsize(f"{REPO}/client/src/data/career-path.json")//1024)
for t in tiers:
    import random; random.seed(1); s=random.sample(tiers[t],8); print(t,[P[i]["displayName"]+f" {y}" for i,y in s])

# --- Difficulty tiers (overwrites tiers above) ---
import json,math,random
REPO=__import__("os").path.abspath(__import__("os").path.join(__import__("os").path.dirname(__file__),"../.."))
C=json.load(open("careers.json")); ST={int(k):v for k,v in json.load(open("standings.json")).items()}
P={int(p["playerId"]):p for p in json.load(open(f"{REPO}/client/src/data/pl-players.json"))}
NOW=2026
def broad(pos): return "GK" if "Goalkeeper" in pos else "DEF" if ("Back" in pos or "Defender" in pos) else "FWD" if ("Forward" in pos or "Striker" in pos) else "MID"
cands=[]
for k,p in C.items():
    pp=P[int(k)]; pos=broad(pp.get("position",""))
    if pos=="GK" or pp["totalAppearances"]<100: continue
    S={int(y):v for y,v in p["seasons"].items()}
    best=None
    for y in sorted(S):
        w=[y+i for i in range(5)]
        if not all(x in S for x in w): continue
        rows=[(x,r) for x in w for r in S[x]]
        apps=sum(r[1] for _,r in rows); ga=sum(r[2]+r[3] for _,r in rows); goals=sum(r[2] for _,r in rows)
        if apps<75: continue
        strength=sum(r[1]*(21-ST.get(x,{}).get(r[0],15))/20 for x,r in rows)/apps
        clubs=len({r[0] for _,r in rows})
        yrs=NOW-(y+4)
        F=1.25*math.log1p(ga)+0.012*apps+2.0*strength+0.6*math.log(pp["totalAppearances"])+{"FWD":0.5,"MID":0.2,"DEF":0}[pos]-0.075*yrs+(0.25 if clubs>1 else 0)
        if best is None or F>best[0]: best=(F,y,apps,ga,goals,strength,clubs,yrs)
    if best: cands.append((best[0],int(k),best[1:],pp["displayName"],pos))
cands.sort(reverse=True)
SIZES=[70,120,180,240,300]
tiers=[];i=0
for n in SIZES: tiers.append(cands[i:i+n]); i+=n
print("eligible",len(cands),"used",i)
random.seed(4)
for t,T in enumerate(tiers,1):
    s=random.sample(T,10)
    print(f"T{t} F {T[-1][0]:.2f}-{T[0][0]:.2f}")
    for F,k,(y,apps,ga,goals,st,cl,yrs),n,pos in s: print(f"    {n:<24} {pos} {y}-{str(y+5)[2:]} apps{apps:>4} G+A{ga:>4} str{st:.2f} clubs{cl}")
json.dump([[[k,b[0]] for F,k,b,n,pos in T] for T in tiers],open("tiers_out.json","w"))
d=json.load(open(f"{REPO}/client/src/data/career-path.json")); d["tiers"]=[[[k,b[0]] for F,k,b,n,pos in T] for T in tiers]
json.dump(d,open(f"{REPO}/client/src/data/career-path.json","w"),separators=(",",":"))
