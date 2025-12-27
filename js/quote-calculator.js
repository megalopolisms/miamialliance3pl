/**
 * Quote Calculator for Miami Alliance 3PL
 * Calculates storage, handling, pick & pack, and shipping estimates
 * Includes PDF quote generation with company branding
 */

const PRICING = {
    dimensionalFactor: 139,         // DIM factor for domestic shipping
    storagePerCubicFtDay: 0.025,    // $/cubic ft/day
    handlingFee: 3.50,              // $ per unit
    pickAndPack: 1.25,              // $ per item
    palletStoragePerDay: 0.75,      // $/pallet/day
    shippingZones: {
        local: 0.45,                // $/lb - Florida
        regional: 0.65,             // $/lb - Southeast
        national: 0.85              // $/lb - National
    }
};

const COMPANY_INFO = {
    name: 'MIAMI ALLIANCE 3PL',
    address: '8780 NW 100th ST',
    city: 'Medley, FL 33178',
    phone: '(305) 555-0123',
    email: 'info@miamialliance3pl.com',
    website: 'www.miamialliance3pl.com'
};

// Company logo embedded as base64 (300px version for PDF)
const COMPANY_LOGO_BASE64 = 'data:image/jpeg;base64,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';

class QuoteCalculator {
    constructor() {
        this.packageType = 'box';
        this.dimensions = { length: 12, width: 12, height: 12 };
        this.weight = 25;
        this.quantity = 1;
        this.shippingZone = 'regional';
        this.storageDays = 30;

        this.init();
    }

