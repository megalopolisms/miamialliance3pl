/**
 * Quote Calculator for Miami Alliance 3PL
 * Calculates storage, handling, pick & pack, and shipping estimates
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
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.quoteCalculator = new QuoteCalculator();
});
