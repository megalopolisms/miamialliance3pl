import Foundation
import CoreGraphics
import CoreText
import ImageIO

enum TextAlign {
    case left
    case center
    case right
}

struct PdfColors {
    static let darkNavy = CGColor(red: 15.0/255.0, green: 23.0/255.0, blue: 42.0/255.0, alpha: 1.0)   // #0f172a
    static let primary  = CGColor(red: 30.0/255.0, green: 58.0/255.0, blue: 95.0/255.0, alpha: 1.0)   // #1e3a5f
    static let accent   = CGColor(red: 20.0/255.0, green: 184.0/255.0, blue: 166.0/255.0, alpha: 1.0) // #14b8a6
    static let gray     = CGColor(red: 100.0/255.0, green: 116.0/255.0, blue: 139.0/255.0, alpha: 1.0) // #64748b
    static let lightGray = CGColor(red: 241.0/255.0, green: 245.0/255.0, blue: 249.0/255.0, alpha: 1.0) // #f1f5f9
    static let border   = CGColor(red: 226.0/255.0, green: 232.0/255.0, blue: 240.0/255.0, alpha: 1.0) // #e2e8f0

    static let noteBg   = CGColor(red: 254.0/255.0, green: 249.0/255.0, blue: 195.0/255.0, alpha: 1.0) // #fef9c3
    static let noteBorder = CGColor(red: 250.0/255.0, green: 204.0/255.0, blue: 21.0/255.0, alpha: 1.0) // #facc15
    static let noteText = CGColor(red: 146.0/255.0, green: 64.0/255.0, blue: 14.0/255.0, alpha: 1.0) // #92400e

    static let white = CGColor(red: 1, green: 1, blue: 1, alpha: 1)
}

func ctFont(_ name: String, _ size: CGFloat) -> CTFont {
    CTFontCreateWithName(name as CFString, size, nil)
}

func makeLine(_ text: String, font: CTFont, color: CGColor) -> CTLine {
    let attrs: [NSAttributedString.Key: Any] = [
        NSAttributedString.Key(kCTFontAttributeName as String): font,
        NSAttributedString.Key(kCTForegroundColorAttributeName as String): color
    ]
    let attr = NSAttributedString(string: text, attributes: attrs)
    return CTLineCreateWithAttributedString(attr)
}

func lineWidth(_ line: CTLine) -> CGFloat {
    CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
}

func drawText(_ ctx: CGContext, _ text: String, x: CGFloat, y: CGFloat, font: CTFont, color: CGColor, align: TextAlign = .left, width: CGFloat? = nil) {
    let line = makeLine(text, font: font, color: color)
    let w = lineWidth(line)

    var drawX = x
    if let width = width {
        switch align {
        case .left:
            drawX = x
        case .center:
            drawX = x + (width - w) / 2.0
        case .right:
            drawX = x + (width - w)
        }
    } else {
        switch align {
        case .left:
            drawX = x
        case .center:
            drawX = x - (w / 2.0)
        case .right:
            drawX = x - w
        }
    }

    ctx.textPosition = CGPoint(x: drawX, y: y)
    CTLineDraw(line, ctx)
}

func drawHLine(_ ctx: CGContext, x1: CGFloat, x2: CGFloat, y: CGFloat, color: CGColor, width: CGFloat) {
    ctx.saveGState()
    ctx.setStrokeColor(color)
    ctx.setLineWidth(width)
    ctx.move(to: CGPoint(x: x1, y: y))
    ctx.addLine(to: CGPoint(x: x2, y: y))
    ctx.strokePath()
    ctx.restoreGState()
}

func drawRectFill(_ ctx: CGContext, rect: CGRect, color: CGColor) {
    ctx.saveGState()
    ctx.setFillColor(color)
    ctx.fill(rect)
    ctx.restoreGState()
}

func drawRectStroke(_ ctx: CGContext, rect: CGRect, color: CGColor, width: CGFloat) {
    ctx.saveGState()
    ctx.setStrokeColor(color)
    ctx.setLineWidth(width)
    ctx.stroke(rect)
    ctx.restoreGState()
}

