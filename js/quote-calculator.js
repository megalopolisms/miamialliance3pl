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

    async generatePDF() {
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

        // Calculate values
        const cubicFt = this.getCubicFeet();
        const dimWeight = this.getDimensionalWeight();
        const billableWeight = this.getBillableWeight();
        const results = this.calculate();

        // ===== HEADER WITH LOGO =====
        // Logo background bar
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, 210, 45, 'F');

        // Draw 3D Box Logo
        const logoX = 20;
        const logoY = 22;
        const boxSize = 12;

        // Box top (parallelogram)
        doc.setFillColor(...accentColor);
        doc.triangle(
            logoX, logoY - boxSize/2,
            logoX + boxSize, logoY - boxSize,
            logoX + boxSize * 2, logoY - boxSize/2,
            'F'
        );
        doc.triangle(
            logoX, logoY - boxSize/2,
            logoX + boxSize * 2, logoY - boxSize/2,
            logoX + boxSize, logoY,
            'F'
        );

        // Box left side
        doc.setFillColor(13, 148, 136);
        doc.triangle(
            logoX, logoY - boxSize/2,
            logoX, logoY + boxSize/2,
            logoX + boxSize, logoY + boxSize,
            'F'
        );
        doc.triangle(
            logoX, logoY - boxSize/2,
            logoX + boxSize, logoY + boxSize,
            logoX + boxSize, logoY,
            'F'
        );

        // Box right side
        doc.setFillColor(15, 118, 110);
        doc.triangle(
            logoX + boxSize * 2, logoY - boxSize/2,
            logoX + boxSize * 2, logoY + boxSize/2,
            logoX + boxSize, logoY + boxSize,
            'F'
        );
        doc.triangle(
            logoX + boxSize * 2, logoY - boxSize/2,
            logoX + boxSize, logoY + boxSize,
            logoX + boxSize, logoY,
            'F'
        );

        // Company name
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255);
        doc.text('MIAMI ALLIANCE', 50, 20);
        doc.setTextColor(...accentColor);
        doc.text('3PL', 145, 20);

        // Tagline
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        doc.text('Warehousing | Fulfillment | Logistics', 50, 28);

        // Contact info in header
        doc.setFontSize(9);
        doc.setTextColor(200, 200, 200);
        doc.text(COMPANY_INFO.address + ' | ' + COMPANY_INFO.city, 50, 38);

        // ===== QUOTE TITLE & INFO =====
        doc.setFillColor(...lightGray);
        doc.rect(0, 45, 210, 25, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(...primaryColor);
        doc.text('INSTANT QUOTE', 20, 60);

        // Quote number and date (right aligned)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...grayColor);
        doc.text(`Quote #: ${quoteNumber}`, 190, 53, { align: 'right' });
        doc.text(`Date: ${currentDate}`, 190, 60, { align: 'right' });
        doc.text('Valid for 30 days', 190, 67, { align: 'right' });

        // ===== PACKAGE DETAILS SECTION =====
        let yPos = 85;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...primaryColor);
        doc.text('Package Details', 20, yPos);

        yPos += 8;
        doc.setDrawColor(...accentColor);
        doc.setLineWidth(0.5);
        doc.line(20, yPos, 190, yPos);

        yPos += 10;

        // Package details grid
        const details = [
            ['Package Type:', this.packageType === 'pallet' ? 'Pallet' : 'Box'],
            ['Dimensions (LxWxH):', `${this.dimensions.length}" x ${this.dimensions.width}" x ${this.dimensions.height}"`],
            ['Actual Weight:', `${this.weight} lbs`],
            ['Dimensional Weight:', `${dimWeight.toFixed(1)} lbs`],
            ['Billable Weight:', `${billableWeight.toFixed(1)} lbs`],
            ['Cubic Feet:', `${cubicFt.toFixed(2)} cu ft`],
            ['Quantity:', this.quantity.toString()],
            ['Shipping Zone:', this.getZoneName(this.shippingZone)],
            ['Storage Period:', `${this.storageDays} days`]
        ];

        doc.setFontSize(11);
        details.forEach(([label, value], index) => {
            if (index % 2 === 0) {
                doc.setFillColor(250, 250, 252);
                doc.rect(20, yPos - 5, 170, 8, 'F');
            }
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...grayColor);
            doc.text(label, 25, yPos);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...primaryColor);
            doc.text(value, 120, yPos);
            yPos += 8;
        });

        // ===== PRICING BREAKDOWN SECTION =====
        yPos += 10;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...primaryColor);
        doc.text('Pricing Breakdown', 20, yPos);

        yPos += 8;
        doc.setDrawColor(...accentColor);
        doc.line(20, yPos, 190, yPos);

        yPos += 10;

        // Pricing table header
        doc.setFillColor(...primaryColor);
        doc.rect(20, yPos - 5, 170, 10, 'F');
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('Service', 25, yPos + 2);
        doc.text('Rate', 100, yPos + 2);
        doc.text('Amount', 160, yPos + 2);

        yPos += 12;

        // Pricing rows
        const priceRows = [
            ['Storage (' + this.storageDays + ' days)',
             this.packageType === 'pallet' ? '$0.75/pallet/day' : '$0.025/cu ft/day',
             this.formatCurrency(results.storage)],
            ['Handling Fee',
             this.packageType === 'pallet' ? '$15.00/pallet' : '$3.50/unit',
             this.formatCurrency(results.handling)],
            ['Pick & Pack',
             this.packageType === 'pallet' ? '$5.00/pallet' : '$1.25/item',
             this.formatCurrency(results.pickPack)],
            ['Estimated Shipping',
             '$' + PRICING.shippingZones[this.shippingZone].toFixed(2) + '/lb',
             this.formatCurrency(results.shipping)]
        ];

        doc.setFontSize(10);
        priceRows.forEach(([service, rate, amount], index) => {
            if (index % 2 === 0) {
                doc.setFillColor(250, 250, 252);
                doc.rect(20, yPos - 4, 170, 8, 'F');
            }
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...grayColor);
            doc.text(service, 25, yPos);
            doc.text(rate, 100, yPos);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...primaryColor);
            doc.text(amount, 175, yPos, { align: 'right' });
            yPos += 8;
        });

        // Total row
        yPos += 5;
        doc.setFillColor(...accentColor);
        doc.rect(20, yPos - 5, 170, 12, 'F');
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('TOTAL ESTIMATE', 25, yPos + 3);
        doc.text(this.formatCurrency(results.total), 175, yPos + 3, { align: 'right' });

        // ===== NOTES SECTION =====
        yPos += 25;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...primaryColor);
        doc.text('Important Notes', 20, yPos);

        yPos += 8;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...grayColor);

        const notes = [
            '• This is an estimate. Final pricing may vary based on actual dimensions and services required.',
            '• Storage rates are calculated for ' + this.storageDays + ' days. Extended storage available at same daily rate.',
            '• Shipping estimates based on ' + this.getZoneName(this.shippingZone) + ' zone rates.',
            '• Special handling, hazmat, or oversized items may incur additional fees.',
            '• Volume discounts available for large or recurring shipments. Contact us for a custom quote.',
            '• Quote valid for 30 days from issue date.'
        ];

        notes.forEach(note => {
            doc.text(note, 20, yPos);
            yPos += 6;
        });

        // ===== FOOTER =====
        const footerY = 270;

        doc.setDrawColor(...lightGray);
        doc.setLineWidth(0.5);
        doc.line(20, footerY, 190, footerY);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('Ready to get started?', 20, footerY + 10);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);
        doc.text('Contact us for a detailed quote tailored to your specific needs.', 20, footerY + 17);

        // Contact info
        doc.setFontSize(9);
        doc.text(`${COMPANY_INFO.phone}  |  ${COMPANY_INFO.email}  |  ${COMPANY_INFO.website}`, 105, footerY + 25, { align: 'center' });

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
