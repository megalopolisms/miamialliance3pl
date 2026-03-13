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
    static let darkNavy = CGColor(red: 15.0/255.0, green: 23.0/255.0, blue: 42.0/255.0, alpha: 1.0)
    static let primary  = CGColor(red: 30.0/255.0, green: 58.0/255.0, blue: 95.0/255.0, alpha: 1.0)
    static let accent   = CGColor(red: 20.0/255.0, green: 184.0/255.0, blue: 166.0/255.0, alpha: 1.0)
    static let gray     = CGColor(red: 100.0/255.0, green: 116.0/255.0, blue: 139.0/255.0, alpha: 1.0)
    static let lightGray = CGColor(red: 241.0/255.0, green: 245.0/255.0, blue: 249.0/255.0, alpha: 1.0)
    static let border   = CGColor(red: 226.0/255.0, green: 232.0/255.0, blue: 240.0/255.0, alpha: 1.0)
    static let noteBg   = CGColor(red: 254.0/255.0, green: 249.0/255.0, blue: 195.0/255.0, alpha: 1.0)
    static let noteBorder = CGColor(red: 250.0/255.0, green: 204.0/255.0, blue: 21.0/255.0, alpha: 1.0)
    static let noteText = CGColor(red: 146.0/255.0, green: 64.0/255.0, blue: 14.0/255.0, alpha: 1.0)
    static let white = CGColor(red: 1, green: 1, blue: 1, alpha: 1)
    static let greenBg = CGColor(red: 220.0/255.0, green: 252.0/255.0, blue: 231.0/255.0, alpha: 1.0)
    static let greenBorder = CGColor(red: 34.0/255.0, green: 197.0/255.0, blue: 94.0/255.0, alpha: 1.0)
    static let greenText = CGColor(red: 22.0/255.0, green: 101.0/255.0, blue: 52.0/255.0, alpha: 1.0)
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
        case .left: drawX = x
        case .center: drawX = x + (width - w) / 2.0
        case .right: drawX = x + (width - w)
        }
    } else {
        switch align {
        case .left: drawX = x
        case .center: drawX = x - (w / 2.0)
        case .right: drawX = x - w
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

// ===================================================================
// PRO FORMA INVOICE — Global Cellutions
// Product: Arcade 1 Up - Mortal Kombat II
// 60 Pallets | Fulfillment $3/unit | Customer provides labels
// ===================================================================

let clientName = "Global Cellutions"
let productName = "Arcade 1 Up - Mortal Kombat II"
let palletCount: Int = 60
let storageDays: Int = 30

// RATES
let storageRatePerPalletDay: Double = 0.75
let containerReceiving: Double = 350.00          // Container unload fee
let palletHandlingInbound: Double = 15.00        // Per pallet receiving
let fulfillmentPerUnit: Double = 3.00            // Pick, pack, ship per unit
let blackWrapPerPallet: Double = 7.00            // Optional wrapping

// CALCULATIONS
let storageMonthly = Double(palletCount) * Double(storageDays) * storageRatePerPalletDay
let inboundReceiving = containerReceiving          // Container unload (one-time)
let inboundPalletHandling = Double(palletCount) * palletHandlingInbound
let wrapTotal = Double(palletCount) * blackWrapPerPallet
let oneTimeTotal = inboundReceiving + inboundPalletHandling + wrapTotal
let firstMonthTotal = storageMonthly + oneTimeTotal
let ongoingPerDay = Double(palletCount) * storageRatePerPalletDay
let ongoingPerMonth = ongoingPerDay * 30.0

func money(_ value: Double) -> String {
    String(format: "$%.2f", value)
}

func moneyWhole(_ value: Double) -> String {
    if value == Double(Int(value)) {
        return String(format: "$%d", Int(value))
    }
    return String(format: "$%.2f", value)
}

// Date formatting
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

let rand = Int.random(in: 1000..<9999)
let invoiceNumber = String(format: "MA3PL-PF-%@-%04d", dateKey, rand)

let outputDir = FileManager.default.currentDirectoryPath + "/.tmp/quotes"
let outputPath = outputDir + "/MiamiAlliance3PL_ProForma_GlobalCellutions.pdf"

var mediaBox = CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight)
let outputURL = URL(fileURLWithPath: outputPath)

guard let ctx = CGContext(outputURL as CFURL, mediaBox: &mediaBox, nil) else {
    fputs("Failed to create PDF context at \(outputPath)\n", stderr)
    exit(1)
}

ctx.beginPDFPage(nil)

// ===== HEADER =====
let headerHeight: CGFloat = 120
let headerRect = CGRect(x: 0, y: pageHeight - headerHeight, width: pageWidth, height: headerHeight)
drawRectFill(ctx, rect: headerRect, color: PdfColors.darkNavy)

let accentStripeHeight: CGFloat = 6
let stripeRect = CGRect(x: 0, y: pageHeight - headerHeight, width: pageWidth, height: accentStripeHeight)
drawRectFill(ctx, rect: stripeRect, color: PdfColors.accent)

// Logo
let logoPath = FileManager.default.currentDirectoryPath + "/assets/logo.jpg"
if let logo = loadCGImage(at: logoPath) {
    let logoW: CGFloat = 56
    let logoH: CGFloat = 84
    let logoX: CGFloat = margin
    let logoY: CGFloat = pageHeight - headerHeight + 20
    ctx.draw(logo, in: CGRect(x: logoX, y: logoY, width: logoW, height: logoH))
}

// Company text
let titleFont = ctFont("Helvetica-Bold", 28)
let taglineFont = ctFont("Helvetica", 10)

drawText(ctx, "MIAMI ALLIANCE", x: margin + 70, y: pageHeight - 50, font: titleFont, color: PdfColors.white)
drawText(ctx, "3PL", x: margin + 70, y: pageHeight - 82, font: titleFont, color: PdfColors.accent)
drawText(ctx, "WAREHOUSING  |  FULFILLMENT  |  LOGISTICS", x: margin + 70, y: pageHeight - 105, font: taglineFont, color: CGColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 1))

