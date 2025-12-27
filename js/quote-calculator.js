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
        const darkNavy = [15, 23, 42];          // #0f172a

        // Calculate values
        const cubicFt = this.getCubicFeet();
        const dimWeight = this.getDimensionalWeight();
        const billableWeight = this.getBillableWeight();
        const results = this.calculate();

        // Load company logo
        const logoLoaded = await this.loadLogoForPDF(doc);

        // ===== HEADER - DRAMATIC GRADIENT BAR =====
        // Dark gradient background
        doc.setFillColor(...darkNavy);
        doc.rect(0, 0, 210, 55, 'F');

        // Accent stripe
        doc.setFillColor(...accentColor);
        doc.rect(0, 55, 210, 3, 'F');

        // Add logo if loaded
        if (logoLoaded) {
            doc.addImage(this.logoData, 'JPEG', 12, 8, 40, 40);
        }

        // Company name - large and bold
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(28);
        doc.setTextColor(255, 255, 255);
        doc.text('MIAMI ALLIANCE', 58, 25);

        // 3PL in accent color
        doc.setTextColor(...accentColor);
        doc.text('3PL', 58, 40);

        // Tagline
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(148, 163, 184);
        doc.text('WAREHOUSING  |  FULFILLMENT  |  LOGISTICS', 58, 50);

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

    async loadLogoForPDF(doc) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                // Create canvas to convert image
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                this.logoData = canvas.toDataURL('image/jpeg', 0.9);
                resolve(true);
            };
            img.onerror = () => {
                console.log('Could not load logo, continuing without it');
                resolve(false);
            };
            // Try to load the logo
            img.src = 'assets/logo.jpg';
        });
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
