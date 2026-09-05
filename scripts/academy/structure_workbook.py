"""Derive input controls from source labels without inventing scenario data."""
import json,re
from pathlib import Path
ROOT=Path('content/academy')
index=json.loads((ROOT/'index.json').read_text())
for row in index:
 if row['section'] not in ['workbook','lab','triage']:continue
 path=ROOT/(row['id']+'.json');r=json.loads(path.read_text());text=r['text']
 matches=list(re.finditer(r'^Egzersiz(?: (\d+))? ([^\n]+)\n',text,re.M))
 activities=[]
 for i,m in enumerate(matches):
  label=m[2];prompt=text[m.end():matches[i+1].start() if i+1<len(matches) else len(text)].strip()
  kind='short';items=[];options=[]
  if 'ÇOKTAN SEÇMELİ' in label:
   opts=list(re.finditer(r'([A-D])\)\s*(.*?)(?=\s+[A-D]\)|\Z)',prompt,re.S))
   if len(opts)>=2:
    kind='choice';options=[{'id':o[1],'text':re.sub(r'\s+',' ',o[2])} for o in opts];prompt=prompt[:opts[0].start()].strip()
  elif 'DOĞRU' in label and 'YANLIŞ' in label:
   kind='boolean'
   items=[{'id':a[1],'text':re.sub(r'\(\s*D\s*/\s*Y\s*\)','',a[2]).strip()} for a in re.finditer(r'^(\d+)\)\s*(.*?)(?=^\d+\)|\Z)',prompt,re.M|re.S)]
  elif 'EŞLEŞTİRME' in label:
   # Numbered left column and lettered right column are preserved by pypdf.
   found=list(re.finditer(r'^([1-9]|[A-F]) ([^\n]+)',prompt,re.M))
   items=[{'id':a[1],'text':a[2]} for a in found if a[1].isdigit()]
   options=[{'id':a[1],'text':a[2]} for a in found if a[1].isalpha()]
   if items and options:
    kind='matching';prompt=prompt[:found[0].start()].strip()
   else:kind='table'
  elif 'SIRALAMA' in label:
   kind='ordering';items=[{'id':str(j),'text':line.lstrip('? ').strip()} for j,line in enumerate(prompt.splitlines()) if line.startswith('?')]
  elif 'BÜTÇE' in label:kind='budget'
  elif any(word in label for word in ['TABLO','TAKVİM','KONTROL LİSTESİ','PERSONA','RAPOR YAZMA']):kind='table'
  elif 'BOŞLUK' in label:kind='fill'
  elif 'HATA' in label:kind='error'
  elif any(word in label for word in ['STRATEJİ','YAZIMI','TEKLİF','KÖK NEDEN','VERİ YORUMLAMA']):kind='reasoning'
  amount=re.search(r'(\d[\d.]*(?:,\d+)?)\s*TL',prompt) if kind=='budget' else None
  activity={'id':m[1] or str(i+1),'label':label,'prompt':prompt,'kind':kind,'items':items,'options':options}
  if amount:activity['budget']=float(amount[1].replace('.','').replace(',','.'))
  levels=r.get('activityLevels',[])
  if len(levels)==len(matches):activity['difficulty']=levels[i]
  activities.append(activity)
 if activities:r['activities']=activities;path.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print('Structured activities',sum(len(json.loads((ROOT/(r['id']+'.json')).read_text()).get('activities',[])) for r in index))
# Case fields and individual questions follow source heading boundaries.
case_count=0
for row in index:
 if row['section']!='cases':continue
 path=ROOT/(row['id']+'.json');r=json.loads(path.read_text());text=r['text']
 labels=['Olgu','Verilen bilgiler','Metrikler','İşletme bağlamı','Problem','Sorular']
 markers=list(re.finditer(r'('+'|'.join(labels)+r'):\s*',text))
 fields=[]
 for i,m in enumerate(markers):
  value=text[m.end():markers[i+1].start() if i+1<len(markers) else len(text)].strip()
  value=value.split('ÖĞRENCİNİN KARAR ALANI')[0].strip()
  fields.append({'label':m[1],'text':value})
 questions=next((f['text'] for f in fields if f['label']=='Sorular'),'')
 qs=[{'id':m[1],'prompt':m[2].strip()} for m in re.finditer(r'(\d+)\)\s*(.*?)(?=\d+\)|\Z)',questions,re.S)]
 if fields:r['caseFields']=fields
 if qs:r['caseQuestions']=qs;case_count+=1
 path.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print('Structured cases',case_count)

for row in index:
 record=json.loads((ROOT/(row['id']+'.json')).read_text())
 row['activityCount']=len(record.get('activities',[]))
 row['levels']=list(dict.fromkeys(record.get('activityLevels',[])))
(ROOT/'index.json').write_text(json.dumps(index,ensure_ascii=False,indent=2)+'\n')