// PRO FORMA badge (right)
let badgeW: CGFloat = 150
let badgeH: CGFloat = 55
let badgeX: CGFloat = pageWidth - margin - badgeW
let badgeY: CGFloat = pageHeight - 36 - badgeH
let badgeRect2 = CGRect(x: badgeX, y: badgeY, width: badgeW, height: badgeH)
drawRectFill(ctx, rect: badgeRect2, color: PdfColors.accent)

drawText(ctx, "PRO FORMA", x: badgeX, y: badgeY + 35, font: ctFont("Helvetica-Bold", 11), color: PdfColors.white, align: .center, width: badgeW)
drawText(ctx, "INVOICE", x: badgeX, y: badgeY + 15, font: ctFont("Helvetica-Bold", 18), color: PdfColors.white, align: .center, width: badgeW)

// ===== INFO BAR =====
let infoBarH: CGFloat = 30
let infoBarRect = CGRect(x: 0, y: pageHeight - headerHeight - infoBarH, width: pageWidth, height: infoBarH)
drawRectFill(ctx, rect: infoBarRect, color: PdfColors.lightGray)

drawText(ctx, "INVOICE #: \(invoiceNumber)", x: margin, y: infoBarRect.minY + 10, font: ctFont("Helvetica-Bold", 10), color: PdfColors.primary)
drawText(ctx, "Date: \(currentDateStr)", x: pageWidth/2, y: infoBarRect.minY + 10, font: ctFont("Helvetica", 10), color: PdfColors.gray, align: .center)
drawText(ctx, "Valid through: \(validThroughStr)", x: pageWidth - margin, y: infoBarRect.minY + 10, font: ctFont("Helvetica", 10), color: PdfColors.gray, align: .right)

// ===== CLIENT / PRODUCT INFO =====
let bodyTopY: CGFloat = infoBarRect.minY - 20

// Bill To box (left)
let billToW: CGFloat = 250
let billToH: CGFloat = 65
let billToRect = CGRect(x: margin, y: bodyTopY - billToH, width: billToW, height: billToH)
drawRectFill(ctx, rect: billToRect, color: PdfColors.lightGray)
drawRectStroke(ctx, rect: billToRect, color: PdfColors.border, width: 1)

