import Foundation
import AppKit
import PDFKit
let out=CommandLine.arguments[1]
let url=URL(fileURLWithPath:out+"/known.pdf")
let ctx=CGContext(url as CFURL,mediaBox:nil,nil)!
for page in 1...3 {
 ctx.beginPDFPage([kCGPDFContextMediaBox as String: CGRect(x:0,y:0,width:600,height:800)] as CFDictionary)
 let gc=NSGraphicsContext(cgContext:ctx,flipped:false);NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=gc
 if page != 2 {let text=page==1 ? "第一页 资料值 PDF-3710\n项目：青瓷 数量：73" : "第三页 替换与分页验证 PDF-END-915";text.draw(at:NSPoint(x:40,y:650),withAttributes:[.font:NSFont.systemFont(ofSize:24),.foregroundColor:NSColor.black])}
 ctx.setFillColor(NSColor.red.cgColor);ctx.move(to:CGPoint(x:40,y:100));ctx.addLine(to:CGPoint(x:150,y:300));ctx.addLine(to:CGPoint(x:260,y:100));ctx.closePath();ctx.fillPath()
 NSGraphicsContext.restoreGraphicsState();ctx.endPDFPage()
}
ctx.closePDF()
let doc=PDFDocument(url:url)!;doc.write(to:URL(fileURLWithPath:out+"/encrypted.pdf"),withOptions:[.userPasswordOption:"fixture-only",.ownerPasswordOption:"fixture-only"])
