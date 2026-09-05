"""Deterministic, offline PDF content import. No PDF parsing at request time."""
import argparse, hashlib, json, re
from pathlib import Path
from pypdf import PdfReader

TITLES=['Dijital Pazarlamanın Temelleri','Hedef Kitle ve Müşteri Analizi','Marka ve Konumlandırma','Sosyal Medya Stratejisi','İçerik Üretimi ve Metin Yazarlığı','İçerik Takvimi ve Yönetim','Meta Ads','Google Ads','SEO ve İçerik Pazarlaması','Satış Hunisi ve Dönüşüm','Analiz, Ölçüm ve Raporlama','Dijital Ajans Kurma ve Yönetme','Uygulamalı Vaka','Yapay Zekâ Destekli Dijital Pazarlama']
BOOK_START=[6,15,24,32,42,51,59,72,85,97,107,118,134,145,158]
WB_START=[7,14,22,29,44,51,56,64,76,90,98,106,127,134,139]

def clean(t):
 t=re.sub(r'DIJITAL PAZARLAMA UZMANLIĞI[^\n]*SAYFA \d+','',t)
 return t.strip()
def body(t): return clean(t).split('\n',1)[-1].strip()
def before_summary(t): return t.split('SAYFA ÖZETİ')[0].strip()
def save(path,data): path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')