drawText(ctx, "BILL TO:", x: margin + 10, y: bodyTopY - 16, font: ctFont("Helvetica-Bold", 10), color: PdfColors.primary)
drawText(ctx, clientName, x: margin + 10, y: bodyTopY - 32, font: ctFont("Helvetica-Bold", 12), color: PdfColors.primary)
drawText(ctx, "Product: \(productName)", x: margin + 10, y: bodyTopY - 48, font: ctFont("Helvetica", 10), color: PdfColors.gray)
drawText(ctx, "Pallets: \(palletCount)  |  Container Unload", x: margin + 10, y: bodyTopY - 62, font: ctFont("Helvetica", 9), color: PdfColors.gray)

// From box (right)
let fromX: CGFloat = pageWidth - margin - billToW
let fromRect = CGRect(x: fromX, y: bodyTopY - billToH, width: billToW, height: billToH)
drawRectFill(ctx, rect: fromRect, color: PdfColors.lightGray)
drawRectStroke(ctx, rect: fromRect, color: PdfColors.border, width: 1)

drawText(ctx, "FROM:", x: fromX + 10, y: bodyTopY - 16, font: ctFont("Helvetica-Bold", 10), color: PdfColors.primary)
drawText(ctx, "Miami Alliance 3PL", x: fromX + 10, y: bodyTopY - 32, font: ctFont("Helvetica-Bold", 12), color: PdfColors.primary)
drawText(ctx, "8780 NW 100th ST", x: fromX + 10, y: bodyTopY - 48, font: ctFont("Helvetica", 10), color: PdfColors.gray)
drawText(ctx, "Medley, FL 33178", x: fromX + 10, y: bodyTopY - 62, font: ctFont("Helvetica", 9), color: PdfColors.gray)

// ===== SECTION: STORAGE & RECEIVING =====
let sectionTopY: CGFloat = bodyTopY - billToH - 20

drawText(ctx, "STORAGE & RECEIVING SERVICES", x: margin, y: sectionTopY, font: ctFont("Helvetica-Bold", 14), color: PdfColors.primary)

// Accent underline
drawHLine(ctx, x1: margin, x2: margin + 280, y: sectionTopY - 4, color: PdfColors.accent, width: 3)

// ===== LINE ITEMS TABLE =====
let tableX: CGFloat = margin
let tableW: CGFloat = pageWidth - (2 * margin)
let rowH: CGFloat = 22
let tableTop: CGFloat = sectionTopY - 18

let colServiceW: CGFloat = 220
let colQtyW: CGFloat = 60
let colRateW: CGFloat = 100
let colDurW: CGFloat = 80
let colAmtW: CGFloat = tableW - (colServiceW + colQtyW + colRateW + colDurW)

let colServiceX = tableX
let colQtyX = colServiceX + colServiceW
let colRateX = colQtyX + colQtyW
let colDurX = colRateX + colRateW
let colAmtX = colDurX + colDurW

// Table header
let thRect = CGRect(x: tableX, y: tableTop - rowH, width: tableW, height: rowH)
drawRectFill(ctx, rect: thRect, color: PdfColors.primary)

let thFont = ctFont("Helvetica-Bold", 9)
drawText(ctx, "Service", x: colServiceX + 8, y: tableTop - 15, font: thFont, color: PdfColors.white)
drawText(ctx, "Qty", x: colQtyX, y: tableTop - 15, font: thFont, color: PdfColors.white, align: .center, width: colQtyW)
drawText(ctx, "Rate", x: colRateX, y: tableTop - 15, font: thFont, color: PdfColors.white, align: .center, width: colRateW)
drawText(ctx, "Frequency", x: colDurX, y: tableTop - 15, font: thFont, color: PdfColors.white, align: .center, width: colDurW)
drawText(ctx, "Amount", x: colAmtX, y: tableTop - 15, font: thFont, color: PdfColors.white, align: .right, width: colAmtW - 8)

struct Row {
    let service: String
    let qty: String
    let rate: String
    let duration: String
    let amount: String
}

let rows: [Row] = [
    Row(service: "Pallet Storage (60 pallets x 30 days)", qty: "\(palletCount)", rate: "$0.75/pallet/day", duration: "Monthly", amount: money(storageMonthly)),
    Row(service: "Container Receiving & Unload", qty: "1", rate: money(containerReceiving), duration: "One-time", amount: money(inboundReceiving)),
    Row(service: "Pallet Intake & Racking", qty: "\(palletCount)", rate: money(palletHandlingInbound) + "/pallet", duration: "One-time", amount: money(inboundPalletHandling)),
    Row(service: "Black Wrapping (Optional)", qty: "\(palletCount)", rate: money(blackWrapPerPallet) + "/pallet", duration: "One-time", amount: money(wrapTotal))
]

