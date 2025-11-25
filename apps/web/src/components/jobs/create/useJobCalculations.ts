import { useMemo } from 'react';
import type { JobFormData } from './types';

export const useJobCalculations = (formData: JobFormData) => {
    // Packing plan calculations
    const calcPlanned = (
        qty: number,
        ea: number | undefined,
        opp: number | undefined,
        override?: number | undefined,
        unit?: string
    ) => {
        const eaSafe = Math.max(1, (ea ?? 0) | 0);
        const oppSafe = Math.max(1, (opp ?? 0) | 0);

        let plannedOuters: number;
        let plannedQtyByPack: number;

        if (unit === 'box' || unit === 'units') {
            // When unit is 'box', qty is in boxes
            // ea represents pieces per box, opp represents boxes per pallet
            // Calculate total pieces: qty boxes * ea pieces per box
            const totalPieces = (qty || 0) * eaSafe;

            // When unit is 'box', "Boxes/Outer" field actually means "Pieces per Outer"
            // Calculate outers: total pieces / pieces per outer
            plannedOuters = Math.ceil(totalPieces / eaSafe);

            // Calculate pallets based on boxes
            const boxesPerPallet = oppSafe;
            const fullPallets = Math.floor((qty || 0) / boxesPerPallet);
            const remainderBoxes = (qty || 0) - fullPallets * boxesPerPallet;

            // Planned qty by pack is total pieces packed
            plannedQtyByPack = totalPieces;
            const leftover = 0; // No leftover when working with boxes directly

            return {
                plannedOuters,
                pallets: fullPallets + (remainderBoxes > 0 ? 1 : 0),
                plannedQtyByPack,
                leftover,
                fullPallets,
                remainderOuters: 0,
                palletsAuto: fullPallets + (remainderBoxes > 0 ? 1 : 0)
            };
        } else if (unit === 'pallets') {
            // Quantity represents pallets; ea = pieces per outer, opp = outers per pallet
            const totalOuters = (qty || 0) * oppSafe;
            plannedOuters = totalOuters;
            const totalPieces = totalOuters * eaSafe;
            plannedQtyByPack = totalPieces;

            const fullPallets = qty || 0;
            const remainderOuters = 0;
            const palletsAuto = fullPallets;
            const pallets = override && override > 0 ? override : palletsAuto;
            const leftover = 0;

            return { plannedOuters, pallets, plannedQtyByPack, leftover, fullPallets, remainderOuters, palletsAuto };
        } else {
            // When unit is 'pcs', standard calculation
            plannedOuters = Math.ceil((qty || 0) / eaSafe);
            plannedQtyByPack = plannedOuters * eaSafe;
        }

        const fullPallets = Math.floor(plannedOuters / oppSafe);
        const remainderOuters = plannedOuters - fullPallets * oppSafe;
        const palletsAuto = fullPallets + (remainderOuters > 0 ? 1 : 0);
        const pallets = override && override > 0 ? override : palletsAuto;
        const leftover = plannedQtyByPack - (qty || 0);

        return { plannedOuters, pallets, plannedQtyByPack, leftover, fullPallets, remainderOuters, palletsAuto };
    };

    const planned = useMemo(() =>
        calcPlanned(
            formData.quantity || 0,
            formData.packaging?.pcsPerBox,
            formData.packaging?.boxesPerPallet,
            formData.packaging?.plannedPallets,
            formData.unit
        ),
        [formData.quantity, formData.packaging?.pcsPerBox, formData.packaging?.boxesPerPallet, formData.packaging?.plannedPallets, formData.unit]);

    const hasPalletMismatch = useMemo(() => {
        const o = formData.packaging?.plannedPallets;
        return !!(o && o > 0 && o !== planned.palletsAuto);
    }, [formData.packaging?.plannedPallets, planned.palletsAuto]);

    // Specs calculations
    const theoreticalNumberUp = useMemo(() => {
        const sw = formData.productionSpecs?.sheet?.width || 0;
        const sl = formData.productionSpecs?.sheet?.length || 0;
        const cw = formData.productionSpecs?.cutTo?.width || 0;
        const cl = formData.productionSpecs?.cutTo?.length || 0;
        if (sw > 0 && sl > 0 && cw > 0 && cl > 0) {
            return Math.floor(sw / cw) * Math.floor(sl / cl);
        }
        return undefined;
    }, [formData.productionSpecs?.sheet?.width, formData.productionSpecs?.sheet?.length, formData.productionSpecs?.cutTo?.width, formData.productionSpecs?.cutTo?.length]);

    const sheetsNeeded = useMemo(() => {
        const nUp = formData.productionSpecs?.numberUp || 0;
        if (nUp > 0) {
            // For 'box' or 'units', convert to pieces first
            let totalQty = formData.quantity || 0;
            if (formData.unit === 'box' || formData.unit === 'units') {
                const pcsPerBox = formData.packaging?.pcsPerBox || 1;
                totalQty = totalQty * pcsPerBox;
            } else if (formData.unit === 'pallets') {
                const pcsPerOuter = formData.packaging?.pcsPerBox || 1;
                const outersPerPallet = formData.packaging?.boxesPerPallet || 1;
                totalQty = totalQty * outersPerPallet * pcsPerOuter;
            }
            // Base required sheets before adjustments
            const baseRequiredSheets = Math.ceil(totalQty / nUp);
            // Apply 5% increase first, then add 400 sheets
            return Math.ceil(baseRequiredSheets * 1.05 + 400);
        }
        return undefined;
    }, [formData.quantity, formData.unit, formData.packaging?.pcsPerBox, formData.productionSpecs?.numberUp]);

    const sheetsNeededWithOvers = useMemo(() => {
        if (sheetsNeeded === undefined) return undefined;
        const overs = formData.productionSpecs?.oversPct || 0;
        return Math.ceil(sheetsNeeded * (1 + (overs > 0 ? overs / 100 : 0)));
    }, [sheetsNeeded, formData.productionSpecs?.oversPct]);

    const sheetsNeededWithWastage = useMemo(() => {
        if (sheetsNeededWithOvers === undefined) return undefined;
        const wastage = formData.productionSpecs?.sheetWastage || 0;
        return sheetsNeededWithOvers + wastage;
    }, [sheetsNeededWithOvers, formData.productionSpecs?.sheetWastage]);

    return {
        planned,
        hasPalletMismatch,
        theoreticalNumberUp,
        sheetsNeeded,
        sheetsNeededWithOvers,
        sheetsNeededWithWastage
    };
};