func loadCGImage(at path: String) -> CGImage? {
    let url = URL(fileURLWithPath: path)
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
    return CGImageSourceCreateImageAtIndex(src, 0, nil)
}

let pageWidth: CGFloat = 612
let pageHeight: CGFloat = 792
let margin: CGFloat = 36

// Quote inputs (the specific scenario requested)
let palletCount: Int = 3
let storageDays: Int = 30
let storageRatePerPalletDay: Double = 0.75
let inboundReceivingPerPallet: Double = 15.00
let outboundHandlingPerPallet: Double = 15.00
let blackWrapPerPallet: Double = 7.00

func money(_ value: Double) -> String {
    String(format: "$%.2f", value)
}

let storageTotal = Double(palletCount) * Double(storageDays) * storageRatePerPalletDay
let inboundTotal = Double(palletCount) * inboundReceivingPerPallet
let outboundTotal = Double(palletCount) * outboundHandlingPerPallet
let wrapTotal = Double(palletCount) * blackWrapPerPallet
let oneTimeTotal = inboundTotal + outboundTotal + wrapTotal
let firstMonthTotal = storageTotal + oneTimeTotal
let ongoingPerDay = Double(palletCount) * storageRatePerPalletDay

let now = Date()
let dfLong = DateFormatter()
dfLong.locale = Locale(identifier: "en_US_POSIX")
dfLong.dateFormat = "MMMM d, yyyy"
let currentDateStr = dfLong.string(from: now)

let dfKey = DateFormatter()
dfKey.locale = Locale(identifier: "en_US_POSIX")
dfKey.dateFormat = "yyyyMMdd"
let dateKey = dfKey.string(from: now)

let validThrough = Calendar.current.date(byAdding: .day, value: 30, to: now) ?? now
let validThroughStr = dfLong.string(from: validThrough)

let rand = Int.random(in: 0..<10000)
let quoteNumber = String(format: "MA3PL-%@-%04d", dateKey, rand)

let outputDir = FileManager.default.currentDirectoryPath + "/.tmp/quotes"
let outputPath = outputDir + "/MiamiAlliance3PL_CustomQuote_\(quoteNumber).pdf"

var mediaBox = CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight)
let outputURL = URL(fileURLWithPath: outputPath)

guard let ctx = CGContext(outputURL as CFURL, mediaBox: &mediaBox, nil) else {
    fputs("Failed to create PDF context at \(outputPath)\n", stderr)
    exit(1)
}

ctx.beginPDFPage(nil)

// ===== Header =====
let headerHeight: CGFloat = 120
let headerRect = CGRect(x: 0, y: pageHeight - headerHeight, width: pageWidth, height: headerHeight)
drawRectFill(ctx, rect: headerRect, color: PdfColors.darkNavy)

let accentStripeHeight: CGFloat = 6
let stripeRect = CGRect(x: 0, y: pageHeight - headerHeight, width: pageWidth, height: accentStripeHeight)
drawRectFill(ctx, rect: stripeRect, color: PdfColors.accent)

// Logo
let logoPath = FileManager.default.currentDirectoryPath + "/assets/logo.jpg"
if let logo = loadCGImage(at: logoPath) {
    // Keep a tall-ish aspect in the header.
    let logoW: CGFloat = 56
    let logoH: CGFloat = 84
    let logoX: CGFloat = margin
    let logoY: CGFloat = pageHeight - headerHeight + 20
    ctx.draw(logo, in: CGRect(x: logoX, y: logoY, width: logoW, height: logoH))
}

// Company text
let titleFont = ctFont("Helvetica-Bold", 28)
let title2Font = ctFont("Helvetica-Bold", 28)
let taglineFont = ctFont("Helvetica", 10)

drawText(ctx, "MIAMI ALLIANCE", x: margin + 70, y: pageHeight - 50, font: titleFont, color: PdfColors.white)
drawText(ctx, "3PL", x: margin + 70, y: pageHeight - 82, font: title2Font, color: PdfColors.accent)
drawText(ctx, "WAREHOUSING  |  FULFILLMENT  |  LOGISTICS", x: margin + 70, y: pageHeight - 105, font: taglineFont, color: CGColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 1))

