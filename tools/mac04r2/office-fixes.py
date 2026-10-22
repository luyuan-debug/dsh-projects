from pathlib import Path
import tempfile,zipfile,subprocess,json,sys
reader=Path(__file__).resolve().parents[2]/'src/product/readers/office.py'
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
CT='<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
REL='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'
results=[]
def doc(body):return f'<w:document xmlns:w="{W}"><w:body>{body}</w:body></w:document>'
def p(t):return '<w:p><w:r><w:t>'+t+'</w:t></w:r></w:p>'
def run(name,body,encoding='utf-8',entry='word/document.xml',unsafe=False):
 parts={'[Content_Types].xml':CT.encode(),'word/document.xml':doc(p('普通正文 SAFE')).encode(),'word/_rels/document.xml.rels':REL.encode()}
 xml=body if entry!='word/document.xml' else doc(body)
 if unsafe:xml='<!DOCTYPE x [<!ENTITY harmless "ENTITY_SHOULD_BE_REFUSED">]>'+xml
 declared={'utf-8':'UTF-8','utf-16-le':'UTF-16LE','utf-16-be':'UTF-16BE'}[encoding];parts[entry]=('<?xml version="1.0" encoding="'+declared+'"?>'+xml).encode(encoding)
 with tempfile.TemporaryDirectory(prefix='r22-office-')as tmp:
  f=Path(tmp)/'bounded.docx'
  with zipfile.ZipFile(f,'w',zipfile.ZIP_DEFLATED)as z:
   for n,b in parts.items():z.writestr(n,b)
  proc=subprocess.run([sys.executable,'-I',str(reader),str(f),'{}'],capture_output=True,text=True,timeout=5);v=json.loads(proc.stdout)
 return proc.returncode,v
body=p('FIRST')+'<w:sdt><w:sdtContent>'+p('KEEP_THIS_REQUIREMENT')+'<w:tbl><w:tr><w:tc>'+p('CELL_BEFORE')+'<w:tbl><w:tr><w:tc>'+p('NESTED_ONLY_ONCE')+'</w:tc></w:tr></w:tbl>'+p('CELL_AFTER')+'</w:tc></w:tr></w:tbl></w:sdtContent></w:sdt>'+p('LAST')
code,v=run('wrappers',body);records=v['records'];assert code==0;assert [b['kind']for b in records]==['paragraph','paragraph','table','paragraph'];assert records[1]['text']=='KEEP_THIS_REQUIREMENT';cell=records[2]['rows'][0][0];assert [b['kind']for b in cell['blocks']]==['paragraph','table','paragraph'];assert cell['blocks'][1]['rows'][0][0]['text']=='NESTED_ONLY_ONCE';assert 'NESTED_ONLY_ONCE'not in cell['text'];assert records[1]['path'].startswith('word/document.xml/body/sdt');results.append({'case':'wrapper-order-nested-table','pass':True})
code,v=run('separators','<w:p><w:r><w:t>项目</w:t><w:tab/><w:t>数值</w:t><w:br/><w:t>甲</w:t></w:r><w:r><w:t>乙</w:t><w:cr/><w:t>73</w:t></w:r></w:p>');assert v['records'][0]['text']=='项目\t数值\n甲乙\n73';results.append({'case':'explicit-separators-adjacent-runs','pass':True})
code,v=run('unknown','<w:altChunk xmlns:r="urn:r" r:id="test"/>');assert code==0 and v['contentStatus']=='partial'and v['omissions'][0]['element']=='altChunk';results.append({'case':'unsupported-body-is-explicit','pass':True})
for encoding in ['utf-8','utf-16-le','utf-16-be']:
 for entry,body in [('word/document.xml',p('SAFE正文')),('[Content_Types].xml',CT),('word/_rels/document.xml.rels',REL)]:
  code,v=run('normal',body,encoding,entry);assert code==0,(encoding,entry,v);results.append({'case':encoding+' normal '+entry,'pass':True})
  code,v=run('dtd',body,encoding,entry,True);assert code!=0 and v['error']=='UNSAFE_XML',(encoding,entry,v);results.append({'case':encoding+' DTD '+entry,'pass':True})
# Shared text helper: OOXML rich runs stay adjacent; explicit PPTX breaks remain breaks.
def package_check(name,parts,expected):
 with tempfile.TemporaryDirectory(prefix='r22-shared-')as tmp:
  f=Path(tmp)/name
  with zipfile.ZipFile(f,'w')as z:
   for n,b in parts.items():z.writestr(n,b)
  proc=subprocess.run([sys.executable,'-I',str(reader),str(f),'{}'],capture_output=True,text=True,timeout=5);value=json.loads(proc.stdout);assert proc.returncode==0,value;expected(value)
 results.append({'case':name,'pass':True})
package_check('rich.xlsx',{'[Content_Types].xml':'<Types><Override ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>','xl/workbook.xml':'<workbook xmlns:r="urn:r"><sheets><sheet name="Sheet1" r:id="r1"/></sheets></workbook>','xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>','xl/worksheets/sheet1.xml':'<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><r><t>相邻</t></r><r><t>文字</t></r></is></c></row></sheetData></worksheet>'},lambda v: v['records'][0]['value']=='相邻文字' or (_ for _ in ()).throw(AssertionError(v)))
package_check('breaks.pptx',{'[Content_Types].xml':'<Types><Override ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>','ppt/presentation.xml':'<presentation xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sldIdLst><sldId id="1" r:id="r1"/></sldIdLst></presentation>','ppt/_rels/presentation.xml.rels':'<Relationships><Relationship Id="r1" Target="slides/slide1.xml"/></Relationships>','ppt/slides/slide1.xml':'<sld><spTree><sp><p><r><t>相邻</t></r><r><t>文字</t></r><br/><r><t>下一行</t></r></p></sp></spTree></sld>'},lambda v: v['records'][0]['shapes'][0]['paragraphs'][0]=='相邻文字\n下一行' or (_ for _ in ()).throw(AssertionError(v)))
print(json.dumps({'results':results},ensure_ascii=False))