    init() {
        // Package type toggle
        document.querySelectorAll('.package-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.package-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.packageType = btn.dataset.type;

                // Set default pallet dimensions
                if (this.packageType === 'pallet') {
                    this.setDimensions(48, 40, 48);
                    document.getElementById('dim-length').value = 48;
                    document.getElementById('dim-width').value = 40;
                    document.getElementById('dim-height').value = 48;
                    document.getElementById('weight-slider').value = 500;
                    document.getElementById('weight-input').value = 500;
                    this.weight = 500;
                } else {
                    this.setDimensions(12, 12, 12);
                    document.getElementById('dim-length').value = 12;
                    document.getElementById('dim-width').value = 12;
                    document.getElementById('dim-height').value = 12;
                    document.getElementById('weight-slider').value = 25;
                    document.getElementById('weight-input').value = 25;
                    this.weight = 25;
                }

                this.calculate();

                // Notify 3D viewer if available
                if (window.quote3D) {
                    window.quote3D.setPackageType(this.packageType);
                    window.quote3D.updateDimensions(this.dimensions.length, this.dimensions.width, this.dimensions.height);
                }
            });
        });

        // Dimension inputs
        ['length', 'width', 'height'].forEach(dim => {
            const input = document.getElementById(`dim-${dim}`);
            if (input) {
                input.addEventListener('input', (e) => {
                    const value = Math.max(1, Math.min(120, parseInt(e.target.value) || 1));
                    this.dimensions[dim] = value;
                    this.calculate();

                    if (window.quote3D) {
                        window.quote3D.updateDimensions(
                            this.dimensions.length,
                            this.dimensions.width,
                            this.dimensions.height
                        );
                    }
                });
            }
        });

        // Weight slider
        const weightSlider = document.getElementById('weight-slider');
        const weightInput = document.getElementById('weight-input');

        if (weightSlider) {
            weightSlider.addEventListener('input', (e) => {
                this.weight = parseInt(e.target.value);
                if (weightInput) weightInput.value = this.weight;
                this.calculate();
            });
        }

        if (weightInput) {
            weightInput.addEventListener('input', (e) => {
                this.weight = Math.max(1, Math.min(2000, parseInt(e.target.value) || 1));
                if (weightSlider) weightSlider.value = Math.min(500, this.weight);
                this.calculate();
            });
        }

        // Quantity controls
        const qtyInput = document.getElementById('quantity-input');
        const qtyBtns = document.querySelectorAll('.qty-btn');

        qtyBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.action === 'increase') {
                    this.quantity = Math.min(1000, this.quantity + 1);
                } else {
                    this.quantity = Math.max(1, this.quantity - 1);
                }
                if (qtyInput) qtyInput.value = this.quantity;
                this.calculate();
            });
        });

        if (qtyInput) {
            qtyInput.addEventListener('input', (e) => {
                this.quantity = Math.max(1, Math.min(1000, parseInt(e.target.value) || 1));
                this.calculate();
            });
        }

        // Shipping zone
        const zoneSelect = document.getElementById('shipping-zone');
        if (zoneSelect) {
            zoneSelect.addEventListener('change', (e) => {
                this.shippingZone = e.target.value;
                this.calculate();
            });
        }

        // Initial calculation
        this.calculate();
    }

    setDimensions(length, width, height) {
        this.dimensions = { length, width, height };
    }

    getCubicFeet() {
        const { length, width, height } = this.dimensions;
        return (length * width * height) / 1728; // cubic inches to cubic feet
    }

    getDimensionalWeight() {
        const { length, width, height } = this.dimensions;
        return (length * width * height) / PRICING.dimensionalFactor;
    }

    getBillableWeight() {
        return Math.max(this.weight, this.getDimensionalWeight());
    }

    calculate() {
        const cubicFt = this.getCubicFeet();
        const dimWeight = this.getDimensionalWeight();
        const billableWeight = this.getBillableWeight();

        let storage, handling, pickPack, shipping;

        if (this.packageType === 'pallet') {
            // Pallet pricing
            storage = PRICING.palletStoragePerDay * this.storageDays * this.quantity;
            handling = 15.00 * this.quantity; // Higher handling for pallets
            pickPack = 5.00 * this.quantity;  // Higher pick/pack for pallets
            shipping = billableWeight * PRICING.shippingZones[this.shippingZone] * this.quantity;
        } else {
            // Box pricing
            storage = cubicFt * PRICING.storagePerCubicFtDay * this.storageDays * this.quantity;
            handling = PRICING.handlingFee * this.quantity;
            pickPack = PRICING.pickAndPack * this.quantity;
            shipping = billableWeight * PRICING.shippingZones[this.shippingZone] * this.quantity;
        }

        // Minimum storage charge
        storage = Math.max(storage, 5.00);

        const total = storage + handling + pickPack + shipping;

        // Update UI
        this.updateDisplay({
            dimWeight: dimWeight.toFixed(1),
            cubicFt: cubicFt.toFixed(1),
            storage: storage,
            handling: handling,
            pickPack: pickPack,
            shipping: shipping,
            total: total
        });

        return { storage, handling, pickPack, shipping, total };
    }

    updateDisplay(values) {
        const elements = {
            'result-dim-weight': `${values.dimWeight} lbs`,
            'result-cubic-ft': `${values.cubicFt} ft³`,
            'result-storage': this.formatCurrency(values.storage),
            'result-handling': this.formatCurrency(values.handling),
            'result-pickpack': this.formatCurrency(values.pickPack),
            'result-shipping': this.formatCurrency(values.shipping),
            'result-total': this.formatCurrency(values.total)
        };

        for (const [id, value] of Object.entries(elements)) {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        }
    }

    formatCurrency(amount) {
        return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    generateQuoteNumber() {
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `MA3PL-${dateStr}-${random}`;
    }

    getZoneName(zone) {
        const names = {
            local: 'Local (Florida)',
            regional: 'Regional (Southeast)',
            national: 'National'
        };
        return names[zone] || zone;
    }

    generatePDF() {
        // Check if jsPDF is loaded
        if (typeof window.jspdf === 'undefined') {
            alert('PDF library loading... Please try again in a moment.');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const quoteNumber = this.generateQuoteNumber();
        const currentDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Colors
        const primaryColor = [30, 58, 95];      // #1e3a5f
        const accentColor = [20, 184, 166];     // #14b8a6
        const grayColor = [100, 116, 139];      // #64748b
        const lightGray = [241, 245, 249];      // #f1f5f9
        const darkNavy = [15, 23, 42];          // #0f172a

        // Calculate values
        const cubicFt = this.getCubicFeet();
        const dimWeight = this.getDimensionalWeight();
        const billableWeight = this.getBillableWeight();
        const results = this.calculate();

        // ===== HEADER - DRAMATIC GRADIENT BAR =====
        // Dark gradient background
        doc.setFillColor(...darkNavy);
        doc.rect(0, 0, 210, 55, 'F');

        // Accent stripe
        doc.setFillColor(...accentColor);
        doc.rect(0, 55, 210, 3, 'F');

        // Add company logo (embedded base64) - maintains portrait aspect ratio (784x1168 = ~2:3)
        // Logo dimensions: 28mm wide x 42mm tall to match original proportions
        try {
            doc.addImage(COMPANY_LOGO_BASE64, 'JPEG', 10, 6, 28, 42);
        } catch (e) {
            console.log('Logo could not be added:', e);
        }

        // Company name - large and bold (positioned after logo)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(28);
        doc.setTextColor(255, 255, 255);
        doc.text('MIAMI ALLIANCE', 44, 25);

        // 3PL in accent color
        doc.setTextColor(...accentColor);
        doc.text('3PL', 44, 40);

        // Tagline
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(148, 163, 184);
        doc.text('WAREHOUSING  |  FULFILLMENT  |  LOGISTICS', 44, 50);

        // Quote badge on right
        doc.setFillColor(...accentColor);
        doc.roundedRect(145, 10, 55, 35, 3, 3, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text('INSTANT', 172, 22, { align: 'center' });
        doc.setFontSize(16);
        doc.text('QUOTE', 172, 35, { align: 'center' });

        // ===== QUOTE INFO BAR =====
        doc.setFillColor(...lightGray);
        doc.rect(0, 58, 210, 20, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...primaryColor);
        doc.text(`QUOTE #: ${quoteNumber}`, 20, 70);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);
        doc.text(`Date: ${currentDate}`, 105, 70, { align: 'center' });
        doc.text('Valid for 30 days', 190, 70, { align: 'right' });

        // ===== PACKAGE DETAILS - LEFT COLUMN =====
        let yPos = 90;
        const leftCol = 20;
        const rightCol = 110;

        // Section header with icon
        doc.setFillColor(...primaryColor);
        doc.roundedRect(leftCol, yPos - 6, 80, 10, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text('PACKAGE DETAILS', leftCol + 5, yPos + 1);

        yPos += 12;

        // Package info with styled rows
        const packageDetails = [
            ['Type', this.packageType === 'pallet' ? 'PALLET' : 'BOX'],
            ['Dimensions', `${this.dimensions.length}" x ${this.dimensions.width}" x ${this.dimensions.height}"`],
            ['Weight', `${this.weight} lbs (actual)`],
            ['DIM Weight', `${dimWeight.toFixed(1)} lbs`],
            ['Billable', `${billableWeight.toFixed(1)} lbs`],
            ['Volume', `${cubicFt.toFixed(2)} cu ft`],
            ['Quantity', `${this.quantity} unit${this.quantity > 1 ? 's' : ''}`],
            ['Zone', this.getZoneName(this.shippingZone)]
        ];

        doc.setFontSize(9);
        packageDetails.forEach(([label, value], index) => {
            const rowY = yPos + (index * 7);
            if (index % 2 === 0) {
                doc.setFillColor(248, 250, 252);
                doc.rect(leftCol, rowY - 4, 80, 7, 'F');
            }
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...grayColor);
            doc.text(label + ':', leftCol + 3, rowY);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...primaryColor);
            doc.text(value, leftCol + 77, rowY, { align: 'right' });
        });

        // ===== PRICING BREAKDOWN - RIGHT COLUMN =====
        yPos = 90;

        // Section header
        doc.setFillColor(...accentColor);
        doc.roundedRect(rightCol, yPos - 6, 80, 10, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text('PRICING BREAKDOWN', rightCol + 5, yPos + 1);

        yPos += 12;

        // Pricing rows
        const priceRows = [
            ['Storage (' + this.storageDays + 'd)', this.formatCurrency(results.storage)],
            ['Handling Fee', this.formatCurrency(results.handling)],
            ['Pick & Pack', this.formatCurrency(results.pickPack)],
            ['Est. Shipping', this.formatCurrency(results.shipping)]
        ];

        doc.setFontSize(10);
        priceRows.forEach(([service, amount], index) => {
            const rowY = yPos + (index * 9);
            if (index % 2 === 0) {
                doc.setFillColor(248, 250, 252);
                doc.rect(rightCol, rowY - 4, 80, 9, 'F');
            }
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...grayColor);
            doc.text(service, rightCol + 3, rowY + 1);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...primaryColor);
            doc.text(amount, rightCol + 77, rowY + 1, { align: 'right' });
        });

        // TOTAL - Big and bold
        const totalY = yPos + 45;
        doc.setFillColor(...primaryColor);
        doc.roundedRect(rightCol, totalY - 6, 80, 16, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text('TOTAL', rightCol + 5, totalY + 3);
        doc.setFontSize(16);
        doc.setTextColor(...accentColor);
        doc.text(this.formatCurrency(results.total), rightCol + 75, totalY + 4, { align: 'right' });

        // ===== RATE DETAILS =====
        yPos = 165;

        doc.setDrawColor(...lightGray);
        doc.setLineWidth(0.5);
        doc.line(20, yPos, 190, yPos);

        yPos += 10;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...primaryColor);
        doc.text('RATE DETAILS', 20, yPos);

        yPos += 8;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...grayColor);

        const rates = [
            `Storage: ${this.packageType === 'pallet' ? '$0.75/pallet/day' : '$0.025/cu ft/day'}`,
            `Handling: ${this.packageType === 'pallet' ? '$15.00/pallet' : '$3.50/unit'}`,
            `Pick & Pack: ${this.packageType === 'pallet' ? '$5.00/pallet' : '$1.25/item'}`,
            `Shipping: $${PRICING.shippingZones[this.shippingZone].toFixed(2)}/lb (${this.getZoneName(this.shippingZone)})`
        ];
        doc.text(rates.join('   |   '), 105, yPos, { align: 'center' });

        // ===== IMPORTANT NOTES =====
        yPos += 15;

        doc.setFillColor(254, 249, 195); // Yellow background
        doc.roundedRect(20, yPos - 5, 170, 35, 3, 3, 'F');
        doc.setDrawColor(250, 204, 21);
        doc.setLineWidth(0.5);
        doc.roundedRect(20, yPos - 5, 170, 35, 3, 3, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(146, 64, 14);
        doc.text('IMPORTANT NOTES', 25, yPos + 3);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        const notes = [
            'This is an estimate. Final pricing may vary based on actual dimensions and services.',
            'Volume discounts available for recurring shipments. Quote valid for 30 days.',
            'Special handling, hazmat, or oversized items may incur additional fees.'
        ];
        notes.forEach((note, i) => {
            doc.text('• ' + note, 25, yPos + 11 + (i * 6));
        });

        // ===== CALL TO ACTION =====
        yPos = 235;

        doc.setFillColor(...primaryColor);
        doc.roundedRect(20, yPos, 170, 25, 3, 3, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.text('Ready to get started?', 30, yPos + 11);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Contact us for a detailed quote tailored to your needs.', 30, yPos + 20);

        // Contact button style
        doc.setFillColor(...accentColor);
        doc.roundedRect(145, yPos + 5, 40, 15, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('CONTACT', 165, yPos + 15, { align: 'center' });

        // ===== FOOTER =====
        const footerY = 275;

        doc.setDrawColor(...lightGray);
        doc.line(20, footerY, 190, footerY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...grayColor);
        doc.text(COMPANY_INFO.address + ', ' + COMPANY_INFO.city, 105, footerY + 7, { align: 'center' });
        doc.text(`${COMPANY_INFO.phone}  |  ${COMPANY_INFO.email}  |  ${COMPANY_INFO.website}`, 105, footerY + 13, { align: 'center' });

        // Save PDF
        doc.save(`MiamiAlliance3PL_Quote_${quoteNumber}.pdf`);

        // Show success message
        this.showPDFSuccess(quoteNumber);
    }

    showPDFSuccess(quoteNumber) {
        // Create success toast
        const toast = document.createElement('div');
        toast.className = 'pdf-toast';
        toast.innerHTML = `
            <div class="pdf-toast-icon">✓</div>
            <div class="pdf-toast-content">
                <strong>Quote Downloaded!</strong>
                <span>${quoteNumber}</span>
            </div>
        `;
        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 100);

        // Remove after 4 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.quoteCalculator = new QuoteCalculator();

    // Add PDF button event listener
    const pdfBtn = document.getElementById('download-pdf-btn');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', () => {
            window.quoteCalculator.generatePDF();
        });
    }
});