// Quote badge (right)
let badgeW: CGFloat = 150
let badgeH: CGFloat = 55
let badgeX: CGFloat = pageWidth - margin - badgeW
let badgeY: CGFloat = pageHeight - 36 - badgeH
let badgeRect = CGRect(x: badgeX, y: badgeY, width: badgeW, height: badgeH)
drawRectFill(ctx, rect: badgeRect, color: PdfColors.accent)

let badgeSmallFont = ctFont("Helvetica-Bold", 11)
let badgeBigFont = ctFont("Helvetica-Bold", 18)

drawText(ctx, "CUSTOM", x: badgeX, y: badgeY + 35, font: badgeSmallFont, color: PdfColors.white, align: .center, width: badgeW)
drawText(ctx, "QUOTE", x: badgeX, y: badgeY + 15, font: badgeBigFont, color: PdfColors.white, align: .center, width: badgeW)

// ===== Quote info bar =====
let infoBarH: CGFloat = 30
let infoBarRect = CGRect(x: 0, y: pageHeight - headerHeight - infoBarH, width: pageWidth, height: infoBarH)
drawRectFill(ctx, rect: infoBarRect, color: PdfColors.lightGray)

let infoLabelFont = ctFont("Helvetica-Bold", 10)
let infoFont = ctFont("Helvetica", 10)

drawText(ctx, "QUOTE #: \(quoteNumber)", x: margin, y: infoBarRect.minY + 10, font: infoLabelFont, color: PdfColors.primary)
drawText(ctx, "Date: \(currentDateStr)", x: pageWidth/2, y: infoBarRect.minY + 10, font: infoFont, color: PdfColors.gray, align: .center)
drawText(ctx, "Valid through: \(validThroughStr)", x: pageWidth - margin, y: infoBarRect.minY + 10, font: infoFont, color: PdfColors.gray, align: .right)

// ===== Body heading =====
let bodyTopY: CGFloat = infoBarRect.minY - 22
let hFont = ctFont("Helvetica-Bold", 18)
let subFont = ctFont("Helvetica", 11)

drawText(ctx, "CUSTOM STORAGE QUOTE", x: margin, y: bodyTopY, font: hFont, color: PdfColors.primary)
drawText(ctx, "\(palletCount) Pallets  |  \(storageDays) Days Storage", x: margin, y: bodyTopY - 18, font: subFont, color: PdfColors.gray)

drawText(ctx, "Prepared for: ______________________________", x: margin, y: bodyTopY - 38, font: ctFont("Helvetica", 10), color: PdfColors.gray)
drawText(ctx, "Prepared by: Miami Alliance 3PL", x: pageWidth - margin - 260, y: bodyTopY - 38, font: ctFont("Helvetica", 10), color: PdfColors.gray)

// ===== Line items table =====
let tableX: CGFloat = margin
let tableW: CGFloat = pageWidth - (2 * margin)
let rowH: CGFloat = 24
let tableTop: CGFloat = bodyTopY - 60

let colServiceW: CGFloat = 220
let colQtyW: CGFloat = 70
let colRateW: CGFloat = 90
let colDurW: CGFloat = 80
let colAmtW: CGFloat = tableW - (colServiceW + colQtyW + colRateW + colDurW)

let colServiceX = tableX
let colQtyX = colServiceX + colServiceW
let colRateX = colQtyX + colQtyW
let colDurX = colRateX + colRateW
let colAmtX = colDurX + colDurW

// Table header
let headerRect2 = CGRect(x: tableX, y: tableTop - rowH, width: tableW, height: rowH)
drawRectFill(ctx, rect: headerRect2, color: PdfColors.primary)