def main():
 ap=argparse.ArgumentParser(); ap.add_argument('source',type=Path); args=ap.parse_args()
 out=Path('content/academy'); out.mkdir(parents=True,exist_ok=True)
 pages={}; sources=[]
 for key,name in [('book','dijital-pazarlama-uzmanligi-egitimi.pdf'),('workbook','Dijital-Pazarlama-Uzmanligi-Profesyonel-Workbook.pdf')]:
  path=args.source/name; raw=path.read_bytes(); reader=PdfReader(path)
  pages[key]=[clean(p.extract_text()) for p in reader.pages]
  sources.append({'id':key,'filename':name,'pages':len(reader.pages),'sha256':hashlib.sha256(raw).hexdigest()})
 modules=[{'id':i+1,'title':t} for i,t in enumerate(TITLES)]
 records=[]; solutions={}
 def add(section,title,text,page,module=0,**extra):
  id=f'{section}-{page}'+extra.pop('suffix','')
  row={'id':id,'section':section,'title':title,'module':module,'source':'book' if section=='book' else 'workbook','page':page,'text':text,**extra}
  records.append(row); return row
 # Preserve source text; answers of mini exams separated before any UI serialization.
 for module in range(1,15):
  for n in range(BOOK_START[module-1],BOOK_START[module]):
   t=body(pages['book'][n-1]); title=f'{TITLES[module-1]} · {n-BOOK_START[module-1]+1}'
   ref=re.search(r'^('+str(module)+r'\.\d+)\s*$',t,re.M)
   summary=re.search(r'Bu sayfada (.*?) konusunu',t,re.S)
   if summary: title=re.sub(r'\s+',' ',summary[1])
   elif 'Mini Sınav' in t: title=f'Modül {module} · Mini Sınav'
   elif n==BOOK_START[module-1]: title=f'{TITLES[module-1]} · Öğrenme hedefleri'
   parts=re.split(r'(?:🔑\s*)?Cevap Anahtarı\s*[:—]?|CEVAP ANAHTARI',t,maxsplit=1)
   r=add('book',title,parts[0],n,module,reference=ref[1] if ref else str(module))
   if len(parts)>1: solutions[r['id']]=parts[1]
 # Module workbook pages: answer/model pages are never part of searchable content.
 wb=pages['workbook']; current_module=1
 answers_by_module={}
 for n in range(7,139):
  raw=wb[n-1]; t=body(raw); mod=re.search(r'WORKBOOK — MODÜL (\d+)',raw)
  if mod: current_module=int(mod[1])
  module=current_module
  section='workbook'
  if 37<=n<=43 or 84<=n<=89: section='exams'
  if 112<=n<=126: section='lab'; module=12
  is_solution=bool(re.search(r'HIZLI CEVAPLAR|CEVAP ANAHTARI|MODEL CEVAP|ÖRNEK CEVAP|PROFESYONEL ÖRNEK RAPOR',t[:400]))
  if is_solution:
   answers_by_module.setdefault(module,[]).append({'page':n,'text':t}); continue
  if re.search(r'^Vaka\s',t) or 'Olgu:' in t: section='cases'
  if re.match(r'Modül \d+ Sınavı|Ajans Lab Sınavı',t): section='exams'
  if 73<=n<=75: section='triage'
  title=t.split('\n')[0]
  if title=='SAYFA ÖZETİ': title=f'{TITLES[module-1]} · Uygulama {n}'
  difficulty='hard' if 'HARD' in raw else 'medium' if 'MEDİUM' in raw else 'basic'
  levels=[{'BASIC':'basic','MEDIUM':'medium','HARD':'hard'}[m.replace('İ','I')] for m in re.findall(r'BAS[İI]C|MED[İI]UM|HARD',raw)]
  add(section,title,before_summary(t) or t,n,module,difficulty=difficulty,activityLevels=levels)
 # Link source keys to matching module while preserving original page provenance.
 for r in records:
  if r['source']=='workbook' and r['module'] in answers_by_module:
   # Exams get only their own source key; cases get their own identified answer block.
   chunks=answers_by_module[r['module']]
   if r['section']=='exams' and not (37<=r['page']<=43 or 84<=r['page']<=89):
    matching=[a for a in chunks if 'HIZLI CEVAPLAR — SINAV' in a['text']]
    if matching: solutions[r['id']]=matching[0]['text'].split('VAKA ')[0].split('EGZERSİZ ')[0]
   elif r['section']=='cases':
    case=re.search(r'Vaka ([\d.]+)',r['title'])
    if case:
     marker='VAKA '+case[1]+' —'
     for a in chunks:
      if marker in a['text']: solutions[r['id']]=a['text'].split(marker,1)[1].split('SAYFA ÖZETİ')[0]
 # Interim exam source keys are isolated from module exam answer keys.
 for start,end,keypage in [(37,38,42),(84,85,89)]:
  for r in records:
   if start<=r['page']<=end and r['source']=='workbook': solutions[r['id']]=body(wb[keypage-1]).split('VAKA ')[0]
 # Diagnostic source catalog: exactly 73 unique records.
 ranges=[('Meta Ads',140,144,7,20),('Google Ads',145,148,8,14),('CRO / Funnel',149,150,10,8),('Sosyal Medya',151,153,4,10),('SEO',154,156,9,10),('Ajans',157,159,12,11)]
 for category,start,end,module,count in ranges:
  found=0
  for n in range(start,end+1):
   t=before_summary(body(wb[n-1]))
   for m in re.finditer(r'^(\d+) ([^\n]+)\nÖNCE BAK (.*?)\nSONRA (.*?)\nYAPMA (.*?)(?=\n\d+ |\Z)',t,re.M|re.S):
    found+=1
    add('diagnostics',m[2],m[3],n,module,suffix=f'-{m[1]}',category=category,check=m[3],intervention=m[4],avoid=m[5])
  assert found==count,(category,found,count)
 # Third interim exam and final source activities.
 for n in range(160,165): add('exams',f'Ara Sınav 3 · Bölüm {n-159}',before_summary(body(wb[n-1])),n,14)
 for r in records:
  if r['section']=='exams' and 160<=r['page']<=164: solutions[r['id']]=body(wb[164])
 for n in range(166,173):
  add('final', ['Müşteri briefi · İşletme','Müşteri briefi · Rakipler ve KPI','20 çalışma alanı','Audit, hedef ve persona','Konumlandırma ve teklif','Funnel, içerik ve sosyal medya','Kanallar, ölçüm ve 90 günlük plan'][n-166],body(wb[n-1]),n,13,difficulty='hard')
 for r in records:
  if r['section']=='final': solutions[r['id']]='\n\n'.join(body(wb[n-1]) for n in range(173,179))
 # Glossary: four independently searchable terms per source page.
 for n in range(179,192):
  t=before_summary(body(wb[n-1]))
  for idx,m in enumerate(re.finditer(r'^([^\n]+)\nTANIM (.*?)\nNEREDE (.*?)\nÖRNEK (.*?)\nKARIŞTIRILMASIN (.*?)\nANA KİTAP ([^\n]+)',t,re.M|re.S)):
   mod=re.search(r'\d+',m[6]); module=int(mod[0]) if mod else 0
   add('glossary',m[1],m[2],n,module,suffix=f'-{idx}',usage=m[3],example=m[4],confusion=m[5],reference=m[6])
 for n in range(192,198): add('formulas',body(wb[n-1]).split('\n')[0],before_summary(body(wb[n-1])),n)
 for n in range(198,209): add('reference',body(wb[n-1]).split('\n')[0],before_summary(body(wb[n-1])),n)
 # Combine interim exam pages into one attempt boundary, including written cases/tasks.
 for start,end,keypage,num in [(37,41,42,1),(84,88,89,2),(160,164,165,3)]:
  chosen=[r for r in records if r['source']=='workbook' and start<=r['page']<=end]
  records[:]=[r for r in records if not (r['source']=='workbook' and start<=r['page']<=end and r['section']=='exams')]
  r=add('exams',f'Ara Sınav {num}', '\n\n'.join(before_summary(body(wb[n-1])) or body(wb[n-1]) for n in range(start,end+1)),start,chosen[0]['module'] if chosen else 14)
  solutions[r['id']]=body(wb[keypage-1])
 # Exact model answers for the source's structured agency and guided case tasks.
 for r in records:
  if r['section']=='lab' and 113<=r['page']<=115: solutions[r['id']]=body(wb[115])
  if r['section']=='workbook' and 127<=r['page']<=132: solutions[r['id']]=body(wb[132])
 # Extract independent quiz controls from the exact numbered source prompts.
 for r in records:
  if r['section']=='exams' or (r['section']=='book' and 'Mini Sınav' in r['title']):
   qs=[]
   for m in re.finditer(r'^(\d+)[.)]\s+(.*?)(?=^\d+[.)]\s|SAYFA ÖZETİ|\Z)',r['text'],re.M|re.S):
    prompt=m[2].strip(); opts=list(re.finditer(r'([A-D])\)\s*(.*?)(?=\s+[A-D]\)|\Z)',prompt,re.S))
    options=[{'id':o[1],'text':re.sub(r'\s+',' ',o[2]).strip()} for o in opts]
    if opts: prompt=prompt[:opts[0].start()].strip()
    elif '(D/Y)' in prompt: options=[{'id':'D','text':'Doğru'},{'id':'Y','text':'Yanlış'}]
    qs.append({'id':m[1],'prompt':prompt,'options':options})
   if qs:r['questions']=qs
 # Exact case identifiers include interim exam cases such as AS1.1.
 for r in records:
  if r['section']=='cases':
   case=re.search(r'Vaka ([A-Z]*\d+(?:\.\d+)?)',r['title'])
   if case:
    marker='VAKA '+case[1]+' —'
    for n,raw in enumerate(wb):
     if marker in raw and ('CEVAP ANAHTARI' in raw or 'CEVAP' in raw):
      answer=raw.split(marker,1)[1].split('SAYFA ÖZETİ')[0]
      solutions[r['id']]=answer.split('\nVAKA ')[0]
 # One JSON per record: no complete book in the client or per-route payload.
 index=[]
 # Stale records remain unreachable: index.json is the allowlist. Avoid cloud conflict deletion.
 for r in records:
  save(out/(r['id']+'.json'),r)
  index.append({k:v for k,v in r.items() if k in ['id','section','title','module','source','page','difficulty','category','reference']})
 save(out/'index.json',index); save(out/'modules.json',modules); save(out/'solutions.json',solutions); save(out/'sources.json',sources)
 print(json.dumps({'records':len(records),'diagnostics':sum(r['section']=='diagnostics' for r in records),'glossary':sum(r['section']=='glossary' for r in records),'sources':sources},ensure_ascii=False))
if __name__=='__main__':
 main()
 import runpy
 runpy.run_path(str(Path(__file__).with_name('structure_workbook.py')),run_name='__main__')

 runpy.run_path(str(Path(__file__).with_name('structure_lessons.py')),run_name='__main__')
