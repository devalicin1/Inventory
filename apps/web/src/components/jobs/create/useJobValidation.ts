import type { JobFormData } from './types';

export const useJobValidation = () => {
    const validateStep = (step: number, data: JobFormData) => {
        const errs: string[] = [];

        if (step === 1) {
            if (!data.customer?.name) errs.push('Customer name is required');
            if (!data.customer?.date) errs.push('Date is required');
            if (!data.productName) errs.push('Product name is required');
            if (!(data.quantity > 0)) errs.push('Quantity must be > 0');
            if (data.unit === 'pcs' || data.unit === 'units' || data.unit === 'box' || data.unit === 'pallets') {
                const ea = data.packaging?.pcsPerBox;
                const opp = data.packaging?.boxesPerPallet;
                if (!(ea && ea > 0)) errs.push('Pieces/Outer or Boxes/Outer must be > 0');
                if (!(opp && opp > 0)) errs.push('Outers/Pallet must be > 0');
            }
        }

        if (step === 2) {
            const s = data.productionSpecs || {};
            if (!(s?.size?.width && s?.size?.width > 0 && s?.size?.length && s?.size?.length > 0)) errs.push('Size (W,L) is required');
            if (!(s?.numberUp && s?.numberUp > 0)) errs.push('Number Up must be > 0');
            if (s?.printedColors === undefined || s?.printedColors < 0) errs.push('Printed colours is required');
        }

        if (step === 3) {
            // Optional validation for outputs
            (data.output || []).forEach((o: any, idx: number) => {
                if (!(o.qtyPlanned >= 0)) errs.push(`Output row ${idx + 1}: Quantity must be >= 0`);
                if (!o.uom) errs.push(`Output row ${idx + 1}: UOM is required`);
                if (!(o.sku || o.name)) errs.push(`Output row ${idx + 1}: SKU or Name is required`);
            });
        }

        if (step === 4) {
            if (!data.workflowId) errs.push('Workflow is required');
            if (!Array.isArray(data.plannedStageIds) || data.plannedStageIds.length === 0) errs.push('At least one stage is required');
            if (!data.currentStageId || !(data.plannedStageIds || []).includes(data.currentStageId)) errs.push('Starting stage must be among selected stages');

            const s = data.plannedStart ? new Date(data.plannedStart).getTime() : undefined;
            const e = data.plannedEnd ? new Date(data.plannedEnd).getTime() : undefined;
            const d = data.dueDate ? new Date(data.dueDate).getTime() : undefined;

            if (s !== undefined && e !== undefined && e < s) errs.push('Planned end must be after start');
            if (e !== undefined && d !== undefined && e > d) errs.push('Planned end must be on/before due date');
        }

        if (step === 5) {
            if (!data.outerType) errs.push('Outer type is required');
        }

        return errs;
    };

    return { validateStep };
};