drawText(ctx, "Service", x: colServiceX + 8, y: tableTop - 16, font: ctFont("Helvetica-Bold", 10), color: PdfColors.white)
drawText(ctx, "Qty", x: colQtyX, y: tableTop - 16, font: ctFont("Helvetica-Bold", 10), color: PdfColors.white, align: .center, width: colQtyW)
drawText(ctx, "Rate", x: colRateX, y: tableTop - 16, font: ctFont("Helvetica-Bold", 10), color: PdfColors.white, align: .center, width: colRateW)
drawText(ctx, "Duration", x: colDurX, y: tableTop - 16, font: ctFont("Helvetica-Bold", 10), color: PdfColors.white, align: .center, width: colDurW)
drawText(ctx, "Amount", x: colAmtX, y: tableTop - 16, font: ctFont("Helvetica-Bold", 10), color: PdfColors.white, align: .right, width: colAmtW - 8)

struct Row {
    let service: String
    let qty: String
    let rate: String
    let duration: String
    let amount: String
}

let rows: [Row] = [
    Row(service: "Pallet Storage", qty: "\(palletCount)", rate: "$0.75/pallet/day", duration: "\(storageDays) days", amount: money(storageTotal)),
    Row(service: "Receiving & Intake (Inbound)", qty: "\(palletCount)", rate: money(inboundReceivingPerPallet) + "/pallet", duration: "One-time", amount: money(inboundTotal)),
    Row(service: "Pallet Handling (Outbound / Release)", qty: "\(palletCount)", rate: money(outboundHandlingPerPallet) + "/pallet", duration: "One-time", amount: money(outboundTotal)),
    Row(service: "Black Wrapping", qty: "\(palletCount)", rate: money(blackWrapPerPallet) + "/pallet", duration: "One-time", amount: money(wrapTotal))
]

let cellFont = ctFont("Helvetica", 10)
for (i, r) in rows.enumerated() {
    let rowTop = tableTop - rowH * CGFloat(i + 1)
    let rect = CGRect(x: tableX, y: rowTop - rowH, width: tableW, height: rowH)

    if i % 2 == 0 {
        drawRectFill(ctx, rect: rect, color: CGColor(red: 248/255, green: 250/255, blue: 252/255, alpha: 1))
    }

    drawText(ctx, r.service, x: colServiceX + 8, y: rowTop - 16, font: cellFont, color: PdfColors.primary)
    drawText(ctx, r.qty, x: colQtyX, y: rowTop - 16, font: cellFont, color: PdfColors.gray, align: .center, width: colQtyW)
    drawText(ctx, r.rate, x: colRateX, y: rowTop - 16, font: cellFont, color: PdfColors.gray, align: .center, width: colRateW)
    drawText(ctx, r.duration, x: colDurX, y: rowTop - 16, font: cellFont, color: PdfColors.gray, align: .center, width: colDurW)
    drawText(ctx, r.amount, x: colAmtX, y: rowTop - 16, font: ctFont("Helvetica-Bold", 10), color: PdfColors.primary, align: .right, width: colAmtW - 8)
}

let tableBottom = tableTop - rowH * CGFloat(rows.count + 1)
let tableRect = CGRect(x: tableX, y: tableBottom, width: tableW, height: rowH * CGFloat(rows.count + 1))
drawRectStroke(ctx, rect: tableRect, color: PdfColors.border, width: 1)

// Vertical separators (subtle)
ctx.saveGState()
ctx.setStrokeColor(PdfColors.border)
ctx.setLineWidth(1)
let vLinesX: [CGFloat] = [colQtyX, colRateX, colDurX, colAmtX]
for x in vLinesX {
    ctx.move(to: CGPoint(x: x, y: tableBottom))
    ctx.addLine(to: CGPoint(x: x, y: tableTop))
}
ctx.strokePath()
ctx.restoreGState()

// ===== Totals box =====
let totalsW: CGFloat = 250
let totalsH: CGFloat = 118
let totalsX: CGFloat = pageWidth - margin - totalsW
let totalsTop: CGFloat = tableBottom - 22
let totalsRect = CGRect(x: totalsX, y: totalsTop - totalsH, width: totalsW, height: totalsH)

drawRectFill(ctx, rect: totalsRect, color: PdfColors.lightGray)
drawRectStroke(ctx, rect: totalsRect, color: PdfColors.border, width: 1)

// Accent bar on top of totals box
let totalsAccent = CGRect(x: totalsX, y: totalsTop - 6, width: totalsW, height: 6)
drawRectFill(ctx, rect: totalsAccent, color: PdfColors.accent)