let cellFont = ctFont("Helvetica", 9)
for (i, r) in rows.enumerated() {
    let rowTop = tableTop - rowH * CGFloat(i + 1)
    let rect = CGRect(x: tableX, y: rowTop - rowH, width: tableW, height: rowH)
    if i % 2 == 0 {
        drawRectFill(ctx, rect: rect, color: CGColor(red: 248/255, green: 250/255, blue: 252/255, alpha: 1))
    }
    drawText(ctx, r.service, x: colServiceX + 8, y: rowTop - 14, font: cellFont, color: PdfColors.primary)
    drawText(ctx, r.qty, x: colQtyX, y: rowTop - 14, font: cellFont, color: PdfColors.gray, align: .center, width: colQtyW)
    drawText(ctx, r.rate, x: colRateX, y: rowTop - 14, font: cellFont, color: PdfColors.gray, align: .center, width: colRateW)
    drawText(ctx, r.duration, x: colDurX, y: rowTop - 14, font: cellFont, color: PdfColors.gray, align: .center, width: colDurW)
    drawText(ctx, r.amount, x: colAmtX, y: rowTop - 14, font: ctFont("Helvetica-Bold", 9), color: PdfColors.primary, align: .right, width: colAmtW - 8)
}

let table1Bottom = tableTop - rowH * CGFloat(rows.count + 1)
let table1Rect = CGRect(x: tableX, y: table1Bottom, width: tableW, height: rowH * CGFloat(rows.count + 1))
drawRectStroke(ctx, rect: table1Rect, color: PdfColors.border, width: 1)

// Vertical separators
ctx.saveGState()
ctx.setStrokeColor(PdfColors.border)
ctx.setLineWidth(1)
for x in [colQtyX, colRateX, colDurX, colAmtX] {
    ctx.move(to: CGPoint(x: x, y: table1Bottom))
    ctx.addLine(to: CGPoint(x: x, y: tableTop))
}
ctx.strokePath()
ctx.restoreGState()

// ===== SECTION: FULFILLMENT =====
let fulfillTopY = table1Bottom - 20
drawText(ctx, "FULFILLMENT SERVICES (Per Order)", x: margin, y: fulfillTopY, font: ctFont("Helvetica-Bold", 14), color: PdfColors.primary)
drawHLine(ctx, x1: margin, x2: margin + 280, y: fulfillTopY - 4, color: PdfColors.accent, width: 3)

let fTableTop = fulfillTopY - 18
let fthRect = CGRect(x: tableX, y: fTableTop - rowH, width: tableW, height: rowH)
drawRectFill(ctx, rect: fthRect, color: PdfColors.primary)

drawText(ctx, "Service", x: colServiceX + 8, y: fTableTop - 15, font: thFont, color: PdfColors.white)
drawText(ctx, "Qty", x: colQtyX, y: fTableTop - 15, font: thFont, color: PdfColors.white, align: .center, width: colQtyW)
drawText(ctx, "Rate", x: colRateX, y: fTableTop - 15, font: thFont, color: PdfColors.white, align: .center, width: colRateW)
drawText(ctx, "Frequency", x: colDurX, y: fTableTop - 15, font: thFont, color: PdfColors.white, align: .center, width: colDurW)
drawText(ctx, "Amount", x: colAmtX, y: fTableTop - 15, font: thFont, color: PdfColors.white, align: .right, width: colAmtW - 8)

let fRows: [Row] = [
    Row(service: "Pick & Pack (per unit fulfilled)", qty: "1", rate: "$3.00/unit", duration: "Per Order", amount: "$3.00"),
    Row(service: "Shipping Labels", qty: "—", rate: "Client Provided", duration: "Per Order", amount: "$0.00")
]

