"""Reorder source reading blocks without paraphrasing or inventing table cells."""
import json,re
from pathlib import Path
root=Path('content/academy')
tables=json.loads((root/'tables.json').read_text())
for row in json.loads((root/'index.json').read_text()):
 if row['section']!='book':continue
 path=root/(row['id']+'.json');record=json.loads(path.read_text());text=record['text'];blocks=[]
 marker='SAYFA ÖZETİ';reference=record.get('reference','')
 if marker in text and reference:
  earlier,later=text.split(marker,1)
  match=re.search(r'\n'+re.escape(reference)+r'\n',later)
  if match:
   summary=later[:match.start()].strip();main=later[match.end():].strip()
   blocks.append({'kind':'reading','title':'Konu anlatımı','text':main})
   if earlier.strip():blocks.append({'kind':'reference','title':'Karşılaştırmalar ve uygulama notları','text':earlier.strip()})
   if summary:blocks.append({'kind':'summary','title':'Özet','text':summary})
 if not blocks:blocks=[{'kind':'reading','title':'Konu anlatımı','text':text}]
 for block in blocks:
  if block['kind']!='reading':continue
  paragraphs=[];pending=[]
  for line in block['text'].splitlines():
   line=line.strip()
   if not line:continue
   heading=len(line)<90 and (line.isupper() or line.startswith(('📖','💡','⚠','🎯')))
   if heading:
    if pending:paragraphs.append(' '.join(pending));pending=[]
    paragraphs.append(line)
   else:
    pending.append(line)
    if re.search(r'[.!?]$',line):paragraphs.append(' '.join(pending));pending=[]
  if pending:paragraphs.append(' '.join(pending))
  block['paragraphs']=paragraphs
 if row['id'] in tables:record['table']=tables[row['id']]
 record['blocks']=blocks;path.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')

index=json.loads((root/'index.json').read_text())
workflows=json.loads((root/'workflows.json').read_text())
for row in index:
 record=json.loads((root/(row['id']+'.json')).read_text())
 if record.get('questions'):row['questionCount']=len(record['questions'])
 if row['id'] in workflows:row['stepCount']=len(workflows[row['id']]['steps'])
(root/'index.json').write_text(json.dumps(index,ensure_ascii=False,indent=2)+'\n')
