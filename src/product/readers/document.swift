import Foundation
import PDFKit
import AppKit
import ImageIO

func emit(_ value: [String:Any]) { let data = try! JSONSerialization.data(withJSONObject:value, options:[.sortedKeys]); FileHandle.standardOutput.write(data) }
func fail(_ code:String,_ message:String) -> Never {emit(["error":code,"message":message]);exit(1)}
let args=CommandLine.arguments
if args.count != 3 {fail("READER_INPUT","Expected managed blob and bounded options")}
let options=(try? JSONSerialization.jsonObject(with:Data(args[2].utf8))) as? [String:Any] ?? [:]
let path=args[1], data=try Data(contentsOf:URL(fileURLWithPath:path),options:.mappedIfSafe)
let mode=options["mode"] as? String ?? "text"
let maxPixels=20_000_000
if data.starts(with:Data("%PDF-".utf8)) {
 guard let doc=PDFDocument(data:data) else {fail("CORRUPT_PDF","PDF cannot be decoded")}
 if doc.isEncrypted {fail("ENCRYPTED_DOCUMENT","Encrypted PDF is not admitted")}
 if doc.pageCount>500 {fail("PAGE_LIMIT","PDF exceeds 500 pages")}
 let start=options["start"] as? Int ?? 1, end=options["end"] as? Int ?? start
 if start<1 || end<start || end>doc.pageCount || end-start>=10 {fail("PAGE_RANGE","Select 1 to 10 existing physical pages")}
 var pages=[[String:Any]]()
 for i in start...end {
  guard let page=doc.page(at:i-1) else {fail("CORRUPT_PDF","Missing page")}
  if mode == "visual" {
   if start != end {fail("PAGE_RANGE","Visual read selects one physical page")}
   let bounds=page.bounds(for:.mediaBox)
   if !bounds.width.isFinite || !bounds.height.isFinite || bounds.width<=0 || bounds.height<=0 {fail("CORRUPT_PDF","Invalid page bounds")}
   let scale=min(2.0,1600.0/max(bounds.width,bounds.height)), width=max(1,Int(bounds.width*scale)),height=max(1,Int(bounds.height*scale))
   guard let ctx=CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else {fail("RENDER_FAILED","Cannot allocate page")}
   ctx.setFillColor(NSColor.white.cgColor);ctx.fill(CGRect(x:0,y:0,width:width,height:height));ctx.scaleBy(x:scale,y:scale);ctx.translateBy(x:-bounds.minX,y:-bounds.minY);page.draw(with:.mediaBox,to:ctx)
   guard let img=ctx.makeImage(),let png=NSBitmapImageRep(cgImage:img).representation(using:.png,properties:[:]) else {fail("RENDER_FAILED","Cannot encode page")}
   emit(["format":"pdf","pageCount":doc.pageCount,"page":i,"pageLabel":page.label ?? String(i),"imageBase64":png.base64EncodedString(),"mediaType":"image/png","width":width,"height":height,"scale":scale,"limitations":["Rendered physical page; no OCR or semantic interpretation"]]);exit(0)
  }
  let content=page.string ?? ""
  if content.utf8.count>2_000_000 {fail("TEXT_LIMIT","Page text exceeds local extraction limit")}
  pages.append(["page":i,"pageLabel":page.label ?? String(i),"text":content.precomposedStringWithCompatibilityMapping,"rawText":content,"normalization":"NFKC with rawText retained","hasTextLayer": !content.isEmpty,"visualAvailable":true])
 }
 emit(["format":"pdf","pageCount":doc.pageCount,"records":pages,"nextStart":end<doc.pageCount ? end+1 : NSNull(),"limitations":["Text order may differ for columns and tables; use physical page visual mode for scanned pages and charts"]]);exit(0)
}
guard let source=CGImageSourceCreateWithData(data as CFData,nil),let type=CGImageSourceGetType(source) as String?,["public.png","public.jpeg"].contains(type), let props=CGImageSourceCopyPropertiesAtIndex(source,0,nil) as? [String:Any],let width=props[kCGImagePropertyPixelWidth as String] as? Int,let height=props[kCGImagePropertyPixelHeight as String] as? Int else {fail("CORRUPT_IMAGE","Only actual decodable PNG/JPEG is supported")}
if width<=0 || height<=0 || width>20000 || height>20000 || width*height>maxPixels {fail("IMAGE_PIXEL_LIMIT","Image exceeds 20 million pixels or 20000 pixels per side")}
guard let image=CGImageSourceCreateThumbnailAtIndex(source,0,[kCGImageSourceCreateThumbnailFromImageAlways:true,kCGImageSourceCreateThumbnailWithTransform:true,kCGImageSourceThumbnailMaxPixelSize:1600] as CFDictionary),let png=NSBitmapImageRep(cgImage:image).representation(using:.png,properties:[:]) else {fail("CORRUPT_IMAGE","Image decode failed")}
emit(["format":type=="public.png" ? "png":"jpeg","imageBase64":png.base64EncodedString(),"mediaType":"image/png","width":image.width,"height":image.height,"originalDimensions":["width":width,"height":height],"orientation":props[kCGImagePropertyOrientation as String] ?? 1,"limitations":["Actual image resized to at most 1600 pixels with orientation applied; no OCR or invented caption"]])