for (i, r) in fRows.enumerated() {
    let rowTop = fTableTop - rowH * CGFloat(i + 1)
    let rect = CGRect(x: tableX, y: rowTop - rowH, width: tableW, height: rowH)
    if i % 2 == 0 {
        drawRectFill(ctx, rect: rect, color: CGColor(red: 248/255, green: 250/255, blue: 252/255, alpha: 1))
    }
    drawText(ctx, r.service, x: colServiceX + 8, y: rowTop - 14, font: cellFont, color: PdfColors.primary)
    drawText(ctx, r.qty, x: colQtyX, y: rowTop - 14, font: cellFont, color: PdfColors.gray, align: .center, width: colQtyW)
    drawText(ctx, r.rate, x: colRateX, y: rowTop - 14, font: cellFont, color: PdfColors.gray, align: .center, width: colRateW)
    drawText(ctx, r.duration, x: colDurX, y: rowTop - 14, font: cellFont, color: PdfColors.gray, align: .center, width: colDurW)
    drawText(ctx, r.amount, x: colAmtX, y: rowTop - 14, font: ctFont("Helvetica-Bold", 9), color: PdfColors.primary, align: .right, width: colAmtW - 8)
}

let fTableBottom = fTableTop - rowH * CGFloat(fRows.count + 1)
let fTableRect = CGRect(x: tableX, y: fTableBottom, width: tableW, height: rowH * CGFloat(fRows.count + 1))
drawRectStroke(ctx, rect: fTableRect, color: PdfColors.border, width: 1)

ctx.saveGState()
ctx.setStrokeColor(PdfColors.border)
ctx.setLineWidth(1)
for x in [colQtyX, colRateX, colDurX, colAmtX] {
    ctx.move(to: CGPoint(x: x, y: fTableBottom))
    ctx.addLine(to: CGPoint(x: x, y: fTableTop))
}
ctx.strokePath()
ctx.restoreGState()

// ===== TOTALS BOX =====
let totalsW: CGFloat = 260
let totalsH: CGFloat = 140
let totalsX: CGFloat = pageWidth - margin - totalsW
let totalsTop: CGFloat = fTableBottom - 18
let totalsRect = CGRect(x: totalsX, y: totalsTop - totalsH, width: totalsW, height: totalsH)
drawRectFill(ctx, rect: totalsRect, color: PdfColors.lightGray)
drawRectStroke(ctx, rect: totalsRect, color: PdfColors.border, width: 1)

let totalsAccent = CGRect(x: totalsX, y: totalsTop - 5, width: totalsW, height: 5)
drawRectFill(ctx, rect: totalsAccent, color: PdfColors.accent)

let totalsLeftX = totalsX + 12
let totalsRightX = totalsX + totalsW - 12

let tl1Y = totalsTop - 24
let tl2Y = totalsTop - 42
let tl3Y = totalsTop - 60
let tl4Y = totalsTop - 86
let tl5Y = totalsTop - 108
let tl6Y = totalsTop - 128

let tLabelFont = ctFont("Helvetica", 9)
let tBoldFont = ctFont("Helvetica-Bold", 10)

drawText(ctx, "Monthly Storage (60 pallets)", x: totalsLeftX, y: tl1Y, font: tLabelFont, color: PdfColors.gray)
drawText(ctx, money(storageMonthly), x: totalsRightX, y: tl1Y, font: tBoldFont, color: PdfColors.primary, align: .right)

drawText(ctx, "One-time Intake & Setup", x: totalsLeftX, y: tl2Y, font: tLabelFont, color: PdfColors.gray)
drawText(ctx, money(oneTimeTotal), x: totalsRightX, y: tl2Y, font: tBoldFont, color: PdfColors.primary, align: .right)

drawText(ctx, "Fulfillment", x: totalsLeftX, y: tl3Y, font: tLabelFont, color: PdfColors.gray)
drawText(ctx, "$3.00/unit (billed per order)", x: totalsRightX, y: tl3Y, font: tBoldFont, color: PdfColors.primary, align: .right)

// Divider
drawHLine(ctx, x1: totalsLeftX, x2: totalsRightX, y: totalsTop - 74, color: PdfColors.border, width: 1)

drawText(ctx, "FIRST MONTH TOTAL", x: totalsLeftX, y: tl4Y, font: ctFont("Helvetica-Bold", 11), color: PdfColors.primary)
drawText(ctx, money(firstMonthTotal), x: totalsRightX, y: tl4Y, font: ctFont("Helvetica-Bold", 14), color: PdfColors.accent, align: .right)