let totalsLabelFont = ctFont("Helvetica", 10)
let totalsBoldFont = ctFont("Helvetica-Bold", 11)

let totalsLeftX = totalsX + 12
let totalsRightX = totalsX + totalsW - 12

let line1Y = totalsTop - 26
let line2Y = totalsTop - 46
let line3Y = totalsTop - 70
let line4Y = totalsTop - 94

// Storage + one-time + total + ongoing

drawText(ctx, "Storage (\(storageDays)d)", x: totalsLeftX, y: line1Y, font: totalsLabelFont, color: PdfColors.gray)
drawText(ctx, money(storageTotal), x: totalsRightX, y: line1Y, font: totalsBoldFont, color: PdfColors.primary, align: .right)

drawText(ctx, "One-time services", x: totalsLeftX, y: line2Y, font: totalsLabelFont, color: PdfColors.gray)
drawText(ctx, money(oneTimeTotal), x: totalsRightX, y: line2Y, font: totalsBoldFont, color: PdfColors.primary, align: .right)

// Divider line
let divY = totalsTop - 58
ctx.saveGState()
ctx.setStrokeColor(PdfColors.border)
ctx.setLineWidth(1)
ctx.move(to: CGPoint(x: totalsLeftX, y: divY))
ctx.addLine(to: CGPoint(x: totalsRightX, y: divY))
ctx.strokePath()
ctx.restoreGState()

drawText(ctx, "TOTAL (\(storageDays)d)", x: totalsLeftX, y: line3Y, font: ctFont("Helvetica-Bold", 11), color: PdfColors.primary)
drawText(ctx, money(firstMonthTotal), x: totalsRightX, y: line3Y, font: ctFont("Helvetica-Bold", 13), color: PdfColors.accent, align: .right)

drawText(ctx, "Ongoing storage", x: totalsLeftX, y: line4Y, font: totalsLabelFont, color: PdfColors.gray)
drawText(ctx, String(format: "%@/day", money(ongoingPerDay)), x: totalsRightX, y: line4Y, font: totalsBoldFont, color: PdfColors.primary, align: .right)

// ===== Notes =====
let notesTop = totalsRect.minY - 20
let notesH: CGFloat = 90
let notesRect = CGRect(x: margin, y: notesTop - notesH, width: tableW, height: notesH)
drawRectFill(ctx, rect: notesRect, color: PdfColors.noteBg)
drawRectStroke(ctx, rect: notesRect, color: PdfColors.noteBorder, width: 1)

drawText(ctx, "IMPORTANT NOTES", x: margin + 12, y: notesTop - 22, font: ctFont("Helvetica-Bold", 10), color: PdfColors.noteText)

let noteFont = ctFont("Helvetica", 9)
let notes: [String] = [
    "This quote is an estimate. Final billing may vary based on actual services performed.",
    "Storage continues at $0.75/pallet/day after the initial 30-day period.",
    "Outbound handling is billed when pallets are released/shipped. Taxes are not included."
]

for (i, n) in notes.enumerated() {
    drawText(ctx, "• " + n, x: margin + 12, y: notesTop - 40 - CGFloat(i) * 16, font: noteFont, color: PdfColors.noteText)
}

// ===== Footer =====
let footerLineY: CGFloat = 70
let footerTextY1: CGFloat = 52
let footerTextY2: CGFloat = 38

drawHLine(ctx, x1: margin, x2: pageWidth - margin, y: footerLineY, color: PdfColors.border, width: 1)

let footerFont = ctFont("Helvetica", 9)
let footerGray = PdfColors.gray
let address = "8780 NW 100th ST, Medley, FL 33178"
let contact = "info@miamialliance3pl.com  |  www.miamialliance3pl.com"

drawText(ctx, address, x: pageWidth/2, y: footerTextY1, font: footerFont, color: footerGray, align: .center)
drawText(ctx, contact, x: pageWidth/2, y: footerTextY2, font: footerFont, color: footerGray, align: .center)

ctx.endPDFPage()
ctx.closePDF()

print(outputPath)