drawText(ctx, "Ongoing storage", x: totalsLeftX, y: tl5Y, font: tLabelFont, color: PdfColors.gray)
drawText(ctx, "\(money(ongoingPerDay))/day  (\(money(ongoingPerMonth))/mo)", x: totalsRightX, y: tl5Y, font: tBoldFont, color: PdfColors.primary, align: .right)

drawText(ctx, "+ $3.00/unit fulfilled", x: totalsLeftX, y: tl6Y, font: tLabelFont, color: PdfColors.gray)
drawText(ctx, "billed weekly", x: totalsRightX, y: tl6Y, font: tBoldFont, color: PdfColors.gray, align: .right)

// ===== KEY TERMS (left of totals) =====
let termsX: CGFloat = margin
let termsW: CGFloat = totalsX - margin - 12
let termsTop: CGFloat = totalsTop
let termsH: CGFloat = 70
let termsRect = CGRect(x: termsX, y: termsTop - termsH, width: termsW, height: termsH)
drawRectFill(ctx, rect: termsRect, color: PdfColors.greenBg)
drawRectStroke(ctx, rect: termsRect, color: PdfColors.greenBorder, width: 1)

drawText(ctx, "KEY TERMS", x: termsX + 10, y: termsTop - 16, font: ctFont("Helvetica-Bold", 10), color: PdfColors.greenText)

let termNoteFont = ctFont("Helvetica", 8)
drawText(ctx, "• Fulfillment: $3.00 per unit picked, packed & shipped", x: termsX + 10, y: termsTop - 32, font: termNoteFont, color: PdfColors.greenText)
drawText(ctx, "• Labels: Provided by client (no label cost)", x: termsX + 10, y: termsTop - 44, font: termNoteFont, color: PdfColors.greenText)
drawText(ctx, "• Billing: Storage monthly, fulfillment billed weekly", x: termsX + 10, y: termsTop - 56, font: termNoteFont, color: PdfColors.greenText)
drawText(ctx, "• Minimum commitment: None", x: termsX + 10, y: termsTop - 68, font: termNoteFont, color: PdfColors.greenText)

// ===== IMPORTANT NOTES =====
let notesTop = min(totalsRect.minY, termsRect.minY) - 12
let notesH: CGFloat = 56
let notesRect = CGRect(x: margin, y: notesTop - notesH, width: tableW, height: notesH)
drawRectFill(ctx, rect: notesRect, color: PdfColors.noteBg)
drawRectStroke(ctx, rect: notesRect, color: PdfColors.noteBorder, width: 1)

drawText(ctx, "IMPORTANT NOTES", x: margin + 12, y: notesTop - 16, font: ctFont("Helvetica-Bold", 9), color: PdfColors.noteText)

let noteFont = ctFont("Helvetica", 8)
let notes: [String] = [
    "This pro forma invoice is an estimate. Final billing is based on actual services rendered.",
    "Black wrapping is optional — included for reference. Storage billed at $0.75/pallet/day ongoing.",
    "All prices are in USD. Payment terms: Net 15. This quote is valid for 30 days from issue date."
]
for (i, n) in notes.enumerated() {
    drawText(ctx, "• " + n, x: margin + 12, y: notesTop - 30 - CGFloat(i) * 12, font: noteFont, color: PdfColors.noteText)
}

// ===== FOOTER =====
let footerLineY: CGFloat = 58
let footerTextY1: CGFloat = 42
let footerTextY2: CGFloat = 28

drawHLine(ctx, x1: margin, x2: pageWidth - margin, y: footerLineY, color: PdfColors.border, width: 1)

let footerFont = ctFont("Helvetica", 8)
drawText(ctx, "Miami Alliance 3PL  |  8780 NW 100th ST, Medley, FL 33178", x: pageWidth/2, y: footerTextY1, font: footerFont, color: PdfColors.gray, align: .center)
drawText(ctx, "info@miamialliance3pl.com  |  www.miamialliance3pl.com", x: pageWidth/2, y: footerTextY2, font: footerFont, color: PdfColors.gray, align: .center)

ctx.endPDFPage()
ctx.closePDF()

print(outputPath)
